import {useState, useEffect, useCallback} from 'react';
import WeatherSolarWidget from '../widgets/WeatherSolarWidget';
import NationalGridWidget from "../widgets/NationalGridWidget";
import EcoAnalyticsWidget from '../widgets/EcoAnalyticsWidget';
import HabitLearningSettings from '../privacy/HabitLearningSettings';

function Dashboard({userId, userName, userType, onLogout}) {
    const [userAppliances, setUserAppliances] = useState([]);
    const [recommendations, setRecommendations] = useState({});
    const [loadingApplianceId, setLoadingApplianceId] = useState(null);
    const [applianceDuration, setApplianceDuration] = useState({});
    const [dispatchWindow, setDispatchWindow] = useState({});

    const [newName, setNewName] = useState("");
    const [newPower, setNewPower] = useState("");
    const [newIsRecurring, setNewIsRecurring] = useState(false);
    const [newRecurringDays, setNewRecurringDays] = useState("DAILY");
    const [newPreferredDuration, setNewPreferredDuration] = useState("2");
    const [newWindowStart, setNewWindowStart] = useState("22:00");
    const [newWindowEnd, setNewWindowEnd] = useState("07:00");

    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState("");
    const [editPower, setEditPower] = useState("");
    const [editIsRecurring, setEditIsRecurring] = useState(false);
    const [editRecurringDays, setEditRecurringDays] = useState("DAILY");
    const [editPreferredDuration, setEditPreferredDuration] = useState("2");
    const [editWindowStart, setEditWindowStart] = useState("22:00");
    const [editWindowEnd, setEditWindowEnd] = useState("07:00");

    const [ecoMessage, setEcoMessage] = useState(null);
    const [scheduledStatus, setScheduledStatus] = useState({});
    const [scheduledTasks, setScheduledTasks] = useState([]);

    const [, setTicks] = useState(0);

    const [energyProfile, setEnergyProfile] = useState(null);

    const getAuthHeaders = () => {
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            ...(token ? {'Authorization': `Bearer ${token}`} : {})
        };
    };

    useEffect(() => {
        if (!userId || userType !== 'PROSUMER') return;

        fetch(`/users/${userId}/energy`, {
            headers: getAuthHeaders()
        })
            .then(res => res.ok ? res.json() : null)
            .then(data => setEnergyProfile(data))
            .catch(err => console.error("Error fetching energy profile:", err));
    }, [userId, userType]);

    useEffect(() => {
        const timer = setInterval(() => setTicks(t => t + 1), 60000);
        return () => clearInterval(timer);
    }, []);

    const getTaskStatus = (startTimeStr, durationMinutes) => {
        const now = new Date();
        const start = new Date(startTimeStr);
        const end = new Date(start.getTime() + durationMinutes * 60000);

        if (now < start) {
            return {label: 'PENDING', color: 'yellow', desc: 'Waiting for green window'};
        } else if (now >= start && now <= end) {
            return {label: 'RUNNING', color: 'green', desc: 'Device currently running on green energy'};
        } else {
            return {label: 'COMPLETED', color: 'blue', desc: 'Optimized run finished'};
        }
    };

    const formatLocalDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const getTodayString = () => formatLocalDate(new Date());
    const [selectedDate, setSelectedDate] = useState(getTodayString());

    const [error, setError] = useState('');

    const getTransparentScorecard = (rec) => {
        if (!rec) return null;

        const carbon = rec.recommended_carbon_intensity || 150;
        const carbonScore = Math.max(0, Math.min(100, Math.round(100 - (carbon / 4.5))));

        const factors = rec.decision_factors || {};
        const solarCoverage = factors['Direct Solar Coverage'] || factors['Direct_Solar_Coverage'] || 70;
        const renewableAvailability = Math.round(Math.min(100, Math.max(0, solarCoverage)));

        const recPrice = rec.recommended_energy_price || 0.45;
        const basePrice = rec.baseline_energy_price || 1.30;
        const priceScore = Math.max(0, Math.min(100, Math.round((1 - (recPrice / basePrice)) * 100)));

        const gridImpact = factors['External Grid Impact'] || factors['External_Grid_Impact'] || 30;
        const gridStress = gridImpact < 35 ? 'Low' : gridImpact < 65 ? 'Moderate' : 'High';
        const confidence = Math.round(Math.min(98, Math.max(70, 100 - (carbon / 10))));

        return {
            carbonScore,
            renewableAvailability,
            priceScore,
            gridStress,
            confidence
        };
    };

    const fetchScheduledTasks = useCallback(() => {
        if (!userId) return;
        return fetch(`/users/${userId}/appliances/scheduled?date=${selectedDate}`, {
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
                setScheduledTasks(Array.isArray(data) ? data : []);

                const activeStatusMap = {};
                if (Array.isArray(data)) {
                    data.forEach(task => {
                        if (task.applianceId) {
                            activeStatusMap[task.applianceId] = true;
                        }
                    });
                }

                setScheduledStatus(activeStatusMap);
                return data;
            })
            .catch(err => {
                setError(err.message);
                return [];
            });
    }, [userId, selectedDate]);

    const fetchAppliances = useCallback(() => {
        if (!userId) return;
        fetch(`/users/${userId}/appliances`, {
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
        fetch('/api/messages/random')
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

    const getDispatchWindow = (applianceId) => {
        const existing = dispatchWindow[applianceId];
        if (existing) return existing;

        const now = new Date();

        const start = new Date(now);

        const end = new Date(start);
        end.setDate(end.getDate() + 2);
        end.setHours(0, 0, 0, 0);

        const formatLocalDatetime = (d) => {
            const pad = (n) => String(n).padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        };

        return {
            earliestStart: formatLocalDatetime(start),
            latestEnd: formatLocalDatetime(end)
        };
    };

    const updateDispatchWindow = (applianceId, field, value) => {
        setDispatchWindow(prev => ({
            ...prev,
            [applianceId]: {
                ...getDispatchWindow(applianceId),
                [field]: value
            }
        }));
    };

    const handleAddAppliance = (e) => {
        e.preventDefault();
        if (!newName || !newPower) return;

        const payload = {
            name: newName,
            powerConsumptionKw: parseFloat(newPower),
            isRecurring: newIsRecurring,
            recurringDays: newIsRecurring ? newRecurringDays : null,
            preferredDuration: newIsRecurring ? newPreferredDuration : null,
            timeWindowStart: newIsRecurring ? newWindowStart : null,
            timeWindowEnd: newIsRecurring ? newWindowEnd : null
        };

        fetch(`/users/${userId}/appliances`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        })
            .then(res => {
                if (!res.ok) throw new Error('Failed to create appliance');
                return res.json();
            })
            .then(() => {
                setNewName("");
                setNewPower("");
                setNewIsRecurring(false);
                fetchAppliances();
            })
            .catch(err => setError(err.message));
    };

    const handleDeleteAppliance = (applianceId) => {
        fetch(`/users/${userId}/appliances/${applianceId}`, {
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
        const payload = {
            name: editName,
            powerConsumptionKw: parseFloat(editPower),
            isRecurring: editIsRecurring,
            recurringDays: editIsRecurring ? editRecurringDays : null,
            preferredDuration: editIsRecurring ? editPreferredDuration : null,
            timeWindowStart: editIsRecurring ? editWindowStart : null,
            timeWindowEnd: editIsRecurring ? editWindowEnd : null
        };

        fetch(`/users/${userId}/appliances/${applianceId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        })
            .then(res => {
                if (!res.ok) throw new Error('Failed to update appliance');
                setEditingId(null);
                fetchAppliances();
            })
            .catch(err => setError(err.message));
    };

    const startEditing = (app) => {
        setEditingId(app.id);
        setEditName(app.name);
        setEditPower(app.powerConsumptionKw);
        setEditIsRecurring(app.isRecurring || false);
        setEditRecurringDays(app.recurringDays || "DAILY");
        setEditPreferredDuration(app.preferredDuration || "2");
        setEditWindowStart(app.timeWindowStart || "22:00");
        setEditWindowEnd(app.timeWindowEnd || "07:00");
    };

    const handleGetRecommendation = (applianceId) => {
        setLoadingApplianceId(applianceId);
        setScheduledStatus(prev => ({...prev, [applianceId]: false}));

        const selectedDuration = applianceDuration[applianceId] || 2;
        const window = getDispatchWindow(applianceId);
        const query = new URLSearchParams({
            durationHours: selectedDuration,
            earliestStart: window.earliestStart,
            latestEnd: window.latestEnd
        });

        fetch(`/users/${userId}/appliances/${applianceId}/recommendation?${query}`, {
            method: 'POST',
            headers: getAuthHeaders()
        })
            .then(async res => {
                if (!res.ok) {
                    const detail = await res.text();
                    throw new Error(detail || `Could not get recommendation (${res.status})`);
                }
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
            .catch(err => console.error('Could not get recommendation:', err))
            .finally(() => setLoadingApplianceId(null));
    };

    const handleConfirmSchedule = (applianceId) => {
        const rec = recommendations[applianceId];
        if (!rec) return;

        const payload = {
            id: applianceId,
            startTime: rec.best_start_time.replace(" ", "T"),
            durationMinutes: rec.durationMinutes || 120,
            recommendedCarbonIntensity: rec.recommended_carbon_intensity,
            baselineCarbonIntensity: rec.baseline_carbon_intensity,
            recommendedEnergyPrice: rec.recommended_energy_price,
            baselineEnergyPrice: rec.baseline_energy_price
        };

        fetch(`/users/${userId}/appliances/schedule`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        })
            .then(async res => {
                if (!res.ok) {
                    const detail = await res.text();
                    throw new Error(detail || `Failed to schedule appliance run (${res.status})`);
                }
                return fetchScheduledTasks();
            })
            .then(() => {
                setScheduledStatus(prev => ({...prev, [applianceId]: true}));
            })
            .catch(err => setError(err.message));
    };

    const handleCancelTask = (logId, applianceId) => {
        fetch(`/users/${userId}/appliances/scheduled/${logId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        })
            .then(res => {
                if (!res.ok) throw new Error('Failed to cancel task');

                const taskToCancel = scheduledTasks.find(t => t.id === logId);
                const targetApplianceId = applianceId || taskToCancel?.applianceId;

                if (targetApplianceId) {
                    setScheduledStatus(prev => ({ ...prev, [targetApplianceId]: false }));
                }
                fetchScheduledTasks();
            })
            .catch(err => setError(err.message));
    };

    const isSmartRecurring = (appliance) => {
        const value = appliance?.isRecurring;
        return value === true
            || value === 1
            || value === '1'
            || (typeof value === 'string' && value.toLowerCase() === 'true');
    };

    const smartRecurringAppliances = userAppliances.filter(isSmartRecurring);
    const manualAppliances = userAppliances.filter(appliance => !isSmartRecurring(appliance));

    const renderTaskCard = (task) => {
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
                {task.savedCo2Grams > 0 && (
                    <div className="impact-badge">
                        <small>
                            <strong>Eco-Impact:</strong> You
                            avoided {(task.savedCo2Grams >= 1000 ? (task.savedCo2Grams / 1000).toFixed(2) + ' kg' : task.savedCo2Grams.toFixed(0) + ' g')} CO₂
                            compared to peak hours
                        </small>
                    </div>
                )}
                {task.savedMoneyRon > 0 && (
                    <div className="money-badge">
                        <small>
                            <strong>Financial Impact:</strong>
                            You saved {(task.savedMoneyRon.toFixed(2))} RON
                        </small>
                    </div>
                )}
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
    };

    const recurringApplianceIds = new Set(
        (Array.isArray(userAppliances) ? userAppliances : [])
            .filter(app => app.isRecurring)
            .map(app => app.id)
    );
    const isSmartTask = (task) =>
        typeof task.recurring === 'boolean'
            ? task.recurring
            : recurringApplianceIds.has(task.applianceId);

    const smartTasks = scheduledTasks.filter(isSmartTask);
    const manualTasks = scheduledTasks.filter(task => !isSmartTask(task));

    const scheduledStats = scheduledTasks.reduce((acc, task) => {
        const status = getTaskStatus(task.startTime, task.durationMinutes).label;
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, { PENDING: 0, RUNNING: 0, COMPLETED: 0 });

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

            <section className="dispatch-hero">
                <div>
                    <h2>Let your appliances follow the cleanest energy.</h2>
                    <p>
                        EcoDispatch searches the time window you allow and schedules
                        flexible loads when carbon intensity is lowest.
                    </p>
                </div>
            </section>

            {userType === 'PROSUMER' && (
                <section className="weather-section">
                    <WeatherSolarWidget userId={userId} energyProfile={energyProfile} />
                </section>
            )}

            <section className="grid-section">
                <NationalGridWidget userId={userId}/>
            </section>

            <section className="appliances-section">
                <div className="section-heading">
                    <div>
                        <h2>Autonomous dispatch</h2>
                    </div>
                    <span className="section-description">Define the rules. We find the greenest run.</span>
                </div>

                <form onSubmit={handleAddAppliance} className="add-appliance-form">
                    <div>
                        <input
                            type="text"
                            placeholder="Appliance name (e.g. EV Charger)"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            required
                            style={{flex: 2}}
                        />
                        <input
                            type="number"
                            step="0.1"
                            min="0"
                            placeholder="Power (kW)"
                            value={newPower}
                            onChange={e => setNewPower(e.target.value)}
                            required
                            style={{flex: 1}}
                        />
                        <button type="submit">Add appliance</button>
                    </div>

                    <div>
                        <label>
                            <input
                                type="checkbox"
                                checked={newIsRecurring}
                                onChange={e => setNewIsRecurring(e.target.checked)}
                            />
                            Enable Smart Recurring Rule
                        </label>

                        {newIsRecurring && (
                            <div>
                                <select value={newRecurringDays} onChange={e => setNewRecurringDays(e.target.value)}>
                                    <option value="DAILY">Every Day</option>
                                    <option value="WEEKDAYS">Weekdays (Mon-Fri)</option>
                                    <option value="WEEKENDS">Weekends (Sat-Sun)</option>
                                </select>

                                <span>Duration:</span>
                                <select value={newPreferredDuration} onChange={e => setNewPreferredDuration(e.target.value)}>
                                    <option value="1">1 hour</option>
                                    <option value="2">2 hours</option>
                                    <option value="3">3 hours</option>
                                    <option value="4">4 hours</option>
                                </select>

                                <span>Window:</span>
                                <input type="time" value={newWindowStart} onChange={e => setNewWindowStart(e.target.value)} />
                                <span>to</span>
                                <input type="time" value={newWindowEnd} onChange={e => setNewWindowEnd(e.target.value)} />
                            </div>
                        )}
                    </div>
                </form>

                {userAppliances.length === 0 ? (
                    <p>You don't have any appliance added yet</p>
                ) : (
                    [
                        {
                            key: 'smart-recurring',
                            title: 'Automatic appliances',
                            description: 'Runs automatically according to the saved recurring rule.',
                            appliances: smartRecurringAppliances
                        },
                        {
                            key: 'manual-dispatch',
                            title: 'Manual appliances',
                            description: 'Find a clean energy window whenever you want to run the appliance.',
                            appliances: manualAppliances
                        }
                    ].map(group => group.appliances.length > 0 && (
                        <section className="appliance-group" key={group.key}>
                            <div className="appliance-group-heading">
                                <div>
                                    <span className="eyebrow">{group.label}</span>
                                    <h3>{group.title}</h3>
                                </div>
                                <span className="section-description">{group.description}</span>
                            </div>
                            <div className="appliances-grid">
                        {group.appliances.map(app => {
                            const smartRecurringActive = editingId === app.id
                                ? editIsRecurring
                                : isSmartRecurring(app);

                            return (
                                <div key={app.id} className="appliance-card">
                                    <div className="appliance-card-header">
                                        <div>
                                            <h3>{app.name}</h3>
                                            <span className="appliance-power">{app.powerConsumptionKw} kW flexible load</span>
                                        </div>
                                        <span className={smartRecurringActive ? "confidence-pill" : "flexible-pill"}>
                                        {smartRecurringActive ? "AUTONOMOUS" : "FLEXIBLE"}
                                    </span>
                                    </div>

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

                                            <label>
                                                <input
                                                    type="checkbox"
                                                    checked={editIsRecurring}
                                                    onChange={e => setEditIsRecurring(e.target.checked)}
                                                />
                                            </label>

                                            {editIsRecurring && (
                                                <div>
                                                    <select value={editRecurringDays} onChange={e => setEditRecurringDays(e.target.value)}>
                                                        <option value="DAILY">Every Day</option>
                                                        <option value="WEEKDAYS">Weekdays (Mon-Fri)</option>
                                                        <option value="WEEKENDS">Weekends (Sat-Sun)</option>
                                                    </select>
                                                    <div>
                                                        <span>Duration:</span>
                                                        <select value={editPreferredDuration} onChange={e => setEditPreferredDuration(e.target.value)}>
                                                            <option value="1">1 hour</option>
                                                            <option value="2">2 hours</option>
                                                            <option value="3">3 hours</option>
                                                            <option value="4">4 hours</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <span>Window:</span>
                                                        <input type="time" value={editWindowStart} onChange={e => setEditWindowStart(e.target.value)} />
                                                        <span>to</span>
                                                        <input type="time" value={editWindowEnd} onChange={e => setEditWindowEnd(e.target.value)} />
                                                    </div>
                                                </div>
                                            )}

                                            <div>
                                                <button type="submit">Save</button>
                                                <button type="button" onClick={() => setEditingId(null)}>Cancel</button>
                                            </div>
                                        </form>
                                    ) : (
                                        <>
                                            <div className="appliance-actions">
                                                <button className="text-button" type="button" onClick={() => startEditing(app)}>
                                                    Edit
                                                </button>
                                                <button className="text-button danger-button" type="button" onClick={() => handleDeleteAppliance(app.id)}>
                                                    Delete
                                                </button>
                                            </div>
                                        </>
                                    )}

                                    {!smartRecurringActive && (
                                        <div className="recommendation-controls">
                                            <div className="control-group">
                                                <label htmlFor={`duration-${app.id}`}>Runtime</label>
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
                                            </div>
                                            <div className="control-group">
                                                <label htmlFor={`earliest-${app.id}`}>Earliest start</label>
                                                <input
                                                    id={`earliest-${app.id}`}
                                                    type="datetime-local"
                                                    value={getDispatchWindow(app.id).earliestStart}
                                                    onChange={(e) => updateDispatchWindow(app.id, 'earliestStart', e.target.value)}
                                                />
                                            </div>
                                            <div className="control-group">
                                                <label htmlFor={`latest-${app.id}`}>Must finish by</label>
                                                <input
                                                    id={`latest-${app.id}`}
                                                    type="datetime-local"
                                                    value={getDispatchWindow(app.id).latestEnd}
                                                    onChange={(e) => updateDispatchWindow(app.id, 'latestEnd', e.target.value)}
                                                />
                                            </div>

                                            <button
                                                className="dispatch-button"
                                                type="button"
                                                onClick={() => handleGetRecommendation(app.id)}
                                                disabled={loadingApplianceId === app.id}
                                            >
                                                {loadingApplianceId === app.id ? 'Scanning energy windows...' : 'Find cleanest window'}
                                            </button>
                                        </div>
                                    )}

                                    {recommendations[app.id] && !smartRecurringActive && (() => {
                                        const scores = getTransparentScorecard(recommendations[app.id]);
                                        return (
                                            <div className="transparent-scorecard">
                                                <h5>
                                                    Transparent Decision Scorecard
                                                </h5>

                                                <div>
                                                    <div><strong>Carbon score:</strong> {scores.carbonScore}/100</div>
                                                    <div><strong>Renewable availability:</strong> {scores.renewableAvailability}%</div>
                                                    <div><strong>Price score:</strong> {scores.priceScore}/100</div>
                                                    <div><strong>Grid stress:</strong> <span>{scores.gridStress}</span></div>
                                                </div>

                                                <div>
                                                    <span><strong>AI Confidence:</strong> {scores.confidence}%</span>
                                                    <span><strong>Optimization Basis:</strong> Multi-factor solar & grid model</span>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            );
                        })}
                            </div>
                        </section>
                    ))
                )}
            </section>

            {/* Navigation between days */}
            <section className="scheduled-section">
                <div>
                    <h2>My Active Eco-Schedules</h2>

                    <div className="schedule-summary-bar">
                        <span className="summary-pill-pending">
                            {scheduledStats.PENDING} Pending
                        </span>
                        <span className="summary-pill-running">
                            {scheduledStats.RUNNING} Running
                        </span>
                        <span className="summary-pill-completed">
                            {scheduledStats.COMPLETED} Completed
                        </span>
                    </div>

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
                    <>
                        <div className="scheduled-group">
                            <h3 className="scheduled-group-title">Smart Recurring Rules (automatic)</h3>
                            {smartTasks.length === 0 ? (
                                <p>No automatic dispatches for {selectedDate}.</p>
                            ) : (
                                <div className="scheduled-grid">
                                    {smartTasks.map(renderTaskCard)}
                                </div>
                            )}
                        </div>

                        <div className="scheduled-group">
                            <h3 className="scheduled-group-title">Manual schedules</h3>
                            {manualTasks.length === 0 ? (
                                <p>No manual schedules for {selectedDate}.</p>
                            ) : (
                                <div className="scheduled-grid">
                                    {manualTasks.map(renderTaskCard)}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </section>

            <section className="eco-analytics-section">
                <EcoAnalyticsWidget userId={userId}/>
            </section>

            <HabitLearningSettings userId={userId}/>
        </div>
    );
}

export default Dashboard;