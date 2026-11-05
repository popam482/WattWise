import {useState, useEffect, useCallback} from 'react';
import {Sun, Moon, Plug, Zap, Leaf, Cable, LogOut, Plus, Activity, CalendarClock, UserRound} from 'lucide-react';
import WeatherSolarWidget from '../widgets/WeatherSolarWidget';
import NationalGridWidget from "../widgets/NationalGridWidget";
import EcoAnalyticsWidget from '../widgets/EcoAnalyticsWidget';
import EcoChatWidget from "../widgets/EcoChatWidget.jsx";
import ConnectProviderModal from "../connectors/ConnectProviderModal.jsx";
import UserProfileModal from '../settings/UserProfileModal.jsx';
import ApplianceScheduler, {
    RecurringApprovalModal,
    RecurringCancelModal,
    RecurringModeSwitch
} from './ApplianceScheduler.jsx';
import {useTheme} from '../theme/ThemeContext.jsx';
import SolarPulseHero from './SolarPulseHero.jsx';
import {
    glass,
    surface,
    inset,
    inputCls,
    selectCls,
    ghostBtn,
    primaryBtn,
    sectionTitle,
    sectionSub
} from '../ui/ecoStyles.js';
import {Reveal, RevealItem, RevealStagger} from '../ui/Reveal.jsx';

function pad2(n) {
    return String(n).padStart(2, '0');
}

function formatDateLocal(d) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Next calendar day matching DAILY / WEEKDAYS / WEEKENDS. */
function nextRecurrenceDate(recurringDays) {
    const rule = String(recurringDays || 'DAILY').toUpperCase();
    const base = new Date();
    for (let i = 0; i < 8; i++) {
        const candidate = new Date(base);
        candidate.setDate(base.getDate() + i);
        const day = candidate.getDay(); // 0=Sun
        if (rule === 'DAILY') return candidate;
        if (rule === 'WEEKDAYS' && day >= 1 && day <= 5) return candidate;
        if (rule === 'WEEKENDS' && (day === 0 || day === 6)) return candidate;
    }
    return base;
}

function formatLocalDatetimeInput(d) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Round UP to next :00 / :15 / :30 / :45 (18:38 → 18:45, 18:52 → 19:00). */
function snapToNext15Min(dateOrValue) {
    let d;
    if (dateOrValue instanceof Date) {
        d = new Date(dateOrValue.getTime());
    } else {
        d = new Date(String(dateOrValue || '').replace(' ', 'T'));
    }
    if (Number.isNaN(d.getTime())) {
        d = new Date();
    }
    d.setSeconds(0, 0);
    const remainder = d.getMinutes() % 15;
    if (remainder !== 0) {
        d.setMinutes(d.getMinutes() + (15 - remainder));
    }
    return formatLocalDatetimeInput(d);
}

/** Current local time snapped UP to the next 15-minute mark. */
function nowLocalDatetimeValue() {
    return snapToNext15Min(new Date());
}

/** Snap hard deadlines DOWN so we never push mustFinishBy past the user limit. */
function snapToPrevious15MinValue(value) {
    const parsed = parseLocalDateTimeFlexible(value);
    if (!parsed) return value;
    parsed.setSeconds(0, 0);
    const remainder = parsed.getMinutes() % 15;
    if (remainder !== 0) parsed.setMinutes(parsed.getMinutes() - remainder);
    return formatLocalDatetimeInput(parsed);
}

