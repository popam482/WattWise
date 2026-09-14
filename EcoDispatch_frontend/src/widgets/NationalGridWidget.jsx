import {useState, useEffect, useCallback} from 'react'

function NationalGridWidget({userId}) {
    const [gridData, setGridData] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchNationalGrid = useCallback(() => {
        if (!userId) return;
        fetch(`http://localhost:8080/api/national-grid/current`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch national grid data');
                return res.json();
            })
            .then(data => setGridData(data))
            .catch(err => console.error("Error fetching national grid data: ", err))
            .finally(() => setLoading(false));
    }, [userId]);

    useEffect(() => {
        fetchNationalGrid();
    },[fetchNationalGrid]);

    if (loading) return <div>Loading national grid data...</div>;
    if (!gridData) return null;

    const totalGreen = gridData.Total_Green_MW ?? gridData.totalGreenMW ?? 0;
    const totalFossil = gridData.Total_Fossil ?? gridData.totalFossil ?? 0;
    const nuclear = gridData.Nuclear_MW ?? gridData.nuclearMW ?? 0;
    const greenShare = gridData.Green_Share_Percent ?? gridData.greenSharePercent ?? 0;
    const predictedConsumption = gridData.Predicted_Consumption_MW ?? gridData.predictedConsumptionMW ?? 0;

    return (
        <div>
            <h3>National Energy Grid Overview</h3>

            <div>
                <div>
                    <span>Total Green Energy</span>
                    <h2>{totalGreen} MW</h2>
                    <span>Total Green Energy Percent</span>
                    <h2>{greenShare} %</h2>
                </div>
                <div>
                    <span>Total Fossil</span>
                    <h4>{totalFossil} MW</h4>
                </div>
                <div>
                    <span>Total Nuclear</span>
                    <h4>{nuclear} MW</h4>
                </div>
                <div>
                    <span>Predicted Energy Production</span>
                    <h4>{predictedConsumption} MW</h4>
                </div>
            </div>
        </div>
    );
}

export default NationalGridWidget;