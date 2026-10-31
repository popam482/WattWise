import {useEffect, useMemo, useState} from 'react';
import {Activity, Leaf, Pause, Play, Sun, TrendingUp, Wind} from 'lucide-react';

const TABS = [
    {id: 'generation', label: 'Generation Forecast'},
    {id: 'price', label: 'Market Electricity Price'},
    {id: 'carbon', label: 'Carbon Intensity'}
];

const EUR_TO_RON = 4.97;
const AUTO_ROTATE_MS = 8000;
const PRICE_CACHE_KEY = 'wattwise_energy_prices';
const PRICE_CACHE_TTL_MS = 60 * 60 * 1000;

/** Module-level guard so StrictMode / remounts never stampede Energy-Charts. */
let priceFetchInFlight = null;

function readPriceCache() {
    try {
        const raw = localStorage.getItem(PRICE_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed?.fetchedAt || !parsed?.payload) return null;
        return parsed;
    } catch {
        return null;
    }
}

function writePriceCache(payload) {
    try {
        localStorage.setItem(PRICE_CACHE_KEY, JSON.stringify({
            fetchedAt: Date.now(),
            payload
        }));
    } catch {
        /* quota / private mode — ignore */
    }
}

function mapPricePayload(payload, limit = 12) {
    const times = payload?.unix_seconds || [];
    const prices = payload?.price || [];
    if (!times.length || !prices.length) return [];

    const nowMs = Date.now();
    const mapped = times.map((unix, index) => {
        const stamp = new Date(unix * 1000);
        const eurPerMwh = Number(prices[index]);
        if (!Number.isFinite(eurPerMwh)) return null;
        const ronPerKwh = Math.round(((eurPerMwh * EUR_TO_RON) / 1000) * 1000) / 1000;
        return {
            Time: stamp.toISOString(),
            hourLabel: stamp.getHours().toString().padStart(2, '0'),
            ts: stamp.getTime(),
            eurPerMwh: Math.round(eurPerMwh),
            ronPerKwh
        };
    }).filter(Boolean);

    const upcoming = mapped.filter((row) => row.ts >= nowMs - 30 * 60 * 1000).slice(0, limit);
    return upcoming.length >= 6 ? upcoming : mapped.slice(0, limit);
}

/**
 * Realistic RO day-ahead shaped tariff (RON/kWh):
 * morning/evening peaks ~0.85, midday solar dunkelflaute relief ~0.25, overnight ~0.45.
 */
function buildTariffFallback(hours) {
    return hours.map((item) => {
        const hour = new Date(item.Time).getHours();
        let ronPerKwh = 0.55;
        if ((hour >= 8 && hour < 11) || (hour >= 18 && hour < 22)) ronPerKwh = 0.85;
        else if (hour >= 11 && hour < 16) ronPerKwh = 0.25;
        else if (hour >= 22 || hour < 6) ronPerKwh = 0.45;
        return {
            Time: item.Time,
            hourLabel: hour.toString().padStart(2, '0'),
            ronPerKwh,
            eurPerMwh: Math.round((ronPerKwh / EUR_TO_RON) * 1000)
        };
    });
}

function buildDefaultHourSlots(count = 12) {
    const now = new Date();
    return Array.from({length: count}, (_, i) => {
        const stamp = new Date(now);
        stamp.setHours(now.getHours() + i, 0, 0, 0);
        return {Time: stamp.toISOString()};
    });
}

async function fetchEnergyChartsPricePayload() {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const fmt = (d) => d.toISOString().slice(0, 10);
    // Bidding zone RO (not country=ro) — country param is invalid on /price
    const url = `/energy-charts/price?bzn=RO&start=${fmt(today)}&end=${fmt(tomorrow)}`;

    const res = await fetch(url);
    if (res.status === 429) {
        const err = new Error('Energy-Charts HTTP 429');
        err.status = 429;
        throw err;
    }
    if (!res.ok) {
        const err = new Error(`Energy-Charts HTTP ${res.status}`);
        err.status = res.status;
        throw err;
    }
    const payload = await res.json();
    if (!payload?.unix_seconds?.length || !payload?.price?.length) {
        throw new Error('Empty price payload');
    }
    return payload;
}

