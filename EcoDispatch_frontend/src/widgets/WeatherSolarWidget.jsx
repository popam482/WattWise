import {useState, useEffect, useMemo} from 'react';
import {CloudSun, Sun, Activity} from 'lucide-react';

const SIBIU_LAT = 45.7983;
const SIBIU_LON = 24.1256;
const DEFAULT_KWP = 5;
const PERFORMANCE_FACTOR = 0.8;

function WeatherSolarWidget({
    energyProfile,
    latitude,
    longitude,
    pvSystemKw,
    isProsumer = false,
    carbonIntensity = null
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
        if (!isProsumer) return 0;
        const value = pvSystemKw ?? energyProfile?.pvSystemKw ?? energyProfile?.pv_system_kw;
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_KWP;
    }, [pvSystemKw, energyProfile, isProsumer]);

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
                    const estimatedPv = isProsumer
                        ? (irradiance / 1000) * resolvedKwp * PERFORMANCE_FACTOR
                        : 0;

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
                setForecastData(buildFallbackForecast(resolvedKwp, isProsumer));
                setDegraded(true);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [resolvedLat, resolvedLon, resolvedKwp, isProsumer]);

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
        : buildFallbackForecast(resolvedKwp, isProsumer);

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

    const carbonTimeline = useMemo(() => {
        const base = Number.isFinite(Number(carbonIntensity)) ? Number(carbonIntensity) : 280;
        return nextHours.map((item) => {
            const hour = new Date(item.Time).getHours();
            const clouds = Number(item.Cloud_Cover);
            const cloudFactor = Number.isFinite(clouds) ? clouds / 100 : 0.4;
            // Midday renewables tend to lower intensity; evening peaks raise it.
            const diurnal = hour >= 11 && hour <= 16 ? -55 : (hour >= 18 || hour <= 7 ? 45 : 0);
            const value = Math.max(80, Math.round(base + diurnal + cloudFactor * 40));
            return {
                Time: item.Time,
                hourLabel: hour.toString().padStart(2, '0'),
                value
            };
        });
    }, [nextHours, carbonIntensity]);

    const maxCarbon = Math.max(1, ...carbonTimeline.map(item => item.value));

    if (loading && forecastData.length === 0) {
        return (
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                        <CloudSun className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-100">
                        {isProsumer ? 'Solar & Weather Overview' : 'Local Weather Overview'}
                    </h3>
                </div>
                <p className="text-sm text-slate-400">
                    {isProsumer ? 'Loading weather & solar forecast…' : 'Loading local weather…'}
                </p>
            </div>
        );
    }

    const weatherMetrics = isProsumer
        ? [
            {label: 'Current Temp', value: `${current?.Temp_C ?? '—'}°C`, accent: 'text-blue-400'},
            {label: 'Irradiance', value: `${current?.Irradiance_W_m2 ?? '—'} W/m²`, accent: 'text-emerald-400'},
            {label: 'Cloud Coverage', value: `${current?.Cloud_Cover ?? '—'} %`, accent: 'text-slate-200'},
            {label: 'Estimated PV', value: `${current?.Estimated_PV_Power_kW ?? '—'} kW`, accent: 'text-emerald-400'}
        ]
        : [
            {label: 'Current Temp', value: `${current?.Temp_C ?? '—'}°C`, accent: 'text-blue-400'},
            {label: 'Cloud Coverage', value: `${current?.Cloud_Cover ?? '—'} %`, accent: 'text-slate-200'},
            {label: 'Irradiance', value: `${current?.Irradiance_W_m2 ?? '—'} W/m²`, accent: 'text-slate-200'},
            {
                label: 'Grid Carbon Now',
                value: carbonIntensity != null ? `${carbonIntensity} g` : '—',
                accent: 'text-emerald-400'
            }
        ];

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                        isProsumer
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                            : 'border-blue-500/30 bg-blue-500/10 text-blue-400'
                    }`}>
                        {isProsumer ? <Sun className="h-5 w-5" /> : <CloudSun className="h-5 w-5" />}
                    </div>
                    <h3 className="text-lg font-semibold text-slate-100">
                        {isProsumer ? 'Solar & Weather Overview' : 'Local Weather Overview'}
                    </h3>
                </div>
                {(degraded || usingFallbackLocation) && (
                    <span className="rounded-full border border-slate-700 bg-slate-950/50 px-3 py-1 text-xs text-slate-400">
                        {degraded
                            ? 'Using local weather estimate'
                            : 'Sibiu fallback until profile loads'}
                    </span>
                )}
            </div>

            {isProsumer && (
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
            )}

            {!isProsumer && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                    <div className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-300">
                        <Activity className="h-4 w-4 text-emerald-400" />
                        Location
                    </div>
                    <p className="text-sm text-slate-400">
                        {resolvedLat.toFixed(4)}°, {resolvedLon.toFixed(4)}°
                        {usingFallbackLocation ? ' (Sibiu default)' : ''}
                    </p>
                </div>
            )}

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {weatherMetrics.map(metric => (
                    <div
                        key={metric.label}
                        className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"
                    >
                        <p className="text-xs text-slate-500">{metric.label}</p>
                        <p className={`mt-1 text-xl font-bold ${metric.accent}`}>{metric.value}</p>
                    </div>
                ))}
            </div>

            {isProsumer && nextHours.length > 0 && (
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

            {!isProsumer && carbonTimeline.length > 0 && (
                <div>
                    <h4 className="mb-3 text-sm font-medium text-slate-300">Grid Carbon Intensity Timeline</h4>
                    <div
                        className="grid items-end gap-1.5"
                        style={{gridTemplateColumns: `repeat(${carbonTimeline.length}, minmax(0, 1fr))`, minHeight: 110}}
                    >
                        {carbonTimeline.map((item) => {
                            const height = Math.max(8, Math.round((item.value / maxCarbon) * 100));
                            const tone = item.value < 200
                                ? 'from-emerald-400 to-emerald-700'
                                : item.value < 350
                                    ? 'from-amber-400 to-amber-700'
                                    : 'from-rose-400 to-rose-700';
                            return (
                                <div key={item.Time} className="text-center">
                                    <div
                                        title={`${item.value} gCO₂/kWh`}
                                        className={`mx-auto mb-1.5 w-full max-w-[18px] rounded-t-md bg-gradient-to-b ${tone}`}
                                        style={{height: `${height}px`}}
                                    />
                                    <div className="text-[10px] text-slate-500">{item.hourLabel}</div>
                                </div>
                            );
                        })}
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                        Near-term SEN carbon outlook (gCO₂/kWh) — schedule flexible loads in the greener hours.
                    </p>
                </div>
            )}
        </div>
    );
}

function buildFallbackForecast(kwp, isProsumer) {
    const now = new Date();
    return Array.from({length: 24}, (_, hour) => {
        const distance = Math.abs(13 - hour);
        const irradiance = hour >= 6 && hour <= 20
            ? Math.max(0, 900 * (1 - distance * 0.12))
            : 0;
        const pv = isProsumer ? (irradiance / 1000) * kwp * PERFORMANCE_FACTOR : 0;
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
