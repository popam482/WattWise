import {useState, useEffect, useMemo} from 'react';
import {CloudSun, Sun} from 'lucide-react';

const SIBIU_LAT = 45.7983;
const SIBIU_LON = 24.1256;
const DEFAULT_KWP = 5;
const PERFORMANCE_FACTOR = 0.8;

function WeatherSolarWidget({
    energyProfile,
    latitude,
    longitude,
    pvSystemKw
}) {
    const [forecastData, setForecastData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [degraded, setDegraded] = useState(false);

    const resolvedLat = useMemo(() => {
        const value = latitude ?? energyProfile?.latitude ?? energyProfile?.lat;
        return Number.isFinite(Number(value)) ? Number(value) : SIBIU_LAT;
    }, [latitude, energyProfile]);

    const resolvedLon = useMemo(() => {
        const value = longitude ?? energyProfile?.longitude ?? energyProfile?.lon;
        return Number.isFinite(Number(value)) ? Number(value) : SIBIU_LON;
    }, [longitude, energyProfile]);

    const resolvedKwp = useMemo(() => {
        const value = pvSystemKw ?? energyProfile?.pvSystemKw ?? energyProfile?.pv_system_kw;
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_KWP;
    }, [pvSystemKw, energyProfile]);

    const usingFallbackLocation = !(
        Number.isFinite(Number(latitude ?? energyProfile?.latitude ?? energyProfile?.lat)) &&
        Number.isFinite(Number(longitude ?? energyProfile?.longitude ?? energyProfile?.lon))
    );

    useEffect(() => {
        let cancelled = false;
        const controller = new AbortController();

        const url = new URL('https://api.open-meteo.com/v1/forecast');
        url.searchParams.set('latitude', String(resolvedLat));
        url.searchParams.set('longitude', String(resolvedLon));
        url.searchParams.set('hourly', 'shortwave_radiation,temperature_2m,cloud_cover');
        url.searchParams.set('timezone', 'auto');
        url.searchParams.set('forecast_days', '2');

        setLoading(true);

        fetch(url.toString(), {signal: controller.signal})
            .then(async res => {
                if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
                return res.json();
            })
            .then(weather => {
                if (cancelled) return;
                const hourly = weather?.hourly;
                if (!hourly?.time?.length) throw new Error('Incomplete Open-Meteo payload');

                const rows = hourly.time.map((time, index) => {
                    const irradiance = Number(hourly.shortwave_radiation?.[index]) || 0;
                    const temp = Number(hourly.temperature_2m?.[index]);
                    const clouds = Number(hourly.cloud_cover?.[index]);
                    const estimatedPv = (irradiance / 1000) * resolvedKwp * PERFORMANCE_FACTOR;

                    return {
                        Time: time,
                        Temp_C: Number.isFinite(temp) ? Math.round(temp * 10) / 10 : null,
                        Irradiance_W_m2: Math.round(irradiance),
                        Cloud_Cover: Number.isFinite(clouds) ? Math.round(clouds) : null,
                        Estimated_PV_Power_kW: Math.round(estimatedPv * 100) / 100
                    };
                });

                setForecastData(rows);
                setDegraded(false);
            })
            .catch(err => {
                if (cancelled || err?.name === 'AbortError') return;
                console.error('Open-Meteo forecast error:', err);
                setForecastData(buildFallbackForecast(resolvedKwp));
                setDegraded(true);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [resolvedLat, resolvedLon, resolvedKwp]);

    const getCardinalOrientation = (azimuth) => {
        if (azimuth === undefined || azimuth === null) return 'N/A';
        const normalized = (azimuth % 360 + 360) % 360;
        if (normalized >= 337.5 || normalized < 22.5) return 'North (0°)';
        if (normalized >= 22.5 && normalized < 67.5) return 'North-East (45°)';
        if (normalized >= 67.5 && normalized < 112.5) return 'East (90°)';
        if (normalized >= 112.5 && normalized < 157.5) return 'South-East (135°)';
        if (normalized >= 157.5 && normalized < 202.5) return 'South (180°)';
        if (normalized >= 202.5 && normalized < 247.5) return 'South-West (225°)';
        if (normalized >= 247.5 && normalized < 292.5) return 'West (270°)';
        return 'North-West (315°)';
    };

    const displayForecast = forecastData.length > 0
        ? forecastData
        : buildFallbackForecast(resolvedKwp);

    const currentHour = new Date().getHours();
    const current = displayForecast.find(item => new Date(item.Time).getHours() === currentHour)
        || displayForecast[0];

    const nextHours = displayForecast
        .filter(item => {
            const h = new Date(item.Time).getHours();
            return h >= currentHour && h < currentHour + 12;
        })
        .slice(0, 12);

    const maxPv = Math.max(
        0.1,
        ...nextHours.map(item => Number(item.Estimated_PV_Power_kW) || 0)
    );

    if (loading && forecastData.length === 0) {
        return (
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                        <CloudSun className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-100">Solar & Weather Overview</h3>
                </div>
                <p className="text-sm text-slate-400">Loading weather & solar forecast…</p>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                        <Sun className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-100">Solar & Weather Overview</h3>
                </div>
                {(degraded || usingFallbackLocation) && (
                    <span className="rounded-full border border-slate-700 bg-slate-950/50 px-3 py-1 text-xs text-slate-400">
                        {degraded
                            ? 'Using local solar estimate'
                            : 'Sibiu fallback until profile loads'}
                    </span>
                )}
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <h4 className="mb-3 text-sm font-medium text-slate-300">PV System Profile</h4>
                <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                    <div>
                        <p className="text-slate-500">Capacity</p>
                        <p className="font-semibold text-slate-100">{resolvedKwp} kWp</p>
                    </div>
                    <div>
                        <p className="text-slate-500">Tilt</p>
                        <p className="font-semibold text-slate-100">
                            {energyProfile?.tilt != null ? `${energyProfile.tilt}°` : 'N/A'}
                        </p>
                    </div>
                    <div>
                        <p className="text-slate-500">Azimuth</p>
                        <p className="font-semibold text-slate-100">
                            {getCardinalOrientation(energyProfile?.azimuth ?? energyProfile?.azimuth_deg)}
                        </p>
                    </div>
                    <div>
                        <p className="text-slate-500">Location</p>
                        <p className="font-semibold text-slate-100">
                            {resolvedLat.toFixed(4)}°, {resolvedLon.toFixed(4)}°
                            {usingFallbackLocation ? ' (Sibiu)' : ''}
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                    {label: 'Current Temp', value: `${current?.Temp_C ?? '—'}°C`, accent: 'text-blue-400'},
                    {label: 'Irradiance', value: `${current?.Irradiance_W_m2 ?? '—'} W/m²`, accent: 'text-emerald-400'},
                    {label: 'Cloud Coverage', value: `${current?.Cloud_Cover ?? '—'} %`, accent: 'text-slate-200'},
                    {label: 'Estimated PV', value: `${current?.Estimated_PV_Power_kW ?? '—'} kW`, accent: 'text-emerald-400'}
                ].map(metric => (
                    <div
                        key={metric.label}
                        className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"
                    >
                        <p className="text-xs text-slate-500">{metric.label}</p>
                        <p className={`mt-1 text-xl font-bold ${metric.accent}`}>{metric.value}</p>
                    </div>
                ))}
            </div>

            {nextHours.length > 0 && (
                <div>
                    <h4 className="mb-3 text-sm font-medium text-slate-300">Near-term solar production</h4>
                    <div
                        className="grid items-end gap-1.5"
                        style={{gridTemplateColumns: `repeat(${nextHours.length}, minmax(0, 1fr))`, minHeight: 110}}
                    >
                        {nextHours.map((item) => {
                            const pv = Number(item.Estimated_PV_Power_kW) || 0;
                            const height = Math.max(6, Math.round((pv / maxPv) * 100));
                            const hourLabel = new Date(item.Time).getHours().toString().padStart(2, '0');
                            return (
                                <div key={item.Time} className="text-center">
                                    <div
                                        title={`${pv} kW`}
                                        className="mx-auto mb-1.5 w-full max-w-[18px] rounded-t-md bg-gradient-to-b from-emerald-400 to-emerald-700"
                                        style={{height: `${height}px`}}
                                    />
                                    <div className="text-[10px] text-slate-500">{hourLabel}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

function buildFallbackForecast(kwp) {
    const now = new Date();
    return Array.from({length: 24}, (_, hour) => {
        const distance = Math.abs(13 - hour);
        const irradiance = hour >= 6 && hour <= 20
            ? Math.max(0, 900 * (1 - distance * 0.12))
            : 0;
        const pv = (irradiance / 1000) * kwp * PERFORMANCE_FACTOR;
        const stamp = new Date(now);
        stamp.setHours(hour, 0, 0, 0);
        return {
            Time: stamp.toISOString(),
            Temp_C: 18 + Math.max(0, 8 - distance),
            Irradiance_W_m2: Math.round(irradiance),
            Cloud_Cover: Math.min(90, Math.round(distance * 8)),
            Estimated_PV_Power_kW: Math.round(pv * 100) / 100,
            _fallback: true
        };
    });
}

export default WeatherSolarWidget;
