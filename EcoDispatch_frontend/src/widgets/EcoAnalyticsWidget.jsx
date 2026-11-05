import {useState, useEffect} from 'react';
import {BarChart3, Car, Leaf, Trees} from 'lucide-react';
import {metricChip, sectionSub, sectionTitle} from '../ui/ecoStyles.js';

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
                        totalSavedMoneyRon: data.totalSavedMoneyRon ?? 0,
                        totalCompletedTasks: data.totalCompletedTasks ?? 0
                    });
                }
            })
            .catch((err) => {
                console.error('Error fetching eco-analytics:', err);
                if (typeof onAnalyticsLoaded === 'function') {
                    onAnalyticsLoaded({
                        totalSavedCo2Kg: 0,
                        totalSavedMoneyRon: 0,
                        totalCompletedTasks: 0
                    });
                }
            })
            .finally(() => setLoading(false));
        // Intentionally depend only on userId; parent callback is a stable setState
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    if (loading) {
        return (
            <div className="text-sm text-slate-500 dark:text-slate-400">
                Loading Eco Impact Statistics...
            </div>
        );
    }

    if (!analytics) {
        return null;
    }

    const cards = [
        {
            icon: Leaf,
            label: 'Total CO₂ Avoided',
            value: `${analytics.totalSavedCo2Kg} kg`,
            accent: 'text-emerald-600 dark:text-emerald-300'
        },
        {
            icon: BarChart3,
            label: 'Optimized Runs',
            value: analytics.totalCompletedTasks,
            accent: 'text-sky-600 dark:text-sky-300'
        },
        {
            icon: Car,
            label: 'Car Driving Equivalence',
            value: `${analytics.equivalentCarKm} km`,
            accent: 'text-slate-700 dark:text-slate-200'
        },
        {
            icon: Trees,
            label: 'Trees Absorbing CO₂ / Month',
            value: analytics.equivalentTreesPlanted,
            accent: 'text-lime-700 dark:text-lime-300'
        }
    ];

    return (
        <div className="space-y-6">
            <div>
                <h2 className={sectionTitle}>Historical Eco-Impact & Analytics</h2>
                <p className={sectionSub}>
                    Lifetime impact from optimized appliance schedules.
                </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {cards.map(({icon: Icon, label, value, accent}) => (
                    <div key={label} className={`${metricChip} p-5`}>
                        <Icon className={`mb-3 h-5 w-5 ${accent}`} />
                        <p className={`font-display text-2xl font-semibold tracking-tight ${accent}`}>{value}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{label}</p>
                    </div>
                ))}
            </div>

            <div className="rounded-3xl border border-white/20 bg-white/25 p-5 text-sm leading-relaxed text-slate-600 backdrop-blur-md dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400">
                <h3 className="mb-2 text-sm font-medium text-slate-800 dark:text-slate-200">How is this calculated?</h3>
                <p>
                    WattWise compares each optimized run against an immediate-start
                    baseline using hour-level grid imports, all-in import tariffs,
                    and export opportunity cost for self-consumed PV. CO₂ avoided is
                    the grid-carbon delta only. Tree equivalence uses 1.75&nbsp;kg
                    CO₂ absorbed per tree per month.
                </p>
            </div>
        </div>
    );
}

export default EcoAnalyticsWidget;
