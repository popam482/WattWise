import {useState, useEffect} from 'react';
import {BarChart3, Car, Leaf, Trees} from 'lucide-react';

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
        return (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 text-sm text-slate-400 backdrop-blur-md">
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
            tone: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
        },
        {
            icon: BarChart3,
            label: 'Optimized Runs',
            value: analytics.totalCompletedTasks,
            tone: 'border-blue-500/30 bg-blue-500/10 text-blue-400'
        },
        {
            icon: Car,
            label: 'Car Driving Equivalence',
            value: `${analytics.equivalentCarKm} km`,
            tone: 'border-slate-700 bg-slate-950/50 text-slate-200'
        },
        {
            icon: Trees,
            label: 'Trees Absorbing CO₂ / Month',
            value: analytics.equivalentTreesPlanted,
            tone: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
        }
    ];

    return (
        <div className="space-y-5">
            <div>
                <h2 className="text-lg font-semibold text-slate-100">Historical Eco-Impact & Analytics</h2>
                <p className="mt-1 text-sm text-slate-400">
                    Lifetime impact from optimized appliance schedules.
                </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {cards.map(({icon: Icon, label, value, tone}) => (
                    <div
                        key={label}
                        className={`rounded-2xl border p-4 backdrop-blur-md ${tone}`}
                    >
                        <Icon className="mb-3 h-5 w-5 opacity-80" />
                        <p className="text-2xl font-bold text-slate-100">{value}</p>
                        <p className="mt-1 text-xs text-slate-400">{label}</p>
                    </div>
                ))}
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm leading-relaxed text-slate-400">
                <h3 className="mb-2 text-sm font-medium text-slate-200">How is this calculated?</h3>
                <p>
                    WattWise compares your scheduled run times against a
                    counterfactual baseline (peak-hour grid carbon intensity)
                    using real-time SEN data and IPCC lifecycle emission
                    factors. Monetary savings use ANRE-aligned energy price deltas.
                </p>
            </div>
        </div>
    );
}

export default EcoAnalyticsWidget;