function buildRenewableShareSeries(hours, greenSharePercent) {
    const base = Number.isFinite(Number(greenSharePercent)) ? Number(greenSharePercent) : 42;
    return hours.map((item) => {
        const hour = new Date(item.Time).getHours();
        const clouds = Number(item.Cloud_Cover);
        const cloudFactor = Number.isFinite(clouds) ? clouds / 100 : 0.35;
        // Midday solar lifts renewable share; night leans on wind/hydro surplus.
        const solarLift = hour >= 10 && hour <= 16 ? 12 * (1 - cloudFactor) : 0;
        const windHydro = hour >= 22 || hour <= 6 ? 8 : (hour >= 17 ? -4 : 2);
        const value = Math.max(18, Math.min(85, Math.round(base + solarLift + windHydro - cloudFactor * 6)));
        return {
            Time: item.Time,
            hourLabel: hour.toString().padStart(2, '0'),
            value
        };
    });
}

function buildCarbonSeries(hours, carbonIntensity) {
    const base = Number.isFinite(Number(carbonIntensity)) ? Number(carbonIntensity) : 280;
    return hours.map((item) => {
        const hour = new Date(item.Time).getHours();
        const clouds = Number(item.Cloud_Cover);
        const cloudFactor = Number.isFinite(clouds) ? clouds / 100 : 0.4;
        const diurnal = hour >= 11 && hour <= 16 ? -55 : (hour >= 18 || hour <= 7 ? 45 : 0);
        const value = Math.max(80, Math.round(base + diurnal + cloudFactor * 40));
        return {
            Time: item.Time,
            hourLabel: hour.toString().padStart(2, '0'),
            value
        };
    });
}

function carbonBarTone(value) {
    if (value < 200) return 'from-emerald-400 to-emerald-700';
    if (value < 350) return 'from-amber-400 to-amber-600';
    return 'from-rose-400 to-rose-700';
}

