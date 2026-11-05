import {useState, useEffect, useCallback} from 'react';
import {Activity} from 'lucide-react';
import {metricChip} from '../ui/ecoStyles.js';

const iconBubble =
    'flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-white/40 text-sky-700 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-white/5 dark:text-sky-300';

const FALLBACK_GRID = {
    Predicted_Consumption_MW: 7200,
    Production_MW: 7300,
    Balance_MW: 100,
    Green_Share_Percent: 43.8,
    Total_Fossil: 2800,
    Nuclear_MW: 1300,
    Total_Green_MW: 3200,
    Timestamp: new Date().toISOString(),
    _fallback: true
};

function NationalGridWidget({userId}) {
    const [gridData, setGridData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [degraded, setDegraded] = useState(false);

    const fetchNationalGrid = useCallback(() => {
        if (!userId) return;

        fetch('/api/national-grid/current')
            .then(async res => {
                if (!res.ok) return null;
                const body = await res.text();
                if (!body.trim()) return null;
                try {
                    return JSON.parse(body);
                } catch {
                    return null;
                }
            })
            .then(data => {
                if (data) {
                    setGridData(data);
                    setDegraded(Boolean(data.degraded));
                } else {
                    setGridData(prev => prev || FALLBACK_GRID);
                    setDegraded(true);
                }
            })
            .catch(() => {
                setGridData(prev => prev || FALLBACK_GRID);
                setDegraded(true);
            })
            .finally(() => setLoading(false));
    }, [userId]);

    useEffect(() => {
        const initialFetch = setTimeout(fetchNationalGrid, 0);
        const refreshInterval = setInterval(fetchNationalGrid, 60000);

        return () => {
            clearTimeout(initialFetch);
            clearInterval(refreshInterval);
        };
    }, [fetchNationalGrid]);

    if (loading && !gridData) {
        return (
            <div className="space-y-3">
                <div className="flex items-center gap-3">
                    <div className={iconBubble}>
                        <Activity className="h-5 w-5" />
                    </div>
                    <h2 className="font-display text-xl font-semibold tracking-tight text-slate-900 dark:text-white">National Energy Grid (SEN)</h2>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Loading national grid data…</p>
            </div>
        );
    }

    const data = gridData || FALLBACK_GRID;

    const formatValue = (val) => {
        if (val === undefined || val === null || isNaN(val)) return '0.00';
        return Number(val).toFixed(2);
    };

    const consumption = data.Predicted_Consumption_MW ?? data.predictedConsumptionMW ?? data.consumption_mw ?? 0;
    const production = Number(data.Production_MW ?? data.productionMW ?? data.production_mw ?? 0);
    const balance = data.Balance_MW ?? data.balanceMW ?? data.balance_mw ?? 0;
    const greenShare = data.Green_Share_Percent ?? data.greenSharePercent ?? data.green_share_percent ?? 0;
    const totalFossil = Number(data.Total_Fossil ?? data.totalFossil ?? data.total_fossil_mw ?? 0);
    const nuclear = Number(data.Nuclear_MW ?? data.nuclearMW ?? data.nuclear_mw ?? 0);
    const explicitRenewable = Number(
        data.Total_Green_MW
        ?? data.totalGreenMW
        ?? data.renewablePowerMw
        ?? data.Renewable_MW
        ?? NaN
    );
    const renewable = Number.isFinite(explicitRenewable)
        ? explicitRenewable
        : Math.max(0, production - (totalFossil + nuclear));
    const timestamp = data.Timestamp ?? data.timestamp ?? '';
    const greenPct = Math.max(0, Math.min(100, Number(greenShare) || 0));
    const balancePositive = Number(balance) >= 0;
    const mixSum = totalFossil + nuclear + renewable;

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className={iconBubble}>
                        <Activity className="h-5 w-5" />
                    </div>
                    <div>
                        <h2 className="font-display text-xl font-semibold tracking-tight text-slate-900 dark:text-white">National Energy Grid (SEN)</h2>
                        {timestamp && (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Snapshot {new Date(timestamp).toLocaleString()}
                            </p>
                        )}
                    </div>
                </div>
                {(degraded || data._fallback) && (
                    <span className="rounded-full border border-white/25 bg-white/40 px-3 py-1 text-xs font-medium text-slate-600 backdrop-blur-md dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                        Cached / demo-safe snapshot
                    </span>
                )}
            </div>

            <div className="rounded-3xl border border-emerald-400/25 bg-emerald-400/10 p-5 backdrop-blur-xl dark:border-emerald-400/20 dark:bg-emerald-500/10">
                <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">Renewable share</span>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-300">{formatValue(greenShare)}%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-white/50 dark:bg-white/10">
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-lime-300 via-emerald-400 to-teal-500 shadow-[0_0_16px_rgba(52,211,153,0.55)] transition-all"
                        style={{width: `${greenPct}%`}}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                    {
                        label: 'Production',
                        value: `${formatValue(production)} MW`,
                        tone: 'text-slate-900 dark:text-white'
                    },
                    {
                        label: 'Consumption',
                        value: `${formatValue(consumption)} MW`,
                        tone: 'text-sky-700 dark:text-sky-300'
                    },
                    {
                        label: 'Grid balance',
                        value: `${formatValue(balance)} MW`,
                        tone: balancePositive ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'
                    }
                ].map(item => (
                    <div key={item.label} className={metricChip}>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{item.label}</p>
                        <p className={`mt-1 font-display text-lg font-semibold ${item.tone}`}>{item.value}</p>
                    </div>
                ))}
            </div>

            <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">Generation mix breakdown</h3>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Fossil + Nuclear + Renewable = {formatValue(mixSum)} MW
                        {production > 0 ? ` · Production ${formatValue(production)} MW` : ''}
                    </span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className={metricChip}>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Fossil Generation</p>
                        <p className="mt-1 font-display text-lg font-semibold text-slate-800 dark:text-slate-200">{formatValue(totalFossil)} MW</p>
                    </div>
                    <div className={metricChip}>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Nuclear Generation</p>
                        <p className="mt-1 font-display text-lg font-semibold text-sky-800 dark:text-sky-300">{formatValue(nuclear)} MW</p>
                    </div>
                    <div className={`${metricChip} border-emerald-400/25`}>
                        <p className="text-xs text-emerald-700 dark:text-emerald-400/80">Renewable Generation</p>
                        <p className="mt-1 font-display text-lg font-semibold text-emerald-700 dark:text-emerald-300">{formatValue(renewable)} MW</p>
                        <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">Hydro / Wind / Solar</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default NationalGridWidget;