function parseLocalDateTimeFlexible(value) {
    if (!value) return null;
    const date = new Date(String(value).replace(' ', 'T'));
    return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Clamp earliest to now (snap up). Preserve must-finish-by as a hard deadline (snap down).
 * Never silently expand a user deadline — that caused starts AT the deadline (e.g. 10:00–12:00).
 */
function clampDispatchWindow(earliestStart, latestEnd, { allowExpandMissingLatest = false } = {}) {
    const nowVal = nowLocalDatetimeValue();
    let earliest = snapToNext15Min(
        earliestStart && earliestStart >= nowVal ? earliestStart : nowVal
    );
    let latest = latestEnd ? snapToPrevious15MinValue(latestEnd) : latestEnd;

    if (!latest) {
        if (allowExpandMissingLatest) {
            const end = new Date(earliest.replace('T', ' '));
            if (Number.isNaN(end.getTime())) {
                const fallback = new Date();
                fallback.setDate(fallback.getDate() + 2);
                fallback.setHours(0, 0, 0, 0);
                latest = formatLocalDatetimeInput(fallback);
            } else {
                end.setHours(end.getHours() + 26);
                latest = snapToNext15Min(end);
            }
        }
        return {earliestStart: earliest, latestEnd: latest};
    }

    // Do not auto-extend a provided deadline when it falls before earliest
    return {earliestStart: earliest, latestEnd: latest};
}

function buildRecurringDispatchWindow(recurringDays, windowStart, windowEnd) {
    const day = nextRecurrenceDate(recurringDays);
    const dateStr = formatDateLocal(day);
    const start = windowStart || '00:00';
    const end = windowEnd || '23:59';
    const earliestStart = `${dateStr}T${start}`;
    let latestEnd = `${dateStr}T${end}`;
    if (end < start) {
        const next = new Date(day);
        next.setDate(next.getDate() + 1);
        latestEnd = `${formatDateLocal(next)}T${end}`;
    }
    return clampDispatchWindow(earliestStart, latestEnd);
}

const dangerText = "text-sm text-rose-600 hover:text-rose-500 dark:text-rose-400 dark:hover:text-rose-300";
const softText = "text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200";

function statusTone(color) {
    if (color === 'green') return 'border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300';
    if (color === 'yellow') return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300';
    return 'border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300';
}

/** Approximate SEN carbon intensity (gCO₂/kWh) from national grid snapshot. */
function estimateGridCarbonIntensity(grid) {
    if (!grid) return null;
    const production = Number(grid.Production_MW ?? grid.productionMW ?? 0);
    const fossil = Number(grid.Total_Fossil ?? grid.totalFossil ?? 0);
    const nuclear = Number(grid.Nuclear_MW ?? grid.nuclearMW ?? 0);
    const green = Number(
        grid.Total_Green_MW
        ?? grid.totalGreenMW
        ?? Math.max(0, production - fossil - nuclear)
    );

    if (production > 0) {
        // IPCC-aligned rough factors (gCO2/kWh) applied to MW mix
        return Math.round(((fossil * 820) + (nuclear * 12) + (green * 40)) / production);
    }

    const greenShare = Number(grid.Green_Share_Percent ?? grid.greenSharePercent);
    if (Number.isFinite(greenShare)) {
        return Math.round(480 - (greenShare * 3.2));
    }
    return null;
}

function isProsumerUser(userType, energyProfile) {
    const typedProsumer = String(userType || '').toUpperCase() === 'PROSUMER';
    const flaggedSolar = energyProfile?.hasSolar === true;
    const pvKw = Number(energyProfile?.pvSystemKw ?? energyProfile?.pv_system_kw);
    const hasPvCapacity = Number.isFinite(pvKw) && pvKw > 0;
    return typedProsumer || flaggedSolar || hasPvCapacity;
}

function Dashboard({userId, userName, userEmail, userType, onLogout}) {
    const {isDark, toggleTheme} = useTheme();
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
    const [gridSnapshot, setGridSnapshot] = useState(null);

    const [aiBriefing, setAiBriefing] = useState("");
    const [ecoAnalytics, setEcoAnalytics] = useState({
        totalSavedCo2Kg: 0,
        totalSavedMoneyRon: 0,
        totalCompletedTasks: 0
    });
    const [analyticsReady, setAnalyticsReady] = useState(false);
    const [showIntegrations, setShowIntegrations] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    const [schedulingAppliance, setSchedulingAppliance] = useState(null);
    const [schedulerStep, setSchedulerStep] = useState(null); // 'config' | 'result'
    const [confirmingSchedule, setConfirmingSchedule] = useState(false);

    const [recurringApproval, setRecurringApproval] = useState(null); // { appliance, recommendation, loading, source }
    const [approvingRecurring, setApprovingRecurring] = useState(false);
    const [cancelTarget, setCancelTarget] = useState(null); // { logId?, applianceId, applianceName, date }
    const [cancelBusy, setCancelBusy] = useState(false);
    /** Inline Manual→Automatic config draft on a card (before preview). */
    const [modeSwitchDraft, setModeSwitchDraft] = useState(null); // { applianceId, recurringDays, preferredDuration, windowStart, windowEnd, busy }
    const [modeSwitchBusyId, setModeSwitchBusyId] = useState(null);

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
        if (!userId) return;

        const pullGrid = () => {
            fetch('/api/national-grid/current')
                .then(async res => {
                    if (!res.ok) return null;
                    const body = await res.text();
                    if (!body.trim()) return null;
                    try {
                        return JSON.parse(body);
                    } catch {
                        return null;
                    }
                })
                .then(data => {
                    if (data) setGridSnapshot(data);
                })
                .catch(() => {});
        };

        pullGrid();
        const id = setInterval(pullGrid, 60000);
        return () => clearInterval(id);
    }, [userId]);

    useEffect(() => {
        const timer = setInterval(() => setTicks(t => t + 1), 60000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!userId || !analyticsReady) return;

        fetch('/api/ai/briefing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_name: userName || "User",
                user_type: userType || "PROSUMER",
                saved_co2_kg: ecoAnalytics.totalSavedCo2Kg || 0,
                saved_money_ron: ecoAnalytics.totalSavedMoneyRon || 0,
                optimized_runs_count: ecoAnalytics.totalCompletedTasks || 0,
                active_schedules_count: scheduledTasks.length,
                top_solar_hour: "13:00"
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
    }, [userId, userName, userType, scheduledTasks.length, analyticsReady, ecoAnalytics.totalSavedCo2Kg, ecoAnalytics.totalSavedMoneyRon, ecoAnalytics.totalCompletedTasks]);

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
    const getTomorrowString = () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return formatLocalDate(tomorrow);
    };
    const [selectedDate, setSelectedDate] = useState(getTodayString());
    const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);

    const [error, setError] = useState('');

    const fetchScheduledTasks = useCallback(() => {
        if (!userId) return Promise.resolve([]);
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

    /** Today / Tomorrow / date-picker — show skeleton while schedules reload. */
    const selectScheduleDate = (nextDate) => {
        if (!nextDate || nextDate === selectedDate) return;
        setIsLoadingSchedule(true);
        setSelectedDate(nextDate);
    };

    useEffect(() => {
        let cancelled = false;
        const startedAt = Date.now();

        (async () => {
            await fetchScheduledTasks();
            if (cancelled) return;
            const elapsed = Date.now() - startedAt;
            const wait = Math.max(0, 280 - elapsed);
            if (wait > 0) {
                await new Promise(resolve => setTimeout(resolve, wait));
            }
            if (!cancelled) setIsLoadingSchedule(false);
        })();

        return () => {
            cancelled = true;
        };
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
        if (existing) {
            return clampDispatchWindow(existing.earliestStart, existing.latestEnd);
        }

        const start = new Date();
        start.setSeconds(0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 2);
        end.setHours(0, 0, 0, 0);

        return clampDispatchWindow(
            formatLocalDatetimeInput(start),
            formatLocalDatetimeInput(end)
        );
    };

    const updateDispatchWindow = (applianceId, field, value) => {
        setDispatchWindow(prev => {
            const current = prev[applianceId] || getDispatchWindow(applianceId);
            const next = { ...current, [field]: value };
            return {
                ...prev,
                [applianceId]: clampDispatchWindow(next.earliestStart, next.latestEnd)
            };
        });
    };

    const resetAddForm = () => {
        setNewName("");
        setNewPower("");
        setNewIsRecurring(false);
        setNewRecurringDays("DAILY");
        setNewPreferredDuration("2");
        setNewWindowStart("22:00");
        setNewWindowEnd("07:00");
    };

    const handleAddAppliance = (e) => {
        e.preventDefault();
        if (!newName || !newPower) return;
        setError('');

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
            .then(async (created) => {
                if (!newIsRecurring) {
                    resetAddForm();
                    fetchAppliances();
                    return;
                }

                // Smart recurring: preview first window before activating in schedules
                const durationHours = parseInt(newPreferredDuration, 10) || 2;
                const window = buildRecurringDispatchWindow(
                    newRecurringDays,
                    newWindowStart,
                    newWindowEnd
                );

                await openRecurringPreview(created, {
                    recurringDays: newRecurringDays,
                    preferredDuration: durationHours,
                    windowStart: newWindowStart,
                    windowEnd: newWindowEnd
                }, 'create');
                resetAddForm();
                fetchAppliances();
            })
            .catch(err => setError(err.message));
    };

    const normalizeRecommendation = (data, durationHours) => {
        if (!data || typeof data !== 'object') return null;
        return {
            ...data,
            best_start_time: data.best_start_time ?? data.bestStartTime ?? null,
            best_end_time: data.best_end_time ?? data.bestEndTime ?? null,
            recommended_carbon_intensity:
                data.recommended_carbon_intensity ?? data.recommendedCarbonIntensity ?? null,
            baseline_carbon_intensity:
                data.baseline_carbon_intensity ?? data.baselineCarbonIntensity ?? null,
            recommended_energy_price:
                data.recommended_energy_price ?? data.recommendedEnergyPrice ?? null,
            baseline_energy_price:
                data.baseline_energy_price ?? data.baselineEnergyPrice ?? null,
            single_run_savings_ron:
                data.single_run_savings_ron ?? data.singleRunSavingsRon ?? null,
            co2_avoided_kg: data.co2_avoided_kg ?? data.co2AvoidedKg ?? null,
            renewable_share_percent:
                data.renewable_share_percent ?? data.renewableSharePercent ?? null,
            is_fixed_tariff: Boolean(data.is_fixed_tariff ?? data.isFixedTariff ?? false),
            run_co2_kg: data.run_co2_kg ?? data.runCo2Kg ?? null,
            co2_comparison_basis:
                data.co2_comparison_basis ?? data.co2ComparisonBasis ?? 'immediate',
            is_already_optimal: Boolean(
                data.is_already_optimal ?? data.isAlreadyOptimal ?? false
            ),
            peak_run_co2_kg: data.peak_run_co2_kg ?? data.peakRunCo2Kg ?? null,
            baseline_run_cost_ron:
                data.baseline_run_cost_ron ?? data.baselineRunCostRon ?? null,
            optimal_run_cost_ron:
                data.optimal_run_cost_ron ?? data.optimalRunCostRon ?? null,
            durationMinutes: durationHours * 60
        };
    };

    /** Opens the Confirm Automatic Schedule modal and fetches the next clean window. */
    const openRecurringPreview = async (appliance, config, source = 'create') => {
        if (!appliance?.id) {
            setError('Missing appliance id — cannot preview automatic schedule.');
            return;
        }

        const pendingConfig = {
            recurringDays: config.recurringDays || 'DAILY',
            preferredDuration: String(config.preferredDuration || 2),
            windowStart: config.windowStart || config.timeWindowStart || '08:00',
            windowEnd: config.windowEnd || config.timeWindowEnd || '22:00',
            name: config.name ?? appliance.name,
            powerConsumptionKw: config.powerConsumptionKw ?? appliance.powerConsumptionKw
        };
        const durationHours = parseInt(pendingConfig.preferredDuration, 10) || 2;
        const window = buildRecurringDispatchWindow(
            pendingConfig.recurringDays,
            pendingConfig.windowStart,
            pendingConfig.windowEnd
        );

        // Always open the modal first — never wait on persistence.
        setError('');
        setEditingId(null);
        setModeSwitchDraft(null);
        setRecurringApproval({
            appliance: {
                ...appliance,
                name: pendingConfig.name,
                powerConsumptionKw: pendingConfig.powerConsumptionKw
            },
            recommendation: null,
            loading: true,
            source,
            pendingConfig
        });

        const query = new URLSearchParams({
            durationHours: String(durationHours),
            earliestStart: window.earliestStart,
            latestEnd: window.latestEnd
        });

        try {
            const res = await fetch(
                `/users/${userId}/appliances/${appliance.id}/recommendation?${query}`,
                { method: 'POST', headers: getAuthHeaders() }
            );
            if (!res.ok) {
                const detail = await res.text();
                throw new Error(detail || `Could not preview schedule (${res.status})`);
            }
            const data = await res.json();
            const recommendation = normalizeRecommendation(data, durationHours);
            setRecurringApproval(prev => prev ? {
                ...prev,
                appliance: {
                    ...appliance,
                    name: pendingConfig.name,
                    powerConsumptionKw: pendingConfig.powerConsumptionKw
                },
                recommendation,
                loading: false,
                source,
                pendingConfig
            } : null);
        } catch (err) {
            setError(err.message || 'Could not preview automatic schedule');
            setRecurringApproval(prev => prev ? {...prev, loading: false, recommendation: null} : null);
        }
    };

    const updateApplianceMode = (applianceId, payload) => {
        // PUT is the primary update verb (CORS + existing clients). PATCH kept as backend alias.
        return fetch(`/users/${userId}/appliances/${applianceId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        }).then(async res => {
            if (!res.ok) {
                const detail = await res.text();
                throw new Error(detail || `Failed to update appliance (${res.status})`);
            }
            const text = await res.text();
            if (!text) return { id: applianceId, ...payload };
            try {
                return JSON.parse(text);
            } catch {
                return { id: applianceId, ...payload };
            }
        });
    };

    const restoreModeSwitchEditor = (appliance, pendingConfig) => {
        if (!appliance?.id) return;
        setModeSwitchDraft(null);
        setEditingId(appliance.id);
        setEditName(pendingConfig?.name ?? appliance.name ?? '');
        setEditPower(String(pendingConfig?.powerConsumptionKw ?? appliance.powerConsumptionKw ?? ''));
        setEditIsRecurring(true);
        setEditRecurringDays(pendingConfig?.recurringDays || 'DAILY');
        setEditPreferredDuration(String(pendingConfig?.preferredDuration || 2));
        setEditWindowStart(pendingConfig?.windowStart || '08:00');
        setEditWindowEnd(pendingConfig?.windowEnd || '22:00');
    };

    const discardRecurringApproval = () => {
        const applianceId = recurringApproval?.appliance?.id;
        const source = recurringApproval?.source || 'create';
        const appliance = recurringApproval?.appliance;
        const pendingConfig = recurringApproval?.pendingConfig;
        setRecurringApproval(null);
        if (!applianceId) return;

        if (source === 'create') {
            // Brand-new draft — remove appliance entirely
            setModeSwitchDraft(null);
            fetch(`/users/${userId}/appliances/${applianceId}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            })
                .then(() => fetchAppliances())
                .catch(() => fetchAppliances());
            return;
        }

        // Mode-switch cancel: nothing was persisted as automatic yet — re-open editor
        restoreModeSwitchEditor(appliance, pendingConfig);
    };

    const activateAutomaticFromDraft = (app) => {
        const draft = modeSwitchDraft;
        if (!draft || draft.applianceId !== app.id) return;

        setModeSwitchBusyId(app.id);
        setError('');

        // Preview first — do NOT persist isRecurring until Approve & Activate.
        openRecurringPreview(app, {
            recurringDays: draft.recurringDays,
            preferredDuration: draft.preferredDuration,
            windowStart: draft.windowStart,
            windowEnd: draft.windowEnd,
            name: app.name,
            powerConsumptionKw: app.powerConsumptionKw
        }, 'mode-switch')
            .finally(() => setModeSwitchBusyId(null));
    };

    const disableAutomaticMode = (app) => {
        setModeSwitchBusyId(app.id);
        setError('');
        setModeSwitchDraft(null);

        updateApplianceMode(app.id, {
            name: app.name,
            powerConsumptionKw: app.powerConsumptionKw,
            isRecurring: false,
            recurringDays: null,
            preferredDuration: null,
            timeWindowStart: null,
            timeWindowEnd: null
        })
            .then(() => Promise.all([fetchAppliances(), fetchScheduledTasks()]))
            .catch(err => setError(err.message))
            .finally(() => setModeSwitchBusyId(null));
    };

    const handleCardModeToggle = (app, enableAutomatic) => {
        if (enableAutomatic) {
            setEditingId(null);
            setModeSwitchDraft({
                applianceId: app.id,
                recurringDays: app.recurringDays || 'DAILY',
                preferredDuration: String(app.preferredDuration || 2),
                windowStart: app.timeWindowStart || '08:00',
                windowEnd: app.timeWindowEnd || '22:00',
                busy: false
            });
            return;
        }
        // Draft-only toggle off (never persisted) — just collapse the expander
        if (modeSwitchDraft?.applianceId === app.id && !isSmartRecurring(app)) {
            setModeSwitchDraft(null);
            return;
        }
        disableAutomaticMode(app);
    };

    const approveRecurringRule = async () => {
        const appliance = recurringApproval?.appliance;
        const rec = recurringApproval?.recommendation;
        const source = recurringApproval?.source || 'create';
        const pendingConfig = recurringApproval?.pendingConfig;
        const startTime = rec?.best_start_time;
        if (!appliance?.id || !startTime) {
            setError('No preview window available. Cancel and try again.');
            return;
        }

        setApprovingRecurring(true);
        setError('');

        try {
            // Mode-switch: persist Manual → Automatic entity update on approve
            if (source === 'mode-switch') {
                await updateApplianceMode(appliance.id, {
                    name: pendingConfig?.name ?? appliance.name,
                    powerConsumptionKw: Number(
                        pendingConfig?.powerConsumptionKw ?? appliance.powerConsumptionKw
                    ),
                    isRecurring: true,
                    recurringDays: pendingConfig?.recurringDays || 'DAILY',
                    preferredDuration: String(pendingConfig?.preferredDuration || 2),
                    timeWindowStart: pendingConfig?.windowStart || '08:00',
                    timeWindowEnd: pendingConfig?.windowEnd || '22:00'
                });
            }

            const schedulePayload = {
                id: appliance.id,
                startTime: String(startTime).replace(' ', 'T'),
                durationMinutes: rec.durationMinutes || 120,
                recommendedCarbonIntensity: rec.recommended_carbon_intensity,
                baselineCarbonIntensity: rec.baseline_carbon_intensity,
                recommendedEnergyPrice: rec.recommended_energy_price,
                baselineEnergyPrice: rec.baseline_energy_price,
                savedMoneyRon: rec.single_run_savings_ron ?? undefined,
                savedCo2Kg: rec.co2_avoided_kg ?? undefined
            };

            const res = await fetch(`/users/${userId}/appliances/schedule`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(schedulePayload)
            });
            if (!res.ok) {
                const detail = await res.text();
                throw new Error(detail || `Failed to activate schedule (${res.status})`);
            }

            setRecurringApproval(null);
            setModeSwitchDraft(null);
            setEditingId(null);
            setScheduledStatus(prev => ({...prev, [appliance.id]: true}));
            await Promise.all([fetchAppliances(), fetchScheduledTasks()]);
        } catch (err) {
            setError(err.message || 'Failed to activate automatic rule');
        } finally {
            setApprovingRecurring(false);
        }
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
        const previous = userAppliances.find(a => a.id === applianceId);
        const wasRecurring = isSmartRecurring(previous);

        // Manual → Automatic: intercept Save and open approval preview immediately
        if (editIsRecurring && !wasRecurring) {
            const draftAppliance = {
                ...(previous || {}),
                id: applianceId,
                name: editName,
                powerConsumptionKw: parseFloat(editPower)
            };
            openRecurringPreview(draftAppliance, {
                recurringDays: editRecurringDays,
                preferredDuration: editPreferredDuration,
                windowStart: editWindowStart,
                windowEnd: editWindowEnd,
                name: editName,
                powerConsumptionKw: parseFloat(editPower)
            }, 'mode-switch');
            return;
        }

        const payload = {
            name: editName,
            powerConsumptionKw: parseFloat(editPower),
            isRecurring: editIsRecurring,
            recurringDays: editIsRecurring ? editRecurringDays : null,
            preferredDuration: editIsRecurring ? editPreferredDuration : null,
            timeWindowStart: editIsRecurring ? editWindowStart : null,
            timeWindowEnd: editIsRecurring ? editWindowEnd : null
        };

        updateApplianceMode(applianceId, payload)
            .then(() => {
                setEditingId(null);
                setModeSwitchDraft(null);
                return Promise.all([fetchAppliances(), fetchScheduledTasks()]);
            })
            .catch(err => setError(err.message));
    };

    const startEditing = (app) => {
        setModeSwitchDraft(null);
        setEditingId(app.id);
        setEditName(app.name);
        setEditPower(app.powerConsumptionKw);
        setEditIsRecurring(isSmartRecurring(app));
        setEditRecurringDays(app.recurringDays || "DAILY");
        setEditPreferredDuration(String(app.preferredDuration || "2"));
        setEditWindowStart(app.timeWindowStart || "22:00");
        setEditWindowEnd(app.timeWindowEnd || "07:00");
    };

    const openScheduler = (app) => {
        setError('');
        setSchedulingAppliance(app);
        setSchedulerStep('config');
        // Fresh default: earliest = next 15-min slot, latest = +2 days midnight
        const start = new Date();
        start.setSeconds(0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 2);
        end.setHours(0, 0, 0, 0);
        setDispatchWindow(prev => ({
            ...prev,
            [app.id]: clampDispatchWindow(
                snapToNext15Min(start),
                formatLocalDatetimeInput(end)
            )
        }));
        if (!applianceDuration[app.id]) {
            setApplianceDuration(prev => ({...prev, [app.id]: 2}));
        }
    };

    const closeScheduler = () => {
        setSchedulerStep(null);
        setSchedulingAppliance(null);
        setConfirmingSchedule(false);
    };

    const handleGetRecommendation = (applianceId) => {
        const selectedDuration = applianceDuration[applianceId] || 2;
        const window = clampDispatchWindow(
            getDispatchWindow(applianceId).earliestStart,
            getDispatchWindow(applianceId).latestEnd
        );
        setDispatchWindow(prev => ({ ...prev, [applianceId]: window }));

        // Strict client check: (T_start + D) must fit before mustFinishBy
        const earliestMs = new Date(String(window.earliestStart).replace(' ', 'T')).getTime();
        const latestMs = new Date(String(window.latestEnd).replace(' ', 'T')).getTime();
        const availableHours = Number.isFinite(earliestMs) && Number.isFinite(latestMs)
            ? Math.max(0, (latestMs - earliestMs) / 3_600_000)
            : 0;
        if (!window.latestEnd || latestMs <= earliestMs || availableHours + 1e-9 < selectedDuration) {
            const availLabel = Number.isInteger(availableHours)
                ? `${availableHours}h`
                : `${availableHours.toFixed(1)}h`;
            setError(
                `Requested runtime (${selectedDuration}h) exceeds the available time window (${availLabel}). Please expand 'Must finish by' deadline.`
            );
            setSchedulerStep('config');
            return;
        }

        setLoadingApplianceId(applianceId);
        setScheduledStatus(prev => ({...prev, [applianceId]: false}));
        setSchedulerStep(null); // close Step 1 while scanning

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
                    [applianceId]: normalizeRecommendation(data, selectedDuration)
                }));
                setSchedulerStep('result');
            })
            .catch(err => {
                setError(err.message || 'Could not get recommendation');
                setSchedulerStep('config'); // restore Step 1 on failure
            })
            .finally(() => setLoadingApplianceId(null));
    };

    const handleConfirmSchedule = (applianceId) => {
        const rec = recommendations[applianceId];
        if (!rec?.best_start_time) {
            setError('No recommendation available to schedule. Find a clean window first.');
            return;
        }

        setConfirmingSchedule(true);
        const payload = {
            id: applianceId,
            startTime: String(rec.best_start_time).replace(" ", "T"),
            durationMinutes: rec.durationMinutes || 120,
            recommendedCarbonIntensity: rec.recommended_carbon_intensity,
            baselineCarbonIntensity: rec.baseline_carbon_intensity,
            recommendedEnergyPrice: rec.recommended_energy_price,
            baselineEnergyPrice: rec.baseline_energy_price,
            savedMoneyRon: rec.single_run_savings_ron ?? undefined,
            savedCo2Kg: rec.co2_avoided_kg ?? undefined
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
                closeScheduler();
            })
            .catch(err => setError(err.message))
            .finally(() => setConfirmingSchedule(false));
    };

    const openCancelDialog = ({ logId = null, applianceId, applianceName, date = selectedDate }) => {
        setCancelTarget({
            logId,
            applianceId,
            applianceName,
            date: date || selectedDate
        });
    };

    const handleCancelTask = (logId, applianceId, isRecurringTask = false, applianceName = '') => {
        if (isRecurringTask) {
            openCancelDialog({
                logId,
                applianceId,
                applianceName,
                date: selectedDate
            });
            return;
        }

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

    const submitRecurringCancel = (scope) => {
        if (!cancelTarget) return;
        setCancelBusy(true);
        setError('');

        fetch(`/users/${userId}/appliances/scheduled/cancel`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                scope,
                logId: cancelTarget.logId || undefined,
                applianceId: cancelTarget.applianceId,
                date: cancelTarget.date
            })
        })
            .then(async res => {
                if (!res.ok) {
                    const detail = await res.text();
                    throw new Error(detail || `Cancel failed (${res.status})`);
                }
                if (cancelTarget.applianceId) {
                    setScheduledStatus(prev => ({ ...prev, [cancelTarget.applianceId]: false }));
                }
                setCancelTarget(null);
                return Promise.all([fetchAppliances(), fetchScheduledTasks()]);
            })
            .catch(err => setError(err.message))
            .finally(() => setCancelBusy(false));
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
        const recurringTask = isSmartTask(task);
        return (
            <div key={task.id} className={`${glass} p-4`}>
                <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusTone(taskStatus.color)}`}>
                    {taskStatus.label}
                </span>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{taskStatus.desc}</p>
                <h3 className="mt-3 text-base font-semibold text-slate-900 dark:text-slate-100">{task.applianceName}</h3>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    <span className="text-slate-500 dark:text-slate-500">Start:</span>{' '}
                    {(() => {
                        const start = new Date(task.startTime);
                        if (Number.isNaN(start.getTime())) return '—';
                        const snapped = new Date(start.getTime());
                        snapped.setSeconds(0, 0);
                        const rem = snapped.getMinutes() % 15;
                        if (rem !== 0) snapped.setMinutes(snapped.getMinutes() + (15 - rem));
                        const end = new Date(snapped.getTime() + (Number(task.durationMinutes) || 0) * 60_000);
                        const today = new Date();
                        const isToday =
                            snapped.getFullYear() === today.getFullYear() &&
                            snapped.getMonth() === today.getMonth() &&
                            snapped.getDate() === today.getDate();
                        const day = isToday
                            ? 'Today'
                            : snapped.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
                        return `${day}, ${pad2(snapped.getHours())}:${pad2(snapped.getMinutes())} - ${pad2(end.getHours())}:${pad2(end.getMinutes())}`;
                    })()}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    <span className="text-slate-500">Duration:</span> {task.durationMinutes} mins
                </p>
                {task.savedCo2Grams > 0 && (
                    <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                        Eco-Impact: avoided {(task.savedCo2Grams >= 1000 ? (task.savedCo2Grams / 1000).toFixed(2) + ' kg' : task.savedCo2Grams.toFixed(0) + ' g')} CO₂
                    </div>
                )}
                {task.savedMoneyRon > 0 && (
                    <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
                        Saved {task.savedMoneyRon.toFixed(2)} RON
                    </div>
                )}
                {taskStatus.label !== 'COMPLETED' && (
                    <button
                        type="button"
                        className={`${ghostBtn} mt-3 w-full`}
                        onClick={() => handleCancelTask(task.id, task.applianceId, recurringTask, task.applianceName)}
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

    const isProsumer = isProsumerUser(userType, energyProfile);
    const solarKw = Number(liveEnergy?.pvPowerKw);
    const loadKw = Number(liveEnergy?.homeLoadKw);
    const importKw = Number(liveEnergy?.gridImportKw);
    const hasSolar = isProsumer && Number.isFinite(solarKw);
    const hasLoad = Number.isFinite(loadKw);
    const hasImport = Number.isFinite(importKw);
    const gridConsumptionKw = hasImport && importKw > 0
        ? importKw
        : (hasLoad ? loadKw : null);
    const netKw = isProsumer && hasSolar && hasLoad ? solarKw - loadKw : null;
    const carbonIntensity = estimateGridCarbonIntensity(gridSnapshot);
    const liveSources = [
        isProsumer && liveEnergy?.solarLive ? 'Open-Meteo' : null,
        liveEnergy?.shellyLive ? 'Shelly' : null,
        !isProsumer ? 'SEN Grid' : null
    ].filter(Boolean);
    const liveLabel = liveSources.length
        ? `LIVE DATA: ${liveSources.join(' & ')}`
        : (isProsumer ? 'LIVE DATA: Open-Meteo & Shelly' : 'LIVE DATA: SEN Grid & Shelly');

    const metricTile = (label, icon, valueNode, accentBorder = '') => (
        <div className={`${surface} ${accentBorder} p-6`}>
            <div className="mb-4 flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{label}</p>
                <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 p-2.5 text-emerald-700 dark:border-white/10 dark:bg-white/5 dark:text-emerald-300">
                    {icon}
                </span>
            </div>
            {valueNode}
        </div>
    );

    const scrollToDispatch = () => {
        document.getElementById('wattwise-dispatch')?.scrollIntoView({behavior: 'smooth', block: 'start'});
    };

    const heroNavBtn =
        'rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/90 backdrop-blur-md transition hover:bg-white/20';

    return (
        <div className="relative min-h-screen overflow-x-hidden text-slate-900 transition-colors dark:text-slate-100">
            {/* Atmospheric eco glow continues past the hero */}
            <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
                <div className="absolute -left-24 top-[40%] h-[28rem] w-[28rem] rounded-full bg-emerald-400/20 blur-3xl dark:bg-emerald-500/15" />
                <div className="absolute -right-16 top-[55%] h-[24rem] w-[24rem] rounded-full bg-amber-300/15 blur-3xl dark:bg-amber-400/10" />
                <div className="absolute bottom-0 left-1/3 h-[20rem] w-[36rem] rounded-full bg-teal-400/10 blur-3xl dark:bg-teal-500/10" />
            </div>

            <SolarPulseHero
                isProsumer={isProsumer}
                solarKw={hasSolar ? solarKw : null}
                liveLabel={liveLabel}
                userName={userName || 'User'}
                welcomeMessage={ecoMessage?.welcomeMessage || 'Welcome'}
                tipText={ecoMessage?.content || null}
                briefing={aiBriefing || null}
                savingsCo2={ecoAnalytics.totalSavedCo2Kg}
                savingsRon={ecoAnalytics.totalSavedMoneyRon}
                onPrimaryAction={scrollToDispatch}
                primaryLabel="Live Solar Pulse"
                actions={(
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <button
                            type="button"
                            className={heroNavBtn}
                            onClick={toggleTheme}
                            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                        >
                            {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                        </button>
                        <button type="button" className={heroNavBtn} onClick={() => setShowIntegrations(true)}>
                            <span className="inline-flex items-center gap-1.5">
                                <Cable className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Integrations</span>
                            </span>
                        </button>
                        <button type="button" className={heroNavBtn} onClick={() => setShowProfile(true)}>
                            <span className="inline-flex items-center gap-1.5">
                                <UserRound className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Profile</span>
                            </span>
                        </button>
                        <button type="button" onClick={onLogout} className={heroNavBtn}>
                            <span className="inline-flex items-center gap-1.5">
                                <LogOut className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Logout</span>
                            </span>
                        </button>
                    </div>
                )}
            />

            <div className="relative mx-auto max-w-7xl space-y-8 px-4 py-10 pb-28 sm:px-6 lg:px-8">
                {error && (
                    <div className="rounded-3xl border border-rose-200/80 bg-rose-50/80 px-5 py-3.5 text-sm text-rose-700 backdrop-blur-xl dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                        {error}
                    </div>
                )}

                <RevealStagger as="section" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-12">
                    {isProsumer ? (
                        <RevealItem className="xl:col-span-4">
                            {metricTile(
                                'Live Solar Production',
                                <Sun className="h-4 w-4" />,
                                <p className="font-display text-3xl font-semibold tracking-tight text-emerald-600 dark:text-emerald-400">
                                    {hasSolar ? solarKw.toFixed(2) : '—'}
                                    <span className="ml-1 text-base font-medium text-slate-500 dark:text-slate-400">kW</span>
                                </p>,
                                'border-emerald-400/25 shadow-emerald-500/10'
                            )}
                        </RevealItem>
                    ) : (
                        <RevealItem className="xl:col-span-4">
                            {metricTile(
                                'Grid Consumption',
                                <Plug className="h-4 w-4" />,
                                <p className="font-display text-3xl font-semibold tracking-tight text-cyan-600 dark:text-cyan-400">
                                    {gridConsumptionKw != null ? gridConsumptionKw.toFixed(2) : '—'}
                                    <span className="ml-1 text-base font-medium text-slate-500 dark:text-slate-400">kW</span>
                                </p>
                            )}
                        </RevealItem>
                    )}

                    <RevealItem className="xl:col-span-3">
                        {metricTile(
                            isProsumer ? 'Home Load' : 'Home Load',
                            <Plug className="h-4 w-4" />,
                            <p className="font-display text-3xl font-semibold tracking-tight text-slate-800 dark:text-slate-100">
                                {hasLoad ? loadKw.toFixed(2) : '—'}
                                <span className="ml-1 text-base font-medium text-slate-500 dark:text-slate-400">kW</span>
                            </p>
                        )}
                    </RevealItem>

                    <RevealItem className="xl:col-span-2">
                        {isProsumer ? metricTile(
                            'Grid Balance',
                            <Zap className="h-4 w-4" />,
                            <>
                                <p className={`font-display text-3xl font-semibold tracking-tight ${netKw == null ? 'text-slate-500' : netKw >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                    {netKw == null ? '—' : `${netKw >= 0 ? '+' : ''}${netKw.toFixed(2)}`}
                                    <span className="ml-1 text-base font-medium text-slate-500 dark:text-slate-400">kW</span>
                                </p>
                                {netKw != null && (
                                    <span className={`mt-2 inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                                        netKw >= 0
                                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                                            : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300'
                                    }`}>
                                        {netKw >= 0 ? 'EXPORTING' : 'IMPORTING'}
                                    </span>
                                )}
                            </>
                        ) : metricTile(
                            'Grid Carbon',
                            <Activity className="h-4 w-4" />,
                            <p className={`font-display text-3xl font-semibold tracking-tight ${
                                carbonIntensity == null
                                    ? 'text-slate-500'
                                    : carbonIntensity < 200
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : carbonIntensity < 350
                                            ? 'text-amber-600 dark:text-amber-400'
                                            : 'text-rose-600 dark:text-rose-400'
                            }`}>
                                {carbonIntensity != null ? carbonIntensity : '—'}
                                <span className="ml-1 text-sm font-medium text-slate-500 dark:text-slate-400">gCO₂</span>
                            </p>
                        )}
                    </RevealItem>

                    <RevealItem className="xl:col-span-3">
                        {metricTile(
                            'Eco Savings',
                            <Leaf className="h-4 w-4" />,
                            <>
                                <p className="font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                                    {Number(ecoAnalytics.totalSavedCo2Kg || 0).toFixed(1)}
                                    <span className="ml-1 text-sm font-medium text-slate-500 dark:text-slate-400">kg CO₂</span>
                                </p>
                                <p className="mt-1 text-lg font-semibold text-cyan-700 dark:text-cyan-400">
                                    {Number(ecoAnalytics.totalSavedMoneyRon || 0).toFixed(2)}
                                    <span className="ml-1 text-sm font-medium text-slate-500 dark:text-slate-400">RON</span>
                                </p>
                            </>
                        )}
                    </RevealItem>
                </RevealStagger>

                {/* TOP: Weather + National Grid — asymmetric two-column row */}
                <RevealStagger as="section" className="grid grid-cols-1 gap-5 lg:grid-cols-5">
                    <RevealItem className={`${glass} p-6 sm:p-8 lg:col-span-3`}>
                        <WeatherSolarWidget
                            userId={userId}
                            energyProfile={energyProfile}
                            latitude={energyProfile?.latitude}
                            longitude={energyProfile?.longitude}
                            pvSystemKw={isProsumer ? energyProfile?.pvSystemKw : 0}
                            isProsumer={isProsumer}
                            carbonIntensity={carbonIntensity}
                            greenSharePercent={
                                gridSnapshot?.Green_Share_Percent
                                ?? gridSnapshot?.greenSharePercent
                                ?? null
                            }
                        />
                    </RevealItem>
                    <RevealItem className={`${glass} p-6 sm:p-8 lg:col-span-2`}>
                        <NationalGridWidget userId={userId}/>
                    </RevealItem>
                </RevealStagger>

                {/* BOTTOM: Autonomous Dispatch — full-width, natural page scroll */}
                <Reveal as="section" id="wattwise-dispatch" className={`${glass} mt-1 w-full scroll-mt-8 p-6 sm:p-8`}>
                    <div className="mb-6">
                        <h2 className={sectionTitle}>Autonomous Dispatch</h2>
                        <p className={sectionSub}>Define the rules. We find the greenest run.</p>
                    </div>

                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                        {/* Left 1/3 — add form */}
                        <div className="lg:col-span-1">
                            <form onSubmit={handleAddAppliance} className={`${inset} space-y-3.5`}>
                                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                                    Add Appliance
                                </p>
                                <input type="text" placeholder="Appliance name (e.g. EV Charger)" value={newName} onChange={e => setNewName(e.target.value)} required className={inputCls} />
                                <input type="number" step="0.1" min="0" placeholder="kW rating" value={newPower} onChange={e => setNewPower(e.target.value)} required className={inputCls} />
                                <button type="submit" className={`${primaryBtn} inline-flex w-full items-center justify-center gap-1.5`}>
                                    <Plus className="h-4 w-4" />
                                    Add Appliance
                                </button>

                                <RecurringModeSwitch
                                    checked={newIsRecurring}
                                    onChange={setNewIsRecurring}
                                />

                                {newIsRecurring && (
                                    <div className="grid gap-2">
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
                        </div>

                        {/* Right 2/3 — appliance cards grid */}
                        <div className="lg:col-span-2">
                            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                    Manual &amp; Automatic Appliances ({userAppliances.length})
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {smartRecurringAppliances.length} recurring · {manualAppliances.length} flexible
                                </p>
                            </div>

                            {userAppliances.length === 0 ? (
                                <p className="rounded-3xl border border-dashed border-emerald-300/40 bg-white/30 px-4 py-10 text-center text-sm text-slate-500 backdrop-blur-sm dark:border-white/15 dark:bg-white/[0.03] dark:text-slate-400">
                                    You don&apos;t have any appliance added yet
                                </p>
                            ) : (
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    {userAppliances.map(app => {
                                        const smartRecurringActive = editingId === app.id
                                            ? editIsRecurring
                                            : isSmartRecurring(app);
                                        const isScheduled = Boolean(scheduledStatus[app.id]);
                                        const draftOpen = modeSwitchDraft?.applianceId === app.id;

                                        return (
                                            <div
                                                key={app.id}
                                                className="rounded-3xl border border-white/25 bg-white/40 p-4 shadow-lg shadow-emerald-950/5 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04] dark:shadow-black/20"
                                            >
                                                {editingId === app.id ? (
                                                    <form onSubmit={e => handleSaveEdit(e, app.id)} className="space-y-2">
                                                        <input type="text" value={editName} onChange={e => setEditName(e.target.value)} required className={inputCls} />
                                                        <input type="number" step="0.1" min="0" value={editPower} onChange={e => setEditPower(e.target.value)} required className={inputCls} />
                                                        <RecurringModeSwitch
                                                            checked={editIsRecurring}
                                                            onChange={setEditIsRecurring}
                                                        />
                                                        {editIsRecurring && (
                                                            <div className="grid gap-2 sm:grid-cols-2">
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
                                                                <input type="time" step={900} value={editWindowStart} onChange={e => setEditWindowStart(e.target.value)} className={inputCls} />
                                                                <input type="time" step={900} value={editWindowEnd} onChange={e => setEditWindowEnd(e.target.value)} className={inputCls} />
                                                            </div>
                                                        )}
                                                        <div className="flex gap-2">
                                                            <button type="submit" className={primaryBtn}>
                                                                {editIsRecurring && !isSmartRecurring(app) ? 'Save & Preview' : 'Save'}
                                                            </button>
                                                            <button type="button" className={ghostBtn} onClick={() => setEditingId(null)}>Cancel</button>
                                                        </div>
                                                    </form>
                                                ) : (
                                                    <div className="space-y-2.5">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <h3 className="truncate font-semibold text-emerald-950 dark:text-slate-100">{app.name}</h3>
                                                            <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                                                                {app.powerConsumptionKw} kW
                                                            </span>
                                                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide ${
                                                                smartRecurringActive
                                                                    ? 'border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                                                                    : 'border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300'
                                                            }`}>
                                                                {smartRecurringActive ? 'RECURRING' : 'FLEXIBLE'}
                                                            </span>
                                                            {isScheduled && !smartRecurringActive && (
                                                                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                                                                    SCHEDULED
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <button className={softText} type="button" onClick={() => startEditing(app)}>Edit</button>
                                                            <button className={dangerText} type="button" onClick={() => handleDeleteAppliance(app.id)}>Delete</button>
                                                            {smartRecurringActive ? (
                                                                <button
                                                                    type="button"
                                                                    className={`${ghostBtn} inline-flex items-center gap-1.5`}
                                                                    onClick={() => {
                                                                        const todaysTask = scheduledTasks.find(
                                                                            t => t.applianceId === app.id && isSmartTask(t)
                                                                        );
                                                                        openCancelDialog({
                                                                            logId: todaysTask?.id || null,
                                                                            applianceId: app.id,
                                                                            applianceName: app.name,
                                                                            date: selectedDate
                                                                        });
                                                                    }}
                                                                >
                                                                    <Zap className="h-3.5 w-3.5" />
                                                                    Auto Active
                                                                </button>
                                                            ) : !draftOpen && (
                                                                <button
                                                                    type="button"
                                                                    className={`${primaryBtn} inline-flex items-center gap-1.5`}
                                                                    onClick={() => openScheduler(app)}
                                                                    disabled={loadingApplianceId === app.id}
                                                                >
                                                                    <CalendarClock className="h-3.5 w-3.5" />
                                                                    Schedule
                                                                </button>
                                                            )}
                                                        </div>

                                                        <RecurringModeSwitch
                                                            checked={smartRecurringActive || draftOpen}
                                                            disabled={modeSwitchBusyId === app.id}
                                                            onChange={(enable) => handleCardModeToggle(app, enable)}
                                                        />

                                                        {draftOpen && (
                                                            <div className="space-y-2 rounded-2xl border border-white/20 bg-white/30 p-3 backdrop-blur-md dark:border-white/10 dark:bg-white/[0.04]">
                                                                <div className="grid gap-2 sm:grid-cols-2">
                                                                    <select
                                                                        value={modeSwitchDraft.recurringDays}
                                                                        onChange={e => setModeSwitchDraft(d => ({...d, recurringDays: e.target.value}))}
                                                                        className={selectCls}
                                                                    >
                                                                        <option value="DAILY">Every Day</option>
                                                                        <option value="WEEKDAYS">Weekdays</option>
                                                                        <option value="WEEKENDS">Weekends</option>
                                                                    </select>
                                                                    <select
                                                                        value={modeSwitchDraft.preferredDuration}
                                                                        onChange={e => setModeSwitchDraft(d => ({...d, preferredDuration: e.target.value}))}
                                                                        className={selectCls}
                                                                    >
                                                                        <option value="1">1 hour</option>
                                                                        <option value="2">2 hours</option>
                                                                        <option value="3">3 hours</option>
                                                                        <option value="4">4 hours</option>
                                                                    </select>
                                                                    <input
                                                                        type="time"
                                                                        step={900}
                                                                        value={modeSwitchDraft.windowStart}
                                                                        onChange={e => setModeSwitchDraft(d => ({...d, windowStart: e.target.value}))}
                                                                        className={inputCls}
                                                                    />
                                                                    <input
                                                                        type="time"
                                                                        step={900}
                                                                        value={modeSwitchDraft.windowEnd}
                                                                        onChange={e => setModeSwitchDraft(d => ({...d, windowEnd: e.target.value}))}
                                                                        className={inputCls}
                                                                    />
                                                                </div>
                                                                <div className="flex flex-wrap gap-2">
                                                                    <button
                                                                        type="button"
                                                                        className={primaryBtn}
                                                                        disabled={modeSwitchBusyId === app.id}
                                                                        onClick={() => activateAutomaticFromDraft(app)}
                                                                    >
                                                                        {modeSwitchBusyId === app.id ? 'Preparing…' : 'Preview & Activate'}
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className={ghostBtn}
                                                                        onClick={() => setModeSwitchDraft(null)}
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </Reveal>

                <Reveal as="section" className={`${glass} p-6 sm:p-8`} delay={0.05}>
                    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                        <div>
                            <h2 className={sectionTitle}>My Active Eco-Schedules</h2>
                            <p className={sectionSub}>Live and upcoming optimized runs for the day you pick.</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">{scheduledStats.PENDING} Pending</span>
                                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">{scheduledStats.RUNNING} Running</span>
                                <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">{scheduledStats.COMPLETED} Completed</span>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                className={`${ghostBtn} ${selectedDate === getTodayString() ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300' : ''}`}
                                onClick={() => selectScheduleDate(getTodayString())}
                                disabled={isLoadingSchedule}
                            >
                                Today
                            </button>
                            <button
                                type="button"
                                className={`${ghostBtn} ${selectedDate === getTomorrowString() ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300' : ''}`}
                                onClick={() => selectScheduleDate(getTomorrowString())}
                                disabled={isLoadingSchedule}
                            >
                                Tomorrow
                            </button>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => selectScheduleDate(e.target.value)}
                                className={inputCls}
                                disabled={isLoadingSchedule}
                            />
                        </div>
                    </div>

                    <div className="min-h-[160px]">
                        {isLoadingSchedule ? (
                            <div className="space-y-4" aria-busy="true" aria-live="polite">
                                <p className="text-sm text-emerald-700 dark:text-emerald-300">
                                    Loading dispatches for{' '}
                                    {selectedDate === getTodayString()
                                        ? 'Today'
                                        : selectedDate === getTomorrowString()
                                            ? 'Tomorrow'
                                            : selectedDate}
                                    …
                                </p>
                                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                    {[0, 1, 2].map((slot) => (
                                        <div
                                            key={slot}
                                            className="animate-pulse rounded-3xl border border-white/20 bg-white/30 p-4 backdrop-blur-md dark:border-white/10 dark:bg-white/[0.04]"
                                        >
                                            <div className="mb-3 h-5 w-24 rounded-full bg-emerald-200/70 dark:bg-slate-700" />
                                            <div className="mb-2 h-4 w-3/4 rounded bg-emerald-100 dark:bg-slate-800" />
                                            <div className="h-3 w-1/2 rounded bg-emerald-100/80 dark:bg-slate-800/80" />
                                            <div className="mt-4 h-8 w-full rounded-xl bg-emerald-100/60 dark:bg-slate-800/60" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : scheduledTasks.length === 0 ? (
                            <p className="text-sm text-slate-500 dark:text-slate-400">No active eco-schedules for {selectedDate}.</p>
                        ) : (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Smart Recurring Rules (automatic)</h3>
                                    {smartTasks.length === 0 ? (
                                        <p className="text-sm text-slate-500 dark:text-slate-400">No automatic dispatches for {selectedDate}.</p>
                                    ) : (
                                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                            {smartTasks.map(renderTaskCard)}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Manual schedules</h3>
                                    {manualTasks.length === 0 ? (
                                        <p className="text-sm text-slate-500 dark:text-slate-400">No manual schedules for {selectedDate}.</p>
                                    ) : (
                                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                            {manualTasks.map(renderTaskCard)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </Reveal>

                <Reveal as="section" className={`${glass} p-6 sm:p-8`} delay={0.08}>
                    <EcoAnalyticsWidget
                        userId={userId}
                        onAnalyticsLoaded={(data) => {
                            setEcoAnalytics({
                                totalSavedCo2Kg: data?.totalSavedCo2Kg ?? 0,
                                totalSavedMoneyRon: data?.totalSavedMoneyRon ?? 0,
                                totalCompletedTasks: data?.totalCompletedTasks ?? 0
                            });
                            setAnalyticsReady(true);
                        }}
                    />
                </Reveal>

                <EcoChatWidget
                    userId={userId}
                    userName={userName}
                    userType={userType}
                    ecoAnalytics={ecoAnalytics}
                    userAppliances={userAppliances}
                    scheduledTasks={scheduledTasks}
                    locationName={energyProfile?.locationName || energyProfile?.location_name}
                    solarKw={isProsumer ? liveEnergy?.pvPowerKw : null}
                    solarPeakWindow="13:00-15:00"
                    onScheduleAction={async (action) => {
                        const durationHours = Number(action?.durationHours) || 2;
                        const payload = {
                            id: action.applianceId,
                            startTime: String(action.startTime).replace(' ', 'T'),
                            durationMinutes: Math.max(15, Math.round(durationHours * 60)),
                            decisionReason: action.reason || 'Scheduled via WattAssistant'
                        };
                        const res = await fetch(`/users/${userId}/appliances/schedule`, {
                            method: 'POST',
                            headers: getAuthHeaders(),
                            body: JSON.stringify(payload)
                        });
                        if (!res.ok) {
                            const detail = await res.text();
                            throw new Error(detail || `Failed to schedule (${res.status})`);
                        }
                        setScheduledStatus(prev => ({...prev, [action.applianceId]: true}));
                        await fetchScheduledTasks();
                    }}
                />
                <ConnectProviderModal
                    userId={userId}
                    open={showIntegrations}
                    onClose={() => setShowIntegrations(false)}
                />
                <UserProfileModal
                    open={showProfile}
                    onClose={() => setShowProfile(false)}
                    userId={userId}
                    userName={userName}
                    userEmail={userEmail}
                    userType={userType}
                    energyProfile={energyProfile}
                    onEnergyProfileUpdated={(updated) => {
                        setEnergyProfile(updated);
                    }}
                />

                <ApplianceScheduler
                    appliance={schedulingAppliance}
                    step={schedulerStep}
                    durationHours={schedulingAppliance ? (applianceDuration[schedulingAppliance.id] || 2) : 2}
                    earliestStart={schedulingAppliance ? getDispatchWindow(schedulingAppliance.id).earliestStart : ''}
                    latestEnd={schedulingAppliance ? getDispatchWindow(schedulingAppliance.id).latestEnd : ''}
                    loading={Boolean(schedulingAppliance && loadingApplianceId === schedulingAppliance.id)}
                    confirming={confirmingSchedule}
                    recommendation={schedulingAppliance ? recommendations[schedulingAppliance.id] : null}
                    onDurationChange={(hours) => {
                        if (!schedulingAppliance) return;
                        handleDurationChange(schedulingAppliance.id, hours);
                    }}
                    onEarliestChange={(value) => {
                        if (!schedulingAppliance) return;
                        updateDispatchWindow(schedulingAppliance.id, 'earliestStart', value);
                    }}
                    onLatestChange={(value) => {
                        if (!schedulingAppliance) return;
                        updateDispatchWindow(schedulingAppliance.id, 'latestEnd', value);
                    }}
                    onFindCleanestWindow={() => {
                        if (!schedulingAppliance) return;
                        handleGetRecommendation(schedulingAppliance.id);
                    }}
                    onConfirm={() => {
                        if (!schedulingAppliance) return;
                        handleConfirmSchedule(schedulingAppliance.id);
                    }}
                    onDecline={() => setSchedulerStep('config')}
                    onClose={closeScheduler}
                />

                <RecurringApprovalModal
                    open={Boolean(recurringApproval)}
                    appliance={recurringApproval?.appliance}
                    recommendation={recurringApproval?.recommendation}
                    loading={Boolean(recurringApproval?.loading)}
                    confirming={approvingRecurring}
                    recurringDays={recurringApproval?.pendingConfig?.recurringDays || 'DAILY'}
                    onApprove={approveRecurringRule}
                    onCancel={discardRecurringApproval}
                />

                <RecurringCancelModal
                    open={Boolean(cancelTarget)}
                    applianceName={cancelTarget?.applianceName}
                    selectedDateLabel={cancelTarget?.date || selectedDate}
                    busy={cancelBusy}
                    onCancelOneDay={() => submitRecurringCancel('ONE_DAY')}
                    onCancelAllFuture={() => submitRecurringCancel('ALL_FUTURE')}
                    onClose={() => setCancelTarget(null)}
                />
            </div>
        </div>
    );
}

export default Dashboard;
