import {useState, useEffect, useCallback} from 'react'

function NationalGridWidget({userId}) {
    const [gridData, setGridData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchNationalGrid = useCallback(() => {
        if (!userId) return;
        setError('');
        fetch('/api/national-grid/current')
            .then(async res => {
                if (!res.ok) {
                    const detail = await res.text();
                    throw new Error(`Failed to fetch national grid data (${res.status}): ${detail}`);
                }
                return res.json();
            })
            .then(data => setGridData(data))
            .catch(err => {
                console.error("Error fetching national grid data: ", err);
                setError('National grid data is temporarily unavailable.');
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
    },[fetchNationalGrid]);

    if (loading) return <div>Loading national grid data...</div>;
    if (error) return <div className="error-banner">{error}</div>;
    if (!gridData) return null;

    const formatValue = (val) => {
        if (val === undefined || val === null || isNaN(val)) return "0.00";
        return Number(val).toFixed(2);
    };

    const consumption = gridData.Predicted_Consumption_MW ?? gridData.predictedConsumptionMW ?? gridData.consumption_mw ?? 0;
    const production = gridData.Production_MW ?? gridData.productionMW ?? gridData.production_mw ?? 0;
    const balance = gridData.Balance_MW ?? gridData.balanceMW ?? gridData.balance_mw ?? 0;
    const greenShare = gridData.Green_Share_Percent ?? gridData.greenSharePercent ?? gridData.green_share_percent ?? 0;
    const totalFossil = gridData.Total_Fossil ?? gridData.totalFossil ?? gridData.total_fossil_mw ?? 0;
    const nuclear = gridData.Nuclear_MW ?? gridData.nuclearMW ?? gridData.nuclear_mw ?? 0;
    const timestamp = gridData.Timestamp ?? gridData.timestamp ?? "";
    const explanation = gridData.Prediction_Explanation ?? gridData.predictionExplanation;
    const shapContributions = explanation?.Shap_Contributions ?? explanation?.shapContributions ?? {};
    const formatFeatureName = (name) => name.replaceAll('_', ' ');
    const contributingFactors = Object.entries(shapContributions)
        .sort(([, first], [, second]) => Math.abs(second) - Math.abs(first));

    return (
        <div>
            <h2>National Energy Grid Overview</h2>
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