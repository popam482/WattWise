import {useState, useEffect, useCallback} from 'react';
import {Sun, Plug, Zap, Leaf, Cable, LogOut, Plus} from 'lucide-react';
import WeatherSolarWidget from '../widgets/WeatherSolarWidget';
import NationalGridWidget from "../widgets/NationalGridWidget";
import EcoAnalyticsWidget from '../widgets/EcoAnalyticsWidget';
import HabitLearningSettings from '../privacy/HabitLearningSettings';
import EcoChatWidget from "../widgets/EcoChatWidget.jsx";
import ConnectProviderModal from "../connectors/ConnectProviderModal.jsx";

const glass = "rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-md";
const inputCls = "w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500/50 focus:outline-none";
const selectCls = inputCls;
const ghostBtn = "rounded-xl border border-slate-700 bg-transparent px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800";
const primaryBtn = "rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40";
const dangerText = "text-sm text-rose-400 hover:text-rose-300";
const softText = "text-sm text-slate-400 hover:text-slate-200";

function statusTone(color) {
    if (color === 'green') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
    if (color === 'yellow') return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
    return 'border-blue-500/30 bg-blue-500/10 text-blue-300';
}

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
    const [liveEnergy, setLiveEnergy] = useState(null);

    const [aiBriefing, setAiBriefing] = useState("");
    const [ecoAnalytics, setEcoAnalytics] = useState({
        totalSavedCo2Kg: 0,
        totalSavedMoneyRon: 0
    });
    const [showIntegrations, setShowIntegrations] = useState(false);

    const getAuthHeaders = () => {
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            ...(token ? {'Authorization': `Bearer ${token}`} : {})
        };
    };

    useEffect(() => {
        if (!userId) return;

        fetch(`/users/${userId}/energy`, {
            headers: getAuthHeaders()
        })
            .then(res => res.ok ? res.json() : null)
            .then(data => setEnergyProfile(data))
            .catch(() => setEnergyProfile(null));
    }, [userId]);

    useEffect(() => {
        if (!userId) return;

        const pullLive = () => {
            fetch(`/users/${userId}/live-energy`, {headers: getAuthHeaders()})
                .then(res => (res.ok ? res.json() : null))
                .then(data => {
                    if (data) setLiveEnergy(data);
                })
                .catch(() => {});
        };

        pullLive();
        const id = setInterval(pullLive, 30000);
        return () => clearInterval(id);
    }, [userId]);

    useEffect(() => {
        const timer = setInterval(() => setTicks(t => t + 1), 60000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!userId) return;

        fetch('/api/ai/briefing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_name: userName || "User",
                user_type: userType || "PROSUMER",
                saved_co2_kg: ecoAnalytics.totalSavedCo2Kg || 0,
                saved_money_ron: ecoAnalytics.totalSavedMoneyRon || 0,
                active_schedules_count: scheduledTasks.length
            })
        })
            .then(async res => {
                if (!res.ok) {
                    throw new Error(`AI briefing request failed (${res.status})`);
                }
                return res.json();
            })
            .then(data => {
                if (typeof data?.briefing === 'string' && data.briefing.trim()) {
                    setAiBriefing(data.briefing.trim());
                }
            })
            .catch(err => console.error("AI Briefing fetch error:", err));
    }, [userId, userName, userType, scheduledTasks.length, ecoAnalytics.totalSavedCo2Kg, ecoAnalytics.totalSavedMoneyRon]);

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
            method: "DELETE",
            headers: getAuthHeaders()
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
            .catch(err => setError(err.message || 'Could not get recommendation'))
            .finally(() => setLoadingApplianceId(null));
    };

    const handleConfirmSchedule = (applianceId) => {
        const rec = recommendations[applianceId];
        if (!rec?.best_start_time) {
            setError('No recommendation available to schedule. Find a clean window first.');
            return;
        }

        const payload = {
            id: applianceId,
            startTime: String(rec.best_start_time).replace(" ", "T"),
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
            <div key={task.id} className={`${glass} p-4`}>
                <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusTone(taskStatus.color)}`}>
                    {taskStatus.label}
                </span>
                <p className="mt-1 text-xs text-slate-500">{taskStatus.desc}</p>
                <h3 className="mt-3 text-base font-semibold text-slate-100">{task.applianceName}</h3>
                <p className="mt-2 text-sm text-slate-400">
                    <span className="text-slate-500">Start:</span>{' '}
                    {new Date(task.startTime).toLocaleString()}
                </p>
                <p className="text-sm text-slate-400">
                    <span className="text-slate-500">Duration:</span> {task.durationMinutes} mins
                </p>
                {task.savedCo2Grams > 0 && (
                    <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                        Eco-Impact: avoided {(task.savedCo2Grams >= 1000 ? (task.savedCo2Grams / 1000).toFixed(2) + ' kg' : task.savedCo2Grams.toFixed(0) + ' g')} CO₂
                    </div>
                )}
                {task.savedMoneyRon > 0 && (
                    <div className="mt-2 rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs text-blue-300">
                        Saved {task.savedMoneyRon.toFixed(2)} RON
                    </div>
                )}
                {taskStatus.label !== 'COMPLETED' && (
                    <button
                        type="button"
                        className={`${ghostBtn} mt-3 w-full`}
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

    const solarKw = Number(liveEnergy?.pvPowerKw);
    const loadKw = Number(liveEnergy?.homeLoadKw);
    const hasSolar = Number.isFinite(solarKw);
    const hasLoad = Number.isFinite(loadKw);
    const netKw = hasSolar && hasLoad ? solarKw - loadKw : null;
    const liveSources = [
        liveEnergy?.solarLive ? 'Open-Meteo' : null,
        liveEnergy?.shellyLive ? 'Shelly' : null
    ].filter(Boolean);
    const liveLabel = liveSources.length
        ? `LIVE DATA: ${liveSources.join(' & ')}`
        : 'LIVE DATA: Open-Meteo & Shelly';

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
            <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.08),_transparent_50%),radial-gradient(ellipse_at_bottom_right,_rgba(59,130,246,0.07),_transparent_45%)]" />

            <div className="relative mx-auto max-w-7xl space-y-6 px-4 py-6 pb-28 sm:px-6 lg:px-8">
                <header className={`${glass} flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5`}>
                    <div className="flex items-center gap-3">
                        <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-500/40 bg-emerald-500/15 text-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.35)]">
                            <Zap className="h-5 w-5" />
                            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight text-slate-100">WattWise</h1>
                            <p className="text-sm text-slate-400">
                                {ecoMessage?.welcomeMessage || 'Welcome'}, {userName || 'User'}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
                            <span className="relative flex h-2 w-2">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                                <span className="relative inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                            </span>
                            {liveLabel}
                        </span>
                        <button
                            type="button"
                            className={ghostBtn}
                            onClick={() => setShowIntegrations(true)}
                        >
                            <span className="inline-flex items-center gap-2">
                                <Cable className="h-4 w-4" />
                                Integrations
                            </span>
                        </button>
                        <button type="button" onClick={onLogout} className={ghostBtn}>
                            <span className="inline-flex items-center gap-2">
                                <LogOut className="h-4 w-4" />
                                Logout
                            </span>
                        </button>
                    </div>
                </header>

                {ecoMessage?.content && (
                    <p className="text-sm text-slate-400">
                        <span className="font-medium text-emerald-400">Tip of the day:</span> {ecoMessage.content}
                    </p>
                )}

                {aiBriefing && (
                    <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-950/40 to-blue-950/40 p-6">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-300">
                                WattAssistant
                            </span>
                            <strong className="text-slate-100">AI Executive Briefing</strong>
                        </div>
                        <p className="text-sm leading-relaxed text-slate-300">{aiBriefing}</p>
                    </div>
                )}

                {error && (
                    <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                        {error}
                    </div>
                )}

                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <div className={`${glass} border-emerald-500/20 p-5`}>
                        <div className="mb-3 flex items-center justify-between">
                            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Live Solar Production</p>
                            <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 text-emerald-400">
                                <Sun className="h-4 w-4" />
                            </span>
                        </div>
                        <p className="text-3xl font-bold text-emerald-400">
                            {hasSolar ? solarKw.toFixed(2) : '—'}
                            <span className="ml-1 text-base font-medium text-slate-500">kW</span>
                        </p>
                    </div>

                    <div className={`${glass} border-blue-500/20 p-5`}>
                        <div className="mb-3 flex items-center justify-between">
                            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Current Home Load</p>
                            <span className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-2 text-blue-400">
                                <Plug className="h-4 w-4" />
                            </span>
                        </div>
                        <p className="text-3xl font-bold text-blue-400">
                            {hasLoad ? loadKw.toFixed(2) : '—'}
                            <span className="ml-1 text-base font-medium text-slate-500">kW</span>
                        </p>
                    </div>

                    <div className={`${glass} p-5`}>
                        <div className="mb-3 flex items-center justify-between">
                            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Grid Balance</p>
                            <span className="rounded-lg border border-slate-700 bg-slate-950/60 p-2 text-slate-300">
                                <Zap className="h-4 w-4" />
                            </span>
                        </div>
                        <p className={`text-3xl font-bold ${netKw == null ? 'text-slate-300' : netKw >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {netKw == null ? '—' : `${netKw >= 0 ? '+' : ''}${netKw.toFixed(2)}`}
                            <span className="ml-1 text-base font-medium text-slate-500">kW</span>
                        </p>
                        {netKw != null && (
                            <span className={`mt-2 inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                                netKw >= 0
                                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                                    : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                            }`}>
                                {netKw >= 0 ? 'EXPORTING' : 'IMPORTING'}
                            </span>
                        )}
                    </div>

                    <div className={`${glass} p-5`}>
                        <div className="mb-3 flex items-center justify-between">
                            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Eco Savings</p>
                            <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 text-emerald-400">
                                <Leaf className="h-4 w-4" />
                            </span>
                        </div>
                        <p className="text-2xl font-bold text-slate-100">
                            {(ecoAnalytics.totalSavedCo2Kg || 0).toFixed?.(1) ?? ecoAnalytics.totalSavedCo2Kg}
                            <span className="ml-1 text-sm font-medium text-slate-500">kg CO₂</span>
                        </p>
                        <p className="mt-1 text-lg font-semibold text-blue-400">
                            {(ecoAnalytics.totalSavedMoneyRon || 0).toFixed?.(2) ?? ecoAnalytics.totalSavedMoneyRon}
                            <span className="ml-1 text-sm font-medium text-slate-500">RON</span>
                        </p>
                    </div>
                </section>

                <section className="grid gap-6 lg:grid-cols-5">
                    <div className="space-y-6 lg:col-span-3">
                        <div className={`${glass} p-5`}>
                            <WeatherSolarWidget
                                userId={userId}
                                energyProfile={energyProfile}
                                latitude={energyProfile?.latitude}
                                longitude={energyProfile?.longitude}
                                pvSystemKw={energyProfile?.pvSystemKw}
                            />
                        </div>
                        <div className={`${glass} p-5`}>
                            <NationalGridWidget userId={userId}/>
                        </div>
                    </div>

                    <div className={`lg:col-span-2 ${glass} p-5`}>
                        <div className="mb-4">
                            <h2 className="text-lg font-semibold text-slate-100">Autonomous Dispatch</h2>
                            <p className="mt-1 text-sm text-slate-400">Define the rules. We find the greenest run.</p>
                        </div>

                        <form onSubmit={handleAddAppliance} className="mb-6 space-y-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                            <div className="grid gap-2 sm:grid-cols-[1fr_100px_auto]">
                                <input type="text" placeholder="Appliance name (e.g. EV Charger)" value={newName} onChange={e => setNewName(e.target.value)} required className={inputCls} />
                                <input type="number" step="0.1" min="0" placeholder="kW" value={newPower} onChange={e => setNewPower(e.target.value)} required className={inputCls} />
                                <button type="submit" className={`${primaryBtn} inline-flex items-center justify-center gap-1.5`}>
                                    <Plus className="h-4 w-4" />
                                    Add
                                </button>
                            </div>

                            <label className="flex items-center gap-3 text-sm text-slate-300">
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={newIsRecurring}
                                    onClick={() => setNewIsRecurring(v => !v)}
                                    className={`relative h-6 w-11 rounded-full border transition ${
                                        newIsRecurring
                                            ? 'border-emerald-500/40 bg-emerald-500/30'
                                            : 'border-slate-600 bg-slate-800'
                                    }`}
                                >
                                    <span className={`absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white transition ${
                                        newIsRecurring ? 'left-5' : 'left-0.5'
                                    }`} style={{width: 18, height: 18, top: 3}} />
                                </button>
                                Enable Smart Recurring Rule
                            </label>

                            {newIsRecurring && (
                                <div className="grid gap-2 sm:grid-cols-2">
                                    <select value={newRecurringDays} onChange={e => setNewRecurringDays(e.target.value)} className={selectCls}>
                                        <option value="DAILY">Every Day</option>
                                        <option value="WEEKDAYS">Weekdays (Mon-Fri)</option>
                                        <option value="WEEKENDS">Weekends (Sat-Sun)</option>
                                    </select>
                                    <select value={newPreferredDuration} onChange={e => setNewPreferredDuration(e.target.value)} className={selectCls}>
                                        <option value="1">1 hour</option>
                                        <option value="2">2 hours</option>
                                        <option value="3">3 hours</option>
                                        <option value="4">4 hours</option>
                                    </select>
                                    <input type="time" value={newWindowStart} onChange={e => setNewWindowStart(e.target.value)} className={inputCls} />
                                    <input type="time" value={newWindowEnd} onChange={e => setNewWindowEnd(e.target.value)} className={inputCls} />
                                </div>
                            )}
                        </form>

                        {userAppliances.length === 0 ? (
                            <p className="text-sm text-slate-500">You don't have any appliance added yet</p>
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
                                <section className="mb-6 last:mb-0" key={group.key}>
                                    <div className="mb-3">
                                        <h3 className="text-sm font-semibold text-slate-200">{group.title}</h3>
                                        <p className="text-xs text-slate-500">{group.description}</p>
                                    </div>
                                    <div className="space-y-3">
                                        {group.appliances.map(app => {
                                            const smartRecurringActive = editingId === app.id
                                                ? editIsRecurring
                                                : isSmartRecurring(app);

                                            return (
                                                <div key={app.id} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                                                    <div className="mb-3 flex items-start justify-between gap-2">
                                                        <div>
                                                            <h3 className="font-semibold text-slate-100">{app.name}</h3>
                                                            <span className="text-xs text-slate-500">{app.powerConsumptionKw} kW flexible load</span>
                                                        </div>
                                                        <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wide ${
                                                            smartRecurringActive
                                                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                                                                : 'border-blue-500/30 bg-blue-500/10 text-blue-300'
                                                        }`}>
                                                            {smartRecurringActive ? 'AUTONOMOUS' : 'FLEXIBLE'}
                                                        </span>
                                                    </div>

                                                    {editingId === app.id ? (
                                                        <form onSubmit={e => handleSaveEdit(e, app.id)} className="space-y-2">
                                                            <input type="text" value={editName} onChange={e => setEditName(e.target.value)} required className={inputCls} />
                                                            <input type="number" step="0.1" min="0" value={editPower} onChange={e => setEditPower(e.target.value)} required className={inputCls} />
                                                            <label className="flex items-center gap-2 text-sm text-slate-300">
                                                                <input type="checkbox" checked={editIsRecurring} onChange={e => setEditIsRecurring(e.target.checked)} className="accent-emerald-500" />
                                                                Smart recurring
                                                            </label>
                                                            {editIsRecurring && (
                                                                <div className="grid gap-2">
                                                                    <select value={editRecurringDays} onChange={e => setEditRecurringDays(e.target.value)} className={selectCls}>
                                                                        <option value="DAILY">Every Day</option>
                                                                        <option value="WEEKDAYS">Weekdays (Mon-Fri)</option>
                                                                        <option value="WEEKENDS">Weekends (Sat-Sun)</option>
                                                                    </select>
                                                                    <select value={editPreferredDuration} onChange={e => setEditPreferredDuration(e.target.value)} className={selectCls}>
                                                                        <option value="1">1 hour</option>
                                                                        <option value="2">2 hours</option>
                                                                        <option value="3">3 hours</option>
                                                                        <option value="4">4 hours</option>
                                                                    </select>
                                                                    <div className="grid grid-cols-2 gap-2">
                                                                        <input type="time" value={editWindowStart} onChange={e => setEditWindowStart(e.target.value)} className={inputCls} />
                                                                        <input type="time" value={editWindowEnd} onChange={e => setEditWindowEnd(e.target.value)} className={inputCls} />
                                                                    </div>
                                                                </div>
                                                            )}
                                                            <div className="flex gap-2">
                                                                <button type="submit" className={primaryBtn}>Save</button>
                                                                <button type="button" className={ghostBtn} onClick={() => setEditingId(null)}>Cancel</button>
                                                            </div>
                                                        </form>
                                                    ) : (
                                                        <div className="mb-3 flex gap-3">
                                                            <button className={softText} type="button" onClick={() => startEditing(app)}>Edit</button>
                                                            <button className={dangerText} type="button" onClick={() => handleDeleteAppliance(app.id)}>Delete</button>
                                                        </div>
                                                    )}

                                                    {!smartRecurringActive && (
                                                        <div className="space-y-2 border-t border-slate-800 pt-3">
                                                            <div className="grid gap-2">
                                                                <label className="text-xs text-slate-500" htmlFor={`duration-${app.id}`}>Runtime</label>
                                                                <select id={`duration-${app.id}`} value={applianceDuration[app.id] || 2} onChange={(e) => handleDurationChange(app.id, e.target.value)} className={selectCls}>
                                                                    <option value={1}>1 hour</option>
                                                                    <option value={2}>2 hours</option>
                                                                    <option value={3}>3 hours</option>
                                                                    <option value={4}>4 hours</option>
                                                                </select>
                                                                <label className="text-xs text-slate-500" htmlFor={`earliest-${app.id}`}>Earliest start</label>
                                                                <input id={`earliest-${app.id}`} type="datetime-local" value={getDispatchWindow(app.id).earliestStart} onChange={(e) => updateDispatchWindow(app.id, 'earliestStart', e.target.value)} className={inputCls} />
                                                                <label className="text-xs text-slate-500" htmlFor={`latest-${app.id}`}>Must finish by</label>
                                                                <input id={`latest-${app.id}`} type="datetime-local" value={getDispatchWindow(app.id).latestEnd} onChange={(e) => updateDispatchWindow(app.id, 'latestEnd', e.target.value)} className={inputCls} />
                                                            </div>
                                                            <button className={`${primaryBtn} w-full`} type="button" onClick={() => handleGetRecommendation(app.id)} disabled={loadingApplianceId === app.id}>
                                                                {loadingApplianceId === app.id ? 'Scanning energy windows...' : 'Find cleanest window'}
                                                            </button>
                                                        </div>
                                                    )}

                                                    {recommendations[app.id] && !smartRecurringActive && (() => {
                                                        const rec = recommendations[app.id];
                                                        const scores = getTransparentScorecard(rec) || {};
                                                        const alreadyScheduled = scheduledStatus[app.id];
                                                        return (
                                                            <div className="mt-3 space-y-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <h5 className="text-sm font-semibold text-slate-100">Transparent Decision Scorecard</h5>
                                                                    {alreadyScheduled && (
                                                                        <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-300">SCHEDULED</span>
                                                                    )}
                                                                </div>
                                                                <div className="text-sm text-slate-300">
                                                                    <strong className="text-slate-100">Best window:</strong>{' '}
                                                                    {rec.best_start_time || '—'}
                                                                    {rec.best_end_time ? ` → ${rec.best_end_time}` : ''}
                                                                </div>
                                                                {rec.reason && <p className="text-xs text-slate-400">{rec.reason}</p>}
                                                                <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                                                                    <div>Carbon: <span className="font-semibold text-emerald-300">{scores.carbonScore ?? '—'}/100</span></div>
                                                                    <div>Renewable: <span className="font-semibold text-emerald-300">{scores.renewableAvailability ?? '—'}%</span></div>
                                                                    <div>Price: <span className="font-semibold text-blue-300">{scores.priceScore ?? '—'}/100</span></div>
                                                                    <div>Grid stress: <span className="font-semibold text-slate-200">{scores.gridStress ?? '—'}</span></div>
                                                                </div>
                                                                <div className="flex flex-wrap gap-3 text-[11px] text-slate-500">
                                                                    <span>AI Confidence: {scores.confidence ?? '—'}%</span>
                                                                    <span>Multi-factor solar & grid model</span>
                                                                </div>
                                                                <button className={`${primaryBtn} w-full`} type="button" onClick={() => handleConfirmSchedule(app.id)} disabled={alreadyScheduled}>
                                                                    {alreadyScheduled ? 'Scheduled ✓' : 'Confirm Schedule'}
                                                                </button>
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
                    </div>
                </section>

                <section className={`${glass} p-5 sm:p-6`}>
                    <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-100">My Active Eco-Schedules</h2>
                            <div className="mt-2 flex flex-wrap gap-2">
                                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs text-amber-300">{scheduledStats.PENDING} Pending</span>
                                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs text-emerald-300">{scheduledStats.RUNNING} Running</span>
                                <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-xs text-blue-300">{scheduledStats.COMPLETED} Completed</span>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <button type="button" className={ghostBtn} onClick={() => setSelectedDate(getTodayString())}>Today</button>
                            <button
                                type="button"
                                className={ghostBtn}
                                onClick={() => {
                                    const tomorrow = new Date();
                                    tomorrow.setDate(tomorrow.getDate() + 1);
                                    setSelectedDate(formatLocalDate(tomorrow));
                                }}
                            >
                                Tomorrow
                            </button>
                            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className={inputCls} />
                        </div>
                    </div>

                    {scheduledTasks.length === 0 ? (
                        <p className="text-sm text-slate-500">No active eco-schedules for {selectedDate}.</p>
                    ) : (
                        <div className="space-y-6">
                            <div>
                                <h3 className="mb-3 text-sm font-semibold text-slate-300">Smart Recurring Rules (automatic)</h3>
                                {smartTasks.length === 0 ? (
                                    <p className="text-sm text-slate-500">No automatic dispatches for {selectedDate}.</p>
                                ) : (
                                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                        {smartTasks.map(renderTaskCard)}
                                    </div>
                                )}
                            </div>
                            <div>
                                <h3 className="mb-3 text-sm font-semibold text-slate-300">Manual schedules</h3>
                                {manualTasks.length === 0 ? (
                                    <p className="text-sm text-slate-500">No manual schedules for {selectedDate}.</p>
                                ) : (
                                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                        {manualTasks.map(renderTaskCard)}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </section>

                <section className={`${glass} p-5 sm:p-6`}>
                    <EcoAnalyticsWidget userId={userId} onAnalyticsLoaded={setEcoAnalytics}/>
                </section>

                <HabitLearningSettings userId={userId}/>

                <EcoChatWidget
                    userId={userId}
                    userName={userName}
                    userType={userType}
                    ecoAnalytics={ecoAnalytics}
                    userAppliances={userAppliances}
                    scheduledTasks={scheduledTasks}
                />
                <ConnectProviderModal
                    userId={userId}
                    open={showIntegrations}
                    onClose={() => setShowIntegrations(false)}
                />
            </div>
        </div>
    );
}

export default Dashboard;
