import {useState, useEffect, useCallback} from 'react';

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
            <div>
                <h2>National Energy Grid Overview</h2>
                <p style={{opacity: 0.7}}>Loading national grid data…</p>
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

    return (
        <div>
            <div style={{display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', flexWrap: 'wrap'}}>
                <h2>National Energy Grid Overview</h2>
                {(degraded || data._fallback) && (
                    <span style={{fontSize: 12, opacity: 0.65}}>Cached / demo-safe snapshot</span>
                )}
            </div>
            <h2>Data for {timestamp}</h2>
            <div>
                <div>
                    <span>Live grid production</span>
                    <h2>{formatValue(production)} MW</h2>
                </div>
                <div>
                    <span>Live grid consumption</span>
                    <h2>{formatValue(consumption)} MW</h2>
                </div>
                <div>
                    <span>Grid balance</span>
                    <h4>{formatValue(balance)} MW</h4>
                </div>
                <div>
                    <span>Renewable share</span>
                    <h2>{formatValue(greenShare)} %</h2>
                </div>
                <div>
                    <span>Fossil generation</span>
                    <h4>{formatValue(totalFossil)} MW</h4>
                </div>
                <div>
                    <span>Nuclear generation</span>
                    <h4>{formatValue(nuclear)} MW</h4>
                </div>
            </div>
        </div>
    );
}

export default NationalGridWidget;
