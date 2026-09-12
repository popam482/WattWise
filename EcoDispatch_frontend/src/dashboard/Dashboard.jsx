import { useState, useEffect } from 'react';

function Dashboard({ userId, onLogout }) {
    const [userAppliances, setUserAppliances] = useState([]);
    const [recommendations, setRecommendations] = useState({});
    const [loadingApplianceId, setLoadingApplianceId] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!userId) return;
        fetch(`http://localhost:8080/users/${userId}/appliances`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch appliances');
                return res.json();
            })
            .then(data => setUserAppliances(data))
            .catch(err => setError(err.message));
    }, [userId]);

    const handleGetRecommendation = (applianceId) => {
        setLoadingApplianceId(applianceId);

        fetch(`http://localhost:8080/users/${userId}/appliances/${applianceId}/recommendation?durationHours=2`, {
            method: 'POST'
        })
            .then(res => {
                if (!res.ok) throw new Error('Could not get recommendation');
                return res.json();
            })
            .then(data => {
                setRecommendations(prev => ({
                    ...prev,
                    [applianceId]: data
                }));
            })
            .catch(err => console.error(err))
            .finally(() => setLoadingApplianceId(null));
    };
    return (
        <div className="dashboard-container">
            <header>
                <h1>EcoDispatch Dashboard</h1>
                <button onClick={onLogout} className="btn-secondary">Logout</button>
            </header>

            {error && <div className="error-banner">{error}</div>}

            <section className="appliances-section">
                <h2>Your Appliances & Optimal Dispatch</h2>

                {userAppliances.length === 0 ? (
                    <p>You don't have any appliance added yet</p>
                ) : (
                    <div className="appliances-grid">
                        {userAppliances.map(app => (
                            <div key={app.id} className="appliance-card">
                                <h3>{app.name}</h3>
                                <p><strong>Consumption:</strong> {app.powerConsumptionKw} kW</p>

                                <button
                                    onClick={() => handleGetRecommendation(app.id)}
                                    disabled={loadingApplianceId === app.id}
                                >
                                    {loadingApplianceId === app.id ? 'Calculating...' : 'Find the optimal start hour'}
                                </button>

                                {recommendations[app.id] && (
                                    <div>
                                        <p>
                                            <strong>Recommended Interval:</strong>
                                        </p>
                                        <p>
                                            {recommendations[app.id].best_start_time} - {recommendations[app.id].best_end_time}
                                        </p>
                                        {recommendations[app.id].reason && (
                                            <small>
                                                {recommendations[app.id].reason}
                                            </small>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}

export default Dashboard;