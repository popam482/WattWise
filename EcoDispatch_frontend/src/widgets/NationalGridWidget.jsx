import {useState, useEffect, useCallback} from 'react'

function NationalGridWidget({userId}) {
    const [gridData, setGridData] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchNationalGrid = useCallback(() => {
        if (!userId) return;
        fetch(`http://localhost:8080/api/national-grid/current`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch national grid data');
                return res.json();
            })
            .then(data => setGridData(data))
            .catch(err => {
                console.error("Error fetching national grid data: ", err);
                setError(err.message);
            })
            .finally(() => setLoading(false));
    }, [userId]);

    useEffect(() => {
        fetchNationalGrid();
    },[fetchNationalGrid]);

    if (loading) return <div>Loading national grid data...</div>;
    if (error) return <div role="alert">Unable to load national grid data: {error}</div>;
    if (!gridData) return null;

    const formatValue = (val) => {
        if (val === undefined || val === null || !Number.isFinite(Number(val))) return "0.00";
        return Number(val).toFixed(2);
    };

    const consumption = gridData.predictedConsumptionMW ?? gridData.Predicted_Consumption_MW ?? gridData.consumption_mw ?? 0;
    const production = gridData.productionMW ?? gridData.Production_MW ?? gridData.production_mw ?? 0;
    const greenShare = gridData.greenSharePercent ?? gridData.Green_Share_Percent ?? gridData.green_share_percent ?? 0;
    const totalFossil = gridData.totalFossil ?? gridData.Total_Fossil ?? gridData.total_fossil_mw ?? 0;
    const nuclear = gridData.nuclearMW ?? gridData.Nuclear_MW ?? gridData.nuclear_mw ?? 0;
    const timestamp = gridData.timestamp ?? gridData.Timestamp ?? "";

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