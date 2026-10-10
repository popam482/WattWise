import {useState, useEffect, useCallback} from 'react'

function WeatherSolarWidget({userId, energyProfile}) {
    const [forecastData, setForecastData] = useState(null);
    const [savedEnergyProfile, setSavedEnergyProfile] = useState(energyProfile || null);
    const [loading, setLoading] = useState(true);

    const fetchSolarForecast = useCallback(() => {
        if (!userId) return;
        Promise.all([
            fetch(`/users/${userId}/solar-forecast`).then(async res => {
                if (!res.ok) {
                    throw new Error(`Solar forecast request failed (${res.status})`);
                }
                return res.json();
            }),
            fetch(`/users/${userId}/energy`).then(async res => {
                if (!res.ok) {
                    throw new Error(`Energy profile request failed (${res.status})`);
                }
                return res.json();
            })
        ])
            .then(([forecast, profile]) => {
                setForecastData(forecast);
                setSavedEnergyProfile(profile);
            })
            .catch(err => console.error("Forecast fetch error: ", err))
            .finally(() => setLoading(false));
    }, [userId]);

    useEffect(() => {
        fetchSolarForecast();
    }, [fetchSolarForecast]);

    if (loading) return <div>Loading weather & solar forecast...</div>;
    if (!forecastData) return null;

    const forecast = Array.isArray(forecastData) ? forecastData : forecastData.forecast || [];
    const systemProfile = energyProfile || savedEnergyProfile;

    if (forecast.length === 0) return null;

    const currentHour = new Date().getHours();
    const current = forecast.find(item => new Date(item.Time).getHours() === currentHour) || forecast[0];

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

    return (
        <div className="weather-solar-widget">
            <div className="widget-header">
                <h3>Solar & Weather Overview</h3>
            </div>

            {systemProfile && (
                <div className="pv-system-specs">
                    <h4>PV System Profile</h4>
                    <div>
                        <div>
                            <strong>Capacity:</strong> {systemProfile.pvSystemKw ?? systemProfile.pv_system_kw ?? 0} kWp
                        </div>
                        <div>
                            <strong>Tilt:</strong> {systemProfile.tilt != null ? `${systemProfile.tilt}°` : 'N/A'}
                        </div>
                        <div>
                            <strong>Azimuth:</strong> {getCardinalOrientation(systemProfile.azimuth ?? systemProfile.azimuth_deg)}
                        </div>
                        {(systemProfile.latitude || systemProfile.lat) && (
                            <div>
                                <strong>Location:</strong> {systemProfile.latitude ?? systemProfile.lat}°, {systemProfile.longitude ?? systemProfile.lon}°
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="solar-metrics-grid">
                <div className="metric-card">
                    <span>Current Temp</span>
                    <h2>{current.Temp_C}°C</h2>
                </div>
                <div className="metric-card">
                    <span>Irradiance</span>
                    <h4>{current.Irradiance_W_m2} W/m²</h4>
                </div>
                <div className="metric-card">
                    <span>Cloud Coverage</span>
                    <h4>{current.Cloud_Cover ?? current["Cloud_Cover_%"]} %</h4>
                </div>
                <div className="metric-card">
                    <span>Estimated PV Power</span>
                    <h2>{current.Estimated_PV_Power_kW} kW</h2>
                </div>
            </div>
        </div>
    );
}

export default WeatherSolarWidget;