import {useEffect, useState} from 'react';
import {Shield} from 'lucide-react';

const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        ...(token ? {'Authorization': `Bearer ${token}`} : {})
    };
};

const panel =
    'rounded-2xl border border-emerald-100/80 bg-white p-6 shadow-sm shadow-emerald-900/5 dark:border-slate-800 dark:bg-slate-900/80 dark:shadow-none dark:backdrop-blur-md';

function HabitLearningSettings({userId}) {
    const [settings, setSettings] = useState(null);
    const [retentionDays, setRetentionDays] = useState(90);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        fetch(`/users/${userId}/privacy/habit-learning`, {
            headers: getAuthHeaders()
        }).then(async response => {
            if (!response.ok) throw new Error('Could not load privacy settings.');
            return response.json();
        }).then(data => {
            setSettings(data);
            setRetentionDays(data.retentionDays);
        }).catch(err => setError(err.message));
    }, [userId]);

    const updateSettings = (enabled) => {
        setError('');
        setMessage('');
        fetch(`/users/${userId}/privacy/habit-learning`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({enabled, retentionDays: Number(retentionDays)})
        }).then(async response => {
            if (!response.ok) throw new Error('Setting could not be saved.');
            return response.json();
        }).then(data => {
            setSettings(data);
            setMessage(enabled ? 'Learning habit activated.' : 'Learning habit deactivated.');
        }).catch(err => setError(err.message));
    };

    const deleteHistory = () => {
        if (!window.confirm('Are you sure that you want to delete the history used for habit learning?')) return;
        setError('');
        setMessage('');
        fetch(`/users/${userId}/privacy/habit-learning/history`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        }).then(response => {
            if (!response.ok) throw new Error('History could not be deleted.');
            setMessage('History deleted successfully');
        }).catch(err => setError(err.message));
    };

    if (!settings) {
        return (
            <section className={panel}>
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-300">
                        <Shield className="h-5 w-5" />
                    </div>
                    <h2 className="text-lg font-semibold text-emerald-950 dark:text-slate-100">Habit Privacy</h2>
                </div>
                {error
                    ? <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{error}</p>
                    : <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">Loading privacy settings...</p>}
            </section>
        );
    }

    return (
        <section className={panel}>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-300">
                        <Shield className="h-5 w-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-emerald-950 dark:text-slate-100">Habit Privacy Scorecard</h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            Aggregated patterns only — raw history never leaves your account for ML.
                        </p>
                    </div>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    settings.enabled
                        ? 'border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                        : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-400'
                }`}>
                    {settings.enabled ? 'LEARNING ON' : 'LEARNING OFF'}
                </span>
            </div>

            <p className="mb-4 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                We only use the day of the week, time, device type, and duration to create aggregated patterns.
                We do not send raw history to the ML service. By default, data collection is disabled.
            </p>

            <label className="mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                Retain data for a maximum of
                <select
                    value={retentionDays}
                    onChange={event => setRetentionDays(event.target.value)}
                    className="rounded-xl border border-emerald-100 bg-white px-3 py-2 text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100 dark:focus:border-emerald-500/50"
                >
                    <option value="30">30 days</option>
                    <option value="90">90 days</option>
                    <option value="180">180 days</option>
                    <option value="365">365 days</option>
                </select>
            </label>

            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={() => updateSettings(true)}
                    disabled={settings.enabled}
                    className="rounded-xl border border-transparent bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
                >
                    Enable with explicit consent
                </button>
                <button
                    type="button"
                    onClick={() => updateSettings(false)}
                    disabled={!settings.enabled}
                    className="rounded-xl border border-emerald-100 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                    Disable
                </button>
                <button
                    type="button"
                    onClick={deleteHistory}
                    className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20"
                >
                    Delete history
                </button>
            </div>

            {message && <p role="status" className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">{message}</p>}
            {error && <p role="alert" className="mt-3 text-sm text-rose-600 dark:text-rose-400">{error}</p>}
        </section>
    );
}

export default HabitLearningSettings;
