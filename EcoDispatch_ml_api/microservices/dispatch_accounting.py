"""
Rigorous WattWise dispatch energy & financial accounting.

RunCost = Σ_h ( Grid_kWh[h] * importTariffAllIn[h] + Solar_kWh[h] * exportTariff[h] )

- importTariffAllIn: energy + distribution + taxes + VAT (RON/kWh)
- exportTariff: forgone injection credit / market price for self-consumed PV (RON/kWh)
- Single-run savings = RunCost(baseline) − RunCost(optimal)
- CO₂ avoided prefers immediate-start delta; if ~0, falls back to evening-peak counterfactual
- Renewable share is the SEN grid mix (Solar/Hydro/Wind/Biomass), blended with rooftop PV
"""

from __future__ import annotations

import datetime
from dataclasses import dataclass
from typing import Mapping, Optional, Sequence

# Approximate RO household network + taxes + VAT layered on wholesale energy (RON/kWh).
_DISTRIBUTION_TAXES_VAT = 0.42
_FIXED_HOUSEHOLD_ALL_IN = 0.80
_EXPORT_FLOOR = 0.05
_FIXED_TARIFF_SAVINGS_EPS = 0.05
_FLAT_IMPORT_SPREAD = 0.08
# CO₂ delta below this (kg) is treated as "already optimal vs immediate start"
_CO2_DELTA_EPS_KG = 0.01
# Default evening peak window (Europe/Bucharest household peak)
_EVENING_PEAK_HOUR = 19

KG_CO2_PER_TREE_PER_MONTH = 1.75


@dataclass(frozen=True)
class HourlyDispatchSlice:
    hour: int
    load_kwh: float
    solar_kwh: float
    grid_kwh: float
    import_tariff_all_in: float
    export_tariff: float
    grid_carbon_g_per_kwh: float
    grid_renewable_share_percent: float


@dataclass(frozen=True)
class RunAccounting:
    run_cost_ron: float
    co2_grams: float
    grid_kwh_total: float
    solar_kwh_total: float
    renewable_share_percent: float
    slices: tuple[HourlyDispatchSlice, ...]


@dataclass(frozen=True)
class DispatchDelta:
    baseline: RunAccounting
    optimal: RunAccounting
    single_run_savings_ron: float
    co2_avoided_kg: float
    renewable_share_percent: float
    is_fixed_tariff: bool
    import_tariff_all_in: dict[int, float]
    export_tariff: dict[int, float]
    run_co2_kg: float
    co2_comparison_basis: str  # "immediate" | "evening_peak"
    is_already_optimal: bool
    peak_run_co2_kg: float


def build_import_tariff_all_in(wholesale_by_hour: Mapping[int, float]) -> dict[int, float]:
    if not wholesale_by_hour:
        return {h: _FIXED_HOUSEHOLD_ALL_IN for h in range(24)}

    values = [float(wholesale_by_hour.get(h, wholesale_by_hour.get(str(h), 0.4))) for h in range(24)]
    spread = max(values) - min(values)
    if spread < _FLAT_IMPORT_SPREAD:
        return {h: _FIXED_HOUSEHOLD_ALL_IN for h in range(24)}

    return {
        h: round(float(wholesale_by_hour.get(h, wholesale_by_hour.get(str(h), 0.4))) + _DISTRIBUTION_TAXES_VAT, 4)
        for h in range(24)
    }


def build_export_tariff(wholesale_by_hour: Mapping[int, float], *, prosumer: bool) -> dict[int, float]:
    if not prosumer:
        return {h: 0.0 for h in range(24)}
    if not wholesale_by_hour:
        return {h: 0.35 for h in range(24)}
    return {
        h: round(
            max(
                _EXPORT_FLOOR,
                float(wholesale_by_hour.get(h, wholesale_by_hour.get(str(h), 0.35))) * 0.95,
            ),
            4,
        )
        for h in range(24)
    }


