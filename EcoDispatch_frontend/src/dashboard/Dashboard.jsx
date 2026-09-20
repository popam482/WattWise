import { useState, useEffect, useCallback } from 'react';
import WeatherSolarWidget from '../widgets/WeatherSolarWidget';
import NationalGridWidget from "../widgets/NationalGridWidget";

function Dashboard({ userId, userName, userType, onLogout }) {
    const [userAppliances, setUserAppliances] = useState([]);
    const [recommendations, setRecommendations] = useState({});
    const [loadingApplianceId, setLoadingApplianceId] = useState(null);
    const [applianceDuration, setApplianceDuration] = useState({});

    const [newName, setNewName] = useState("");
    const [newPower, setNewPower] = useState("");

    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState("");
    const [editPower, setEditPower] = useState("");

    const [ecoMessage, setEcoMessage] = useState(null);
    const [scheduledStatus, setScheduledStatus] = useState({});
    const [scheduledTasks, setScheduledTasks] = useState([]);

    const [, setTicks] = useState(0);

    const getAuthHeaders = () => {
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        };
    };

    useEffect(() => {
        const timer = setInterval(() => setTicks(t => t + 1), 60000);
        return () => clearInterval(timer);
    }, []);

    const getTaskStatus = (startTimeStr, durationMinutes) => {
        const now = new Date();
        const start = new Date(startTimeStr);
        const end = new Date(start.getTime() + durationMinutes * 60000);

        if (now < start) {
            return { label: 'PENDING', color: 'yellow', desc: 'Waiting for green window' };
        } else if (now >= start && now <= end) {
            return { label: 'RUNNING', color: 'green', desc: 'Device currently running on green energy' };
        } else {
            return { label: 'COMPLETED', color: 'blue', desc: 'Optimized run finished' };
        }
    }

    const formatLocalDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const getTodayString = () => formatLocalDate(new Date());
    const [selectedDate, setSelectedDate] = useState(getTodayString());

    const [error, setError] = useState('');

    const fetchScheduledTasks = useCallback(() => {
        if (!userId) return;
        fetch(`http://localhost:8080/users/${userId}/appliances/scheduled?date=${selectedDate}`, {
            headers: getAuthHeaders()
        })
            .then(async res => {
                if (!res.ok) {
                    const detail = await res.text();
                    throw new Error(detail || `Failed to load schedules (${res.status})`);
                }
                return res.json();
            })
            .then(data => {
                setScheduledTasks(data);
                const statusMap = {};
                data.forEach(task => {
                    statusMap[task.applianceId] = true;
                });
                setScheduledStatus(statusMap);
            })
            .catch(err => setError(err.message));
    }, [userId, selectedDate]);

    const fetchAppliances = useCallback(() => {
        if (!userId) return;
        fetch(`http://localhost:8080/users/${userId}/appliances`, {
            headers: getAuthHeaders()
        })
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch appliances');
                return res.json();
            })
            .then(data => setUserAppliances(data))
            .catch(err => setError(err.message));
    }, [userId]);

    useEffect(() => {
        fetchScheduledTasks();
    }, [fetchScheduledTasks]);

    useEffect(() => {
        fetch('http://localhost:8080/api/messages/random')
            .then(res => res.ok ? res.json() : null)
            .then(data => setEcoMessage(data))
            .catch(err => console.error("Error fetching message:", err));
    }, []);

    useEffect(() => {
        fetchAppliances();
    }, [fetchAppliances]);

    const handleDurationChange = (applianceId, hours) => {
        setApplianceDuration(prev => ({
            ...prev,
            [applianceId]: parseInt(hours, 10)
        }));
    };

    const handleAddAppliance = (e) => {
        e.preventDefault();
        if (!newName || !newPower) return;

        fetch(`http://localhost:8080/users/${userId}/appliances`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ name: newName, powerConsumptionKw: parseFloat(newPower) })
        })
            .then(res => {
                if (!res.ok) throw new Error('Failed to create appliance');
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
        fetch(`http://localhost:8080/users/${userId}/appliances/${applianceId}`, {
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

        const selectedDuration = applianceDuration[applianceId] || 2;

        fetch(`http://localhost:8080/users/${userId}/appliances/${applianceId}/recommendation?durationHours=${selectedDuration}`, {
            method: 'POST'
        })
            .then(res => {
                if (!res.ok) throw new Error('Could not get recommendation');
                return res.json();
            })
            .then(data => {
                setRecommendations(prev => ({
                    ...prev,
                    [applianceId]: {
                        ...data,
                        durationMinutes: selectedDuration * 60,
                    }
                }));
            })
            .catch(err => console.error(err))
            .finally(() => setLoadingApplianceId(null));
    };

    const handleConfirmSchedule = (applianceId) => {
        const rec = recommendations[applianceId];
        if (!rec) return;

        const payload = {
            id: applianceId,
            startTime: rec.best_start_time.replace(" ", "T"),
            durationMinutes: rec.durationMinutes || 120
        };

        fetch(`http://localhost:8080/users/${userId}/appliances/schedule`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        })
            .then(async res => {
                if (!res.ok) {
                    const detail = await res.text();
                    throw new Error(detail || `Failed to schedule appliance run (${res.status})`);
                }
                setScheduledStatus(prev => ({ ...prev, [applianceId]: true }));
                setSelectedDate(payload.startTime.slice(0, 10));
            })
            .catch(err => setError(err.message));
    };

    const handleCancelTask = (logId, applianceId) => {
        fetch(`http://localhost:8080/users/${userId}/appliances/scheduled/${logId}`, {
            method: 'DELETE'
        })
            .then(res => {
                if (!res.ok) throw new Error('Failed to cancel task');
                if (applianceId) {
                    setScheduledStatus(prev => ({ ...prev, [applianceId]: false }));
                }
                fetchScheduledTasks();
            })
            .catch(err => setError(err.message));
    };

    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <div className="welcome-banner">
                    <h1>{ecoMessage?.welcomeMessage || "Welcome"}{userName || "User"}!</h1>
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
                    <WeatherSolarWidget userId={userId} />
                </section>
            )}

            <section className="grid-section">
                <NationalGridWidget userId={userId} />
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

                                <div className="recommendation-controls">
                                    <label htmlFor={`duration-${app.id}`}>Run duration: </label>
                                    <select
                                        id={`duration-${app.id}`}
                                        value={applianceDuration[app.id] || 2}
                                        onChange={(e) => handleDurationChange(app.id, e.target.value)}
                                    >
                                        <option value={1}>1 hour</option>
                                        <option value={2}>2 hours</option>
                                        <option value={3}>3 hours</option>
                                        <option value={4}>4 hours</option>
                                    </select>

                                    <button
                                        type="button"
                                        onClick={() => handleGetRecommendation(app.id)}
                                        disabled={loadingApplianceId === app.id}
                                    >
                                        {loadingApplianceId === app.id ? 'Calculating...' : 'Find optimal start'}
                                    </button>
                                </div>

                                {recommendations[app.id] && (
                                    <div className="recommendation-box">
                                        <p><strong>Recommended Interval:</strong></p>
                                        <p>{recommendations[app.id].best_start_time} - {recommendations[app.id].best_end_time}</p>
                                        {recommendations[app.id].reason && (
                                            <small>
                                                {recommendations[app.id].reason}
                                            </small>
                                        )}

                                        {scheduledStatus[app.id] ? (
                                            <span>Scheduled!</span>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => handleConfirmSchedule(app.id)}
                                            >
                                                Confirm Schedule
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Navigation between days */}
            <section className="scheduled-section">
                <div>
                    <h2>My Active Eco-Schedules</h2>

                    <div className="date-picker-buttons">
                        <button
                            type="button"
                            onClick={() => setSelectedDate(getTodayString())}
                        >
                            Today
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                const tomorrow = new Date();
                                tomorrow.setDate(tomorrow.getDate() + 1);
                                setSelectedDate(formatLocalDate(tomorrow));
                            }}
                        >
                            Tomorrow
                        </button>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                        />
                    </div>
                </div>

                {scheduledTasks.length === 0 ? (
                    <p>No active eco-schedules for {selectedDate}.</p>
                ) : (
                    <div className="scheduled-grid">
                        {scheduledTasks.map(task => {
                            const taskStatus = getTaskStatus(task.startTime, task.durationMinutes);
                            return (
                                <div key={task.id} className="scheduled-card">
                                    <p className={`schedule-status schedule-status-${taskStatus.color}`}>
                                        <strong>Status:</strong> {taskStatus.label}
                                        <small> - {taskStatus.desc}</small>
                                    </p>
                                    <h3>{task.applianceName}</h3>
                                    <p>
                                        <strong>Start:</strong> {new Date(task.startTime).toLocaleString()}
                                    </p>
                                    <p>
                                        <strong>Duration:</strong> {task.durationMinutes} mins
                                    </p>
                                    {taskStatus.label !== 'COMPLETED' && (
                                        <button
                                            type="button"
                                            onClick={() => handleCancelTask(task.id, task.applianceId)}
                                        >
                                            Cancel Schedule
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>
        </div>
    );
}

export default Dashboard;