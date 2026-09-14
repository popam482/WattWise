import {useState, useEffect, useCallback} from 'react'

function WeatherSolarWidget({userId}) {
    const [forecast, setForecast] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchSolarForecast = useCallback(() => {
        if (!userId) return;
        fetch(`http://localhost:8080/users/${userId}/solar-forecast`)
            .then(res => res.ok? res.json() : [])
            .then(data => setForecast(data))
            .catch(err => console.error("Forecast fetch error: ", err))
            .finally(() => setLoading(false));
    }, [userId]);

    useEffect(() => {
        fetchSolarForecast();
    }, [fetchSolarForecast]);

    if (loading) return <div>Loading weather & solar forecast...</div>;
    if (!forecast || forecast.length === 0) return null;

    // current forecast
    const currentHour = new Date().getHours();
    const current = forecast.find(item => new Date(item.Time).getHours() === currentHour) || forecast[0];

    return (
        <div>
            <h3>Solar & Weather Overview</h3>

            <div>
                <div>
                    <span>Current Temp</span>
                    <h2>{current.Temp_C}°C</h2>
                </div>
                <div>
                    <span>Irradiance</span>
                    <h4>{current.Irradiance_W_m2} W/m²</h4>
                </div>
                <div>
                    <span>Cloud Coverage</span>
                    <h4>{current.Cloud_Cover ?? current["Cloud_Cover_%"]} %</h4>
                </div>
                <div>
                    <span>Estimated Power</span>
                    <h4>{current.Estimated_PV_Power_kW} kW</h4>
                </div>
            </div>
        </div>
    );
}

export default WeatherSolarWidget;