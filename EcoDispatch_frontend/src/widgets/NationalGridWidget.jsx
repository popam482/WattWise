import {useState, useEffect, useCallback} from 'react';
import {Activity} from 'lucide-react';

const FALLBACK_GRID = {
    Predicted_Consumption_MW: 7200,
    Production_MW: 7300,
    Balance_MW: 100,
    Green_Share_Percent: 43.8,
    Total_Fossil: 2800,
    Nuclear_MW: 1300,
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
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-400">
                        <Activity className="h-5 w-5" />
                    </div>
                    <h2 className="text-lg font-semibold text-slate-100">National Energy Grid (SEN)</h2>
                </div>
                <p className="text-sm text-slate-400">Loading national grid data…</p>
            </div>
        );
    }

    const data = gridData || FALLBACK_GRID;

    const formatValue = (val) => {
        if (val === undefined || val === null || isNaN(val)) return '0.00';
        return Number(val).toFixed(2);
    };

    const consumption = data.Predicted_Consumption_MW ?? data.predictedConsumptionMW ?? data.consumption_mw ?? 0;
    const production = data.Production_MW ?? data.productionMW ?? data.production_mw ?? 0;
    const balance = data.Balance_MW ?? data.balanceMW ?? data.balance_mw ?? 0;
    const greenShare = data.Green_Share_Percent ?? data.greenSharePercent ?? data.green_share_percent ?? 0;
    const totalFossil = data.Total_Fossil ?? data.totalFossil ?? data.total_fossil_mw ?? 0;
    const nuclear = data.Nuclear_MW ?? data.nuclearMW ?? data.nuclear_mw ?? 0;
    const timestamp = data.Timestamp ?? data.timestamp ?? '';
    const greenPct = Math.max(0, Math.min(100, Number(greenShare) || 0));
    const balancePositive = Number(balance) >= 0;

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-400">
                        <Activity className="h-5 w-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-slate-100">National Energy Grid (SEN)</h2>
                        {timestamp && (
                            <p className="text-xs text-slate-500">
                                Snapshot {new Date(timestamp).toLocaleString()}
                            </p>
                        )}
                    </div>
                </div>
                {(degraded || data._fallback) && (
                    <span className="rounded-full border border-slate-700 bg-slate-950/50 px-3 py-1 text-xs text-slate-400">
                        Cached / demo-safe snapshot
                    </span>
                )}
            </div>

            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-slate-400">Renewable share</span>
                    <span className="font-semibold text-emerald-400">{formatValue(greenShare)}%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-800">
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-blue-500 transition-all"
                        style={{width: `${greenPct}%`}}
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                {[
                    {label: 'Production', value: `${formatValue(production)} MW`, tone: 'text-emerald-400'},
                    {label: 'Consumption', value: `${formatValue(consumption)} MW`, tone: 'text-blue-400'},
                    {
                        label: 'Grid balance',
                        value: `${formatValue(balance)} MW`,
                        tone: balancePositive ? 'text-emerald-400' : 'text-amber-400'
                    },
                    {label: 'Fossil', value: `${formatValue(totalFossil)} MW`, tone: 'text-slate-200'},
                    {label: 'Nuclear', value: `${formatValue(nuclear)} MW`, tone: 'text-blue-300'}
                ].map(item => (
                    <div
                        key={item.label}
                        className="rounded-xl border border-slate-800 bg-slate-950/50 p-3 backdrop-blur-md"
                    >
                        <p className="text-xs text-slate-500">{item.label}</p>
                        <p className={`mt-1 text-lg font-bold ${item.tone}`}>{item.value}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default NationalGridWidget;
