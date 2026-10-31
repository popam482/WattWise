import {useState, useEffect, useMemo} from 'react';
import {CloudSun, Sun, Activity} from 'lucide-react';
import EnergyForecastWidget from './EnergyForecastWidget.jsx';

const SIBIU_LAT = 45.7983;
const SIBIU_LON = 24.1256;
const DEFAULT_KWP = 5;
const PERFORMANCE_FACTOR = 0.8;

const metricCard =
    'rounded-xl border border-emerald-100/80 bg-white p-3 shadow-sm shadow-emerald-900/5 dark:border-slate-800 dark:bg-slate-950/50 dark:shadow-none';
const labelCls = 'text-xs text-slate-600 dark:text-slate-400';
const valueBase = 'mt-1 text-xl font-bold';

function WeatherSolarWidget({
    energyProfile,
    latitude,
    longitude,
    pvSystemKw,
    isProsumer = false,
    carbonIntensity = null,
    greenSharePercent = null
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

    if (loading && forecastData.length === 0) {
        return (
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400">
                        <CloudSun className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-semibold text-emerald-950 dark:text-slate-100">
                        {isProsumer ? 'Solar & Weather Overview' : 'Local Weather & Grid Outlook'}
                    </h3>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                    {isProsumer ? 'Loading weather & solar forecast…' : 'Loading local weather for your home location…'}
                </p>
            </div>
        );
    }

    const weatherMetrics = isProsumer
        ? [
            {label: 'Current Temp', value: `${current?.Temp_C ?? '—'}°C`, accent: 'text-blue-700 dark:text-blue-400'},
            {label: 'Irradiance', value: `${current?.Irradiance_W_m2 ?? '—'} W/m²`, accent: 'text-emerald-700 dark:text-emerald-400'},
            {label: 'Cloud Coverage', value: `${current?.Cloud_Cover ?? '—'} %`, accent: 'text-slate-800 dark:text-slate-200'},
            {label: 'Estimated PV', value: `${current?.Estimated_PV_Power_kW ?? '—'} kW`, accent: 'text-emerald-700 dark:text-emerald-400'}
        ]
        : [
            {label: 'Current Temp', value: `${current?.Temp_C ?? '—'}°C`, accent: 'text-blue-700 dark:text-blue-400'},
            {label: 'Cloud Coverage', value: `${current?.Cloud_Cover ?? '—'} %`, accent: 'text-slate-800 dark:text-slate-200'},
            {label: 'Irradiance', value: `${current?.Irradiance_W_m2 ?? '—'} W/m²`, accent: 'text-slate-800 dark:text-slate-200'},
            {
                label: 'Grid Carbon Now',
                value: carbonIntensity != null ? `${carbonIntensity} g` : '—',
                accent: 'text-emerald-700 dark:text-emerald-400'
            }
        ];

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                        isProsumer
                            ? 'border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400'
                            : 'border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-400'
                    }`}>
                        {isProsumer ? <Sun className="h-5 w-5" /> : <CloudSun className="h-5 w-5" />}
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-emerald-950 dark:text-slate-100">
                            {isProsumer ? 'Solar & Weather Overview' : 'Local Weather & Grid Outlook'}
                        </h3>
                        {!isProsumer && (
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                                Temperature & cloud coverage for energy-aware scheduling — no PV capacity shown
                            </p>
                        )}
                    </div>
                </div>
                {(degraded || usingFallbackLocation) && (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-400">
                        {degraded
                            ? 'Using local weather estimate'
                            : 'Sibiu fallback until profile loads'}
                    </span>
                )}
            </div>

            {isProsumer && (
                <div className="rounded-xl border border-emerald-100/80 bg-emerald-50/50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                    <h4 className="mb-3 text-sm font-medium text-slate-800 dark:text-slate-300">PV System Profile</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                        <div>
                            <p className="text-slate-600 dark:text-slate-400">Capacity</p>
                            <p className="font-semibold text-emerald-950 dark:text-slate-100">{resolvedKwp} kWp</p>
                        </div>
                        <div>
                            <p className="text-slate-600 dark:text-slate-400">Tilt</p>
                            <p className="font-semibold text-emerald-950 dark:text-slate-100">
                                {energyProfile?.tilt != null ? `${energyProfile.tilt}°` : 'N/A'}
                            </p>
                        </div>
                        <div>
                            <p className="text-slate-600 dark:text-slate-400">Azimuth</p>
                            <p className="font-semibold text-emerald-950 dark:text-slate-100">
                                {getCardinalOrientation(energyProfile?.azimuth ?? energyProfile?.azimuth_deg)}
                            </p>
                        </div>
                        <div>
                            <p className="text-slate-600 dark:text-slate-400">Location</p>
                            <p className="font-semibold text-emerald-950 dark:text-slate-100">
                                {resolvedLat.toFixed(4)}°, {resolvedLon.toFixed(4)}°
                                {usingFallbackLocation ? ' (Sibiu)' : ''}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {!isProsumer && (
                <div className="rounded-xl border border-sky-200/80 bg-gradient-to-r from-sky-50/80 to-emerald-50/60 p-4 dark:border-blue-500/20 dark:from-blue-950/40 dark:to-emerald-950/30">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-emerald-950 dark:text-slate-100">
                            <Activity className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            Local Weather & Grid Outlook
                        </div>
                        <span className="rounded-full border border-blue-200 bg-blue-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-800 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-400">
                            {usingFallbackLocation ? 'Sibiu default' : 'Profile coords'}
                        </span>
                    </div>
                    <p className="mb-3 text-xs text-slate-600 dark:text-slate-400">
                        Home location: {resolvedLat.toFixed(4)}°, {resolvedLon.toFixed(4)}°
                        {usingFallbackLocation ? ' (Sibiu default)' : ''}
                    </p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {weatherMetrics.map(metric => (
                            <div key={metric.label} className={metricCard}>
                                <p className={labelCls}>{metric.label}</p>
                                <p className={`${valueBase} ${metric.accent}`}>{metric.value}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {isProsumer && (
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {weatherMetrics.map(metric => (
                        <div key={metric.label} className={metricCard}>
                            <p className={labelCls}>{metric.label}</p>
                            <p className={`${valueBase} ${metric.accent}`}>{metric.value}</p>
                        </div>
                    ))}
                </div>
            )}

            <EnergyForecastWidget
                isProsumer={isProsumer}
                hourlyWeather={nextHours}
                carbonIntensity={carbonIntensity}
                greenSharePercent={greenSharePercent}
            />
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