def synthesize_grid_profiles(
    *,
    current_carbon_g: float,
    current_green_share_percent: float,
    scored_carbon_by_hour: Optional[Mapping[int, float]] = None,
    scored_green_by_hour: Optional[Mapping[int, float]] = None,
) -> tuple[dict[int, float], dict[int, float]]:
    """
    Build 24h carbon intensity + renewable mix curves.
    Uses scored optimizer hours when present; otherwise shapes a realistic daily profile
    so evening peak (19–21) is always distinguishable from midday clean hours.
    """
    base_ci = float(current_carbon_g) if current_carbon_g and current_carbon_g > 0 else 300.0
    base_green = float(current_green_share_percent) if current_green_share_percent is not None else 45.0
    # Never allow a dead-zero green share when SEN/mock reports active renewables elsewhere
    base_green = max(0.0, min(95.0, base_green))
    if base_green < 1.0:
        base_green = 45.0  # demosafe SEN fallback mix

    carbon: dict[int, float] = {}
    green: dict[int, float] = {}
    scored_c = scored_carbon_by_hour or {}
    scored_g = scored_green_by_hour or {}

    for h in range(24):
        if h in scored_c:
            carbon[h] = float(scored_c[h])
        elif 18 <= h <= 21:
            # Evening fossil peak
            carbon[h] = round(base_ci * 1.35 + 90.0, 2)
        elif 10 <= h <= 16:
            carbon[h] = round(max(80.0, base_ci * 0.78), 2)
        elif 0 <= h <= 5:
            carbon[h] = round(base_ci * 0.95, 2)
        else:
            carbon[h] = round(base_ci, 2)

        if h in scored_g:
            green[h] = float(scored_g[h])
        elif 10 <= h <= 16:
            green[h] = round(min(85.0, base_green * 1.2 + 5.0), 1)
        elif 18 <= h <= 21:
            green[h] = round(max(12.0, base_green * 0.65), 1)
        else:
            green[h] = round(base_green, 1)

    return carbon, green


def allocate_hour(
    hour: int,
    load_kwh: float,
    *,
    solar_kw_available: float,
    import_tariff: float,
    export_tariff: float,
    grid_carbon_g_per_kwh: float,
    grid_renewable_share_percent: float,
) -> HourlyDispatchSlice:
    solar_kwh = min(load_kwh, max(0.0, solar_kw_available))
    grid_kwh = max(0.0, load_kwh - solar_kwh)
    return HourlyDispatchSlice(
        hour=hour,
        load_kwh=load_kwh,
        solar_kwh=solar_kwh,
        grid_kwh=grid_kwh,
        import_tariff_all_in=import_tariff,
        export_tariff=export_tariff,
        grid_carbon_g_per_kwh=grid_carbon_g_per_kwh,
        grid_renewable_share_percent=grid_renewable_share_percent,
    )


def run_cost(slices: Sequence[HourlyDispatchSlice]) -> float:
    return sum(
        s.grid_kwh * s.import_tariff_all_in + s.solar_kwh * s.export_tariff
        for s in slices
    )


def run_co2_grams(slices: Sequence[HourlyDispatchSlice]) -> float:
    return sum(s.grid_kwh * s.grid_carbon_g_per_kwh for s in slices)


def effective_renewable_share(slices: Sequence[HourlyDispatchSlice]) -> float:
    """
    Load-weighted renewable share for the window:
    rooftop/solar self-consumption counts as 100% renewable;
    remaining grid kWh use the SEN green mix for that hour.
    Never collapses to 0% when the grid mix itself is green.
    """
    if not slices:
        return 0.0
    weighted = 0.0
    load_total = 0.0
    for s in slices:
        load = s.load_kwh
        if load <= 0:
            continue
        solar_frac = s.solar_kwh / load
        grid_frac = s.grid_kwh / load
        hour_share = solar_frac * 100.0 + grid_frac * max(0.0, s.grid_renewable_share_percent)
        weighted += hour_share * load
        load_total += load
    if load_total <= 0:
        # Fallback: plain average of grid mix on the slices
        return round(
            sum(max(0.0, s.grid_renewable_share_percent) for s in slices) / len(slices),
            1,
        )
    return round(weighted / load_total, 1)


def account_window(
    start_hour_sequence: Sequence[tuple[int, float]],
    *,
    power_kw: float,
    import_tariff_all_in: Mapping[int, float],
    export_tariff: Mapping[int, float],
    carbon_by_hour: Mapping[int, float],
    solar_kw_by_hour: Mapping[int, float],
    green_share_by_hour: Mapping[int, float],
) -> RunAccounting:
    slices: list[HourlyDispatchSlice] = []
    for hour, fraction in start_hour_sequence:
        h = int(hour) % 24
        load_kwh = max(0.0, power_kw * float(fraction))
        slices.append(
            allocate_hour(
                h,
                load_kwh,
                solar_kw_available=float(solar_kw_by_hour.get(h, 0.0)),
                import_tariff=float(import_tariff_all_in.get(h, _FIXED_HOUSEHOLD_ALL_IN)),
                export_tariff=float(export_tariff.get(h, 0.0)),
                grid_carbon_g_per_kwh=float(carbon_by_hour.get(h, 300.0)),
                grid_renewable_share_percent=float(green_share_by_hour.get(h, 45.0)),
            )
        )

    grid_total = sum(s.grid_kwh for s in slices)
    solar_total = sum(s.solar_kwh for s in slices)

    return RunAccounting(
        run_cost_ron=round(run_cost(slices), 4),
        co2_grams=round(run_co2_grams(slices), 4),
        grid_kwh_total=round(grid_total, 4),
        solar_kwh_total=round(solar_total, 4),
        renewable_share_percent=effective_renewable_share(slices),
        slices=tuple(slices),
    )


