import { useState, useEffect, useCallback } from 'react';
import WeatherSolarWidget from '../widgets/WeatherSolarWidget';
import NationalGridWidget from "../widgets/NationalGridWidget";

function Dashboard({ userId, userName, userType, onLogout }) {
    const [userAppliances, setUserAppliances] = useState([]);
    const [recommendations, setRecommendations] = useState({});
    const [loadingApplianceId, setLoadingApplianceId] = useState(null);

    const [newName, setNewName] = useState("");
    const [newPower, setNewPower] = useState("");

    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState("");
    const [editPower, setEditPower] = useState("");

    const [ecoMessage, setEcoMessage] = useState(null);

    const [error, setError] = useState('');

    const fetchAppliances = useCallback(() => {
        if (!userId) return;
        fetch(`http://localhost:8080/users/${userId}/appliances`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch appliances');
                return res.json();
            })
            .then(data => setUserAppliances(data))
            .catch(err => setError(err.message));
            }, [userId]);

    useEffect(() => {
        fetch('http://localhost:8080/api/messages/random')
            .then(res => res.ok ? res.json() : null)
            .then(data => setEcoMessage(data))
            .catch(err => console.error("Error fetching message:", err));
    }, []);

    useEffect(() => {
       fetchAppliances();
            }, [fetchAppliances]);

    useEffect(() =>{
    });

    const handleAddAppliance = (e) => {
        e.preventDefault();
        if(!newName || !newPower) return;

        fetch(`http://localhost:8080/users/${userId}/appliances`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({name: newName, powerConsumptionKw: parseFloat(newPower)})
        })
            .then(res => {
                if(!res.ok) throw new Error('Failed to create appliance');
                return res.json();
            })
            .then(() => {
                setNewName("");
                setNewPower("");
                fetchAppliances();
            })
            .catch(err => setError(err.message));
    };

    const handleDeleteAppliance = (applianceId) => {
        fetch("http://localhost:8080/users/" + userId + "/appliances/" + applianceId, {
            method: "DELETE"
        })
            .then(res => {
                if (!res.ok) throw new Error("Failed to delete appliance");
                fetchAppliances();
            })
            .catch(err => setError(err.message));
    };

    const handleSaveEdit = (e, applianceId) => {
        e.preventDefault();
        fetch(`http://localhost:8080/users/${userId}/appliances/${applianceId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: editName, powerConsumptionKw: parseFloat(editPower) })
        })
            .then(res => {
                if (!res.ok) throw new Error('Failed to update appliance');
                setEditingId(null);
                fetchAppliances();
            })
            .catch(err => setError(err.message));
    };

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
            <header className="dashboard-header">
                <div className="welcome-banner">
                    <h1>{ecoMessage?.welcomeMessage || "Welcome"}{userName}!</h1>
                    {ecoMessage?.content && (
                        <p className="sustainable-tip">
                            <strong>Tip of the day:</strong> {ecoMessage.content}
                        </p>
                    )}
                </div>
                <button onClick={onLogout} className="btn-secondary">Logout</button>
            </header>
            {error && <div className="error-banner">{error}</div>}

            {userType === 'PROSUMER' && (
                <section className="weather-section">
                    <WeatherSolarWidget userId={userId}/>
                </section>
            )}

            <section className="grid-section">
                <NationalGridWidget userId={userId}/>
            </section>

            <section className="appliances-section">
                <h2>Your Appliances & Optimal Dispatch</h2>

                <form onSubmit={handleAddAppliance} className="add-appliance-form">
                    <input
                        type="text"
                        placeholder="Appliance name"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        required
                    />
                    <input
                        type="number"
                        step="0.1"
                        min="0"
                        placeholder="Power (kW)"
                        value={newPower}
                        onChange={e => setNewPower(e.target.value)}
                        required
                    />
                    <button type="submit">Add appliance</button>
                </form>

                {userAppliances.length === 0 ? (
                    <p>You don't have any appliance added yet</p>
                ) : (
                    <div className="appliances-grid">
                        {userAppliances.map(app => (
                            <div key={app.id} className="appliance-card">
                                {editingId === app.id ? (
                                    <form onSubmit={e => handleSaveEdit(e, app.id)}>
                                        <input
                                            type="text"
                                            value={editName}
                                            onChange={e => setEditName(e.target.value)}
                                            required
                                        />
                                        <input
                                            type="number"
                                            step="0.1"
                                            min="0"
                                            value={editPower}
                                            onChange={e => setEditPower(e.target.value)}
                                            required
                                        />
                                        <button type="submit">Save</button>
                                        <button type="button" onClick={() => setEditingId(null)}>Cancel</button>
                                    </form>
                                ) : (
                                    <>
                                        <h3>{app.name}</h3>
                                        <p><strong>Consumption:</strong> {app.powerConsumptionKw} kW</p>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEditingId(app.id);
                                                setEditName(app.name);
                                                setEditPower(app.powerConsumptionKw);
                                            }}
                                        >
                                            Edit
                                        </button>
                                        <button type="button" onClick={() => handleDeleteAppliance(app.id)}>
                                            Delete
                                        </button>
                                    </>
                                )}

                                <button
                                    type="button"
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