function EnergyForecastWidget({
    isProsumer = false,
    hourlyWeather = [],
    carbonIntensity = null,
    greenSharePercent = null
}) {
    const [activeTab, setActiveTab] = useState('generation');
    const [autoRotate, setAutoRotate] = useState(true);
    /** Raw Energy-Charts payload (or null when using local tariff curve). */
    const [pricePayload, setPricePayload] = useState(null);
    /** 'loading' | 'live' | 'cached' | 'optimized' */
    const [priceStatus, setPriceStatus] = useState('loading');

    const hours = useMemo(() => {
        if (Array.isArray(hourlyWeather) && hourlyWeather.length > 0) {
            return hourlyWeather.slice(0, 12);
        }
        return buildDefaultHourSlots(12).map((slot) => ({
            ...slot,
            Cloud_Cover: 40,
            Estimated_PV_Power_kW: 0
        }));
    }, [hourlyWeather]);

    useEffect(() => {
        if (!autoRotate) return undefined;
        const id = setInterval(() => {
            setActiveTab((prev) => {
                const idx = TABS.findIndex((tab) => tab.id === prev);
                return TABS[(idx + 1) % TABS.length].id;
            });
        }, AUTO_ROTATE_MS);
        return () => clearInterval(id);
    }, [autoRotate]);

    // Fetch Energy-Charts ONCE on mount — never re-fire on weather ticks / tab rotation.
    useEffect(() => {
        let cancelled = false;

        const applyPayload = (payload, status) => {
            if (cancelled) return;
            setPricePayload(payload);
            setPriceStatus(status);
        };

        const applyOptimizedFallback = () => {
            if (cancelled) return;
            setPricePayload(null);
            setPriceStatus('optimized');
        };

        const bootstrap = async () => {
            const cached = readPriceCache();
            const cacheAge = cached ? Date.now() - cached.fetchedAt : Infinity;
            const cacheFresh = Boolean(cached?.payload) && cacheAge < PRICE_CACHE_TTL_MS;

            // Fresh cache: serve immediately and skip the network entirely
            if (cacheFresh) {
                applyPayload(cached.payload, 'cached');
                return;
            }

            // Stale cache: show it first while we attempt a quiet refresh
            if (cached?.payload) {
                applyPayload(cached.payload, 'cached');
            }

            try {
                if (!priceFetchInFlight) {
                    priceFetchInFlight = fetchEnergyChartsPricePayload()
                        .finally(() => {
                            priceFetchInFlight = null;
                        });
                }
                const payload = await priceFetchInFlight;
                writePriceCache(payload);
                applyPayload(payload, 'live');
            } catch {
                // Swallow 429 / network errors — keep stale cache or RO tariff curve
                if (cached?.payload) {
                    applyPayload(cached.payload, 'cached');
                } else {
                    applyOptimizedFallback();
                }
            }
        };

        bootstrap();

        return () => {
            cancelled = true;
        };
    }, []);

    const generationSeries = useMemo(() => {
        if (isProsumer) {
            return hours.map((item) => {
                const hour = new Date(item.Time).getHours();
                const pv = Number(item.Estimated_PV_Power_kW) || 0;
                return {
                    Time: item.Time,
                    hourLabel: hour.toString().padStart(2, '0'),
                    value: pv,
                    unit: 'kW'
                };
            });
        }
        return buildRenewableShareSeries(hours, greenSharePercent).map((row) => ({
            ...row,
            unit: '%'
        }));
    }, [hours, isProsumer, greenSharePercent]);

    const carbonSeries = useMemo(
        () => buildCarbonSeries(hours, carbonIntensity),
        [hours, carbonIntensity]
    );

    const priceSeries = useMemo(() => {
        if (pricePayload) {
            const mapped = mapPricePayload(pricePayload, 12);
            if (mapped.length > 0) return mapped;
        }
        return buildTariffFallback(hours);
    }, [pricePayload, hours]);

    const priceBadge = {
        loading: {label: 'Loading…', className: 'border-slate-700 bg-slate-950/50 text-slate-400'},
        live: {label: 'LIVE · Energy-Charts', className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'},
        cached: {label: 'Cached / Optimized', className: 'border-blue-500/30 bg-blue-500/10 text-blue-300'},
        optimized: {label: 'Cached / Optimized', className: 'border-amber-500/30 bg-amber-500/10 text-amber-300'}
    }[priceStatus] || {label: 'Cached / Optimized', className: 'border-slate-700 bg-slate-950/50 text-slate-400'};

    const selectTab = (tabId) => {
        setActiveTab(tabId);
        setAutoRotate(false);
    };

    const activeMeta = {
        generation: {
            title: isProsumer ? 'PV Production Forecast' : 'SEN Renewable Share Forecast',
            subtitle: isProsumer
                ? 'Local solar production (kW) from irradiance × your PV capacity'
                : 'National grid renewable surplus outlook (wind / hydro / solar mix)',
            icon: isProsumer ? Sun : Wind,
            accent: isProsumer ? 'text-emerald-400' : 'text-blue-400'
        },
        price: {
            title: priceStatus === 'live'
                ? 'Day-Ahead Spot Price'
                : 'Day-Ahead Spot Price (Cached/Optimized)',
            subtitle: priceStatus === 'live'
                ? 'Energy-Charts RO bidding zone · RON/kWh (EUR/MWh)'
                : priceStatus === 'cached'
                    ? 'Serving 1-hour local cache · avoids Energy-Charts rate limits'
                    : 'RO peak / solar-dunkelflaute tariff curve · demo-safe',
            icon: TrendingUp,
            accent: 'text-amber-300'
        },
        carbon: {
            title: 'Grid Carbon Intensity',
            subtitle: 'SEN footprint outlook (gCO₂/kWh) — greener bars favor flexible loads',
            icon: Leaf,
            accent: 'text-emerald-400'
        }
    }[activeTab];

    const Icon = activeMeta.icon;

    return (
        <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-1 rounded-xl border border-slate-800 bg-slate-900/80 p-1">
                    {TABS.map((tab) => {
                        const selected = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => selectTab(tab.id)}
                                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition sm:text-[13px] ${
                                    selected
                                        ? 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
                                        : 'border border-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                                }`}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                <button
                    type="button"
                    onClick={() => setAutoRotate((v) => !v)}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
                        autoRotate
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                            : 'border-slate-700 bg-slate-950/60 text-slate-400 hover:bg-slate-800'
                    }`}
                    aria-pressed={autoRotate}
                >
                    {autoRotate ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    Auto-rotate views [{autoRotate ? 'ON' : 'OFF'}]
                </button>
            </div>

            <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-900/80 ${activeMeta.accent}`}>
                        <Icon className="h-4 w-4" />
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold text-slate-100">{activeMeta.title}</h4>
                        <p className="text-xs text-slate-500">{activeMeta.subtitle}</p>
                    </div>
                </div>
                {activeTab === 'price' && (
                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${priceBadge.className}`}>
                        {priceBadge.label}
                    </span>
                )}
                {activeTab === 'generation' && !isProsumer && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-300">
                        <Activity className="h-3 w-3" />
                        SEN Grid
                    </span>
                )}
            </div>

            {activeTab === 'generation' && (
                <ForecastBars
                    series={generationSeries}
                    getValue={(row) => row.value}
                    getLabel={(row) => row.hourLabel}
                    getTitle={(row) => isProsumer
                        ? `${row.value.toFixed(2)} kW`
                        : `${row.value}% renewable`}
                    maxFallback={isProsumer ? 0.1 : 100}
                    barClass={isProsumer
                        ? 'bg-gradient-to-b from-emerald-400 to-emerald-700'
                        : 'bg-gradient-to-b from-blue-400 to-blue-700'}
                    footer={isProsumer
                        ? 'Schedule flexible loads when your rooftop PV peaks.'
                        : 'Favor appliance runs when SEN renewable share is highest — no rooftop solar assumed.'}
                />
            )}

            {activeTab === 'price' && (
                <ForecastBars
                    series={priceSeries}
                    getValue={(row) => row.ronPerKwh}
                    getLabel={(row) => row.hourLabel}
                    getTitle={(row) => `${row.ronPerKwh.toFixed(3)} RON/kWh${row.eurPerMwh != null ? ` · ${row.eurPerMwh} EUR/MWh` : ''}`}
                    maxFallback={0.5}
                    barClass="bg-gradient-to-b from-amber-300 to-amber-600"
                    footer={
                        priceStatus === 'live'
                            ? 'Source: Energy-Charts.info (RO) · converted EUR/MWh → RON/kWh · cached locally for 1 hour.'
                            : priceStatus === 'cached'
                                ? 'Serving wattwise_energy_prices cache (< 60 min) — no live Energy-Charts call.'
                                : 'HTTP 429 / network avoided — RO day-ahead shaped tariff (peak 0.85 · midday 0.25 RON/kWh).'
                    }
                />
            )}

            {activeTab === 'carbon' && (
                <ForecastBars
                    series={carbonSeries}
                    getValue={(row) => row.value}
                    getLabel={(row) => row.hourLabel}
                    getTitle={(row) => `${row.value} gCO₂/kWh`}
                    maxFallback={100}
                    toneForValue={carbonBarTone}
                    footer="Lower (greener) intensity windows are ideal for dishwashers, EVs, and heat pumps."
                />
            )}
        </div>
    );
}

function ForecastBars({
    series,
    getValue,
    getLabel,
    getTitle,
    maxFallback,
    barClass,
    toneForValue,
    footer
}) {
    const values = series.map(getValue);
    const max = Math.max(maxFallback, ...values.map((v) => Number(v) || 0));

    return (
        <div>
            <div
                className="grid items-end gap-1.5"
                style={{
                    gridTemplateColumns: `repeat(${Math.max(series.length, 1)}, minmax(0, 1fr))`,
                    minHeight: 120
                }}
            >
                {series.map((row) => {
                    const value = Number(getValue(row)) || 0;
                    const height = Math.max(6, Math.round((value / max) * 110));
                    const tone = toneForValue ? toneForValue(value) : null;
                    return (
                        <div key={row.Time || getLabel(row)} className="text-center">
                            <div
                                title={getTitle(row)}
                                className={`mx-auto mb-1.5 w-full max-w-[18px] rounded-t-md ${
                                    tone ? `bg-gradient-to-b ${tone}` : barClass
                                }`}
                                style={{height: `${height}px`}}
                            />
                            <div className="text-[10px] text-slate-500">{getLabel(row)}</div>
                        </div>
                    );
                })}
            </div>
            {footer && <p className="mt-3 text-xs leading-relaxed text-slate-500">{footer}</p>}
        </div>
    );
}

export default EnergyForecastWidget;