def hour_sequence_for_window(start, duration_hours: int) -> list[tuple[int, float]]:
    seq: list[tuple[int, float]] = []
    for h in range(max(1, int(duration_hours))):
        actual = (start + datetime.timedelta(hours=h)).hour
        seq.append((actual, 1.0))
    return seq


def evening_peak_start_for(optimal_start, duration_hours: int = 2) -> datetime.datetime:
    """Same calendar day as optimal, anchored at 19:00 (peak carbon hours)."""
    peak = optimal_start.replace(hour=_EVENING_PEAK_HOUR, minute=0, second=0, microsecond=0)
    # If optimal is already in/after the peak window, compare against next day's peak
    if peak <= optimal_start:
        peak = peak + datetime.timedelta(days=1)
    return peak


def compute_dispatch_delta(
    *,
    baseline_start,
    optimal_start,
    duration_hours: int,
    power_kw: float,
    user_type: str,
    wholesale_by_hour: Mapping[int, float],
    carbon_by_hour: Mapping[int, float],
    solar_kw_by_hour: Mapping[int, float],
    green_share_by_hour: Optional[Mapping[int, float]] = None,
) -> DispatchDelta:
    prosumer = (user_type or "").upper() == "PROSUMER"
    import_all_in = build_import_tariff_all_in(wholesale_by_hour)
    export = build_export_tariff(wholesale_by_hour, prosumer=prosumer)
    green = dict(green_share_by_hour or {})
    if not green:
        green = {h: 45.0 for h in range(24)}

    def _account(start) -> RunAccounting:
        return account_window(
            hour_sequence_for_window(start, duration_hours),
            power_kw=power_kw,
            import_tariff_all_in=import_all_in,
            export_tariff=export,
            carbon_by_hour=carbon_by_hour,
            solar_kw_by_hour=solar_kw_by_hour,
            green_share_by_hour=green,
        )

    baseline = _account(baseline_start)
    optimal = _account(optimal_start)
    peak_start = evening_peak_start_for(optimal_start, duration_hours)
    peak = _account(peak_start)

    savings = round(baseline.run_cost_ron - optimal.run_cost_ron, 4)
    immediate_co2_kg = round(max(0.0, baseline.co2_grams - optimal.co2_grams) / 1000.0, 4)
    peak_co2_kg = round(max(0.0, peak.co2_grams - optimal.co2_grams) / 1000.0, 4)
    run_co2_kg = round(optimal.co2_grams / 1000.0, 4)
    peak_run_co2_kg = round(peak.co2_grams / 1000.0, 4)

    already_optimal = immediate_co2_kg < _CO2_DELTA_EPS_KG
    if already_optimal and peak_co2_kg >= _CO2_DELTA_EPS_KG:
        co2_kg = peak_co2_kg
        basis = "evening_peak"
    elif already_optimal:
        co2_kg = 0.0
        basis = "evening_peak"  # still flag peak basis; UI shows affirmation + absolute footprint
    else:
        co2_kg = immediate_co2_kg
        basis = "immediate"

    # Renewable share: SEN-blended; floor with live mix so we never paint 0% on a green grid
    renewable = optimal.renewable_share_percent
    live_floor = max(green.get(h, 0.0) for h in range(24)) if green else 0.0
    if renewable < 1.0 and live_floor >= 1.0:
        # Window hours average of SEN mix (ignore rooftop-only zero for consumers)
        window_hours = [h for h, _ in hour_sequence_for_window(optimal_start, duration_hours)]
        renewable = round(
            sum(float(green.get(h, live_floor)) for h in window_hours) / max(len(window_hours), 1),
            1,
        )

    import_vals = list(import_all_in.values())
    flat_import = (max(import_vals) - min(import_vals)) < _FLAT_IMPORT_SPREAD
    is_fixed = flat_import or abs(savings) < _FIXED_TARIFF_SAVINGS_EPS

    return DispatchDelta(
        baseline=baseline,
        optimal=optimal,
        single_run_savings_ron=max(0.0, savings),
        co2_avoided_kg=co2_kg,
        renewable_share_percent=renewable,
        is_fixed_tariff=is_fixed,
        import_tariff_all_in=import_all_in,
        export_tariff=export,
        run_co2_kg=run_co2_kg,
        co2_comparison_basis=basis,
        is_already_optimal=already_optimal,
        peak_run_co2_kg=peak_run_co2_kg,
    )


def trees_equivalent(co2_avoided_kg: float) -> float:
    if co2_avoided_kg <= 0:
        return 0.0
    return round(co2_avoided_kg / KG_CO2_PER_TREE_PER_MONTH, 2)
