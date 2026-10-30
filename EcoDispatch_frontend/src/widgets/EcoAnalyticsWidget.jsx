import {useState, useEffect} from 'react';

function EcoAnalyticsWidget({userId, onAnalyticsLoaded}) {
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) return;

        const token = localStorage.getItem('token');

        fetch(`/users/${userId}/eco-analytics`, {
            headers: {
                'Content-Type': 'application/json',
                ...(token ? {Authorization: `Bearer ${token}`} : {})
            }
        })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                setAnalytics(data);
                if (data && typeof onAnalyticsLoaded === 'function') {
                    onAnalyticsLoaded({
                        totalSavedCo2Kg: data.totalSavedCo2Kg ?? 0,
                        totalSavedMoneyRon: data.totalSavedMoneyRon ?? 0
                    });
                }
            })
            .catch((err) =>
                console.error('Error fetching eco-analytics:', err)
            )
            .finally(() => setLoading(false));
        // Intentionally depend only on userId; parent callback is a stable setState
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    if (loading) {
        return <div>Loading Eco Impact Statistics...</div>;
    }

    if (!analytics) {
        return null;
    }

    return (
        <div className="eco-analytics-widget">
            <h2>Historical Eco-Impact &amp; Analytics</h2>

            <div className="analytics-grid">
                <div className="analytics-card">
                    <span className="analytics-icon">CO2: </span>
                    <strong>{analytics.totalSavedCo2Kg} kg</strong>
                    <span>Total CO₂ Avoided</span>
                </div>

                <div className="analytics-card">
                    <span className="analytics-icon">Runs: </span>
                    <strong>{analytics.totalCompletedTasks}</strong>
                    <span>Optimized Runs</span>
                </div>

                <div className="analytics-card">
                    <span className="analytics-icon">Car: </span>
                    <strong>{analytics.equivalentCarKm} km</strong>
                    <span>Car Driving Equivalence</span>
                </div>

                <div className="analytics-card">
                    <span className="analytics-icon">Trees: </span>
                    <strong>{analytics.equivalentTreesPlanted}</strong>
                    <span>Trees Absorbing CO₂ / Month</span>
                </div>
            </div>

            <div className="analytics-methodology">
                <h3>How is this calculated?</h3>

                <p>
                    EcoDispatch compares your scheduled run times against a
                    counterfactual baseline (peak-hour grid carbon intensity)
                    using real-time SEN data and IPCC lifecycle emission
                    factors.
                </p>
            </div>
        </div>
    );
}

export default EcoAnalyticsWidget;