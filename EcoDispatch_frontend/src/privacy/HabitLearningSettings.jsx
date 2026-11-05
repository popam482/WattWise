import {useEffect, useState} from 'react';
import {Shield} from 'lucide-react';
import {glass, ghostBtn, inputCls, primaryBtn} from '../ui/ecoStyles.js';

const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        ...(token ? {'Authorization': `Bearer ${token}`} : {})
    };
};

const panel = `${glass} p-6 sm:p-8`;
const iconBubble =
    'flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-white/40 text-emerald-700 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-white/5 dark:text-emerald-300';

function HabitLearningSettings({userId, embedded = false}) {
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

    const shellClass = embedded ? 'space-y-4' : panel;

    if (!settings) {
        return (
            <section className={shellClass}>
                {!embedded && (
                    <div className="flex items-center gap-3">
                        <div className={iconBubble}>
                            <Shield className="h-5 w-5" />
                        </div>
                        <h2 className="font-display text-xl font-semibold tracking-tight text-slate-900 dark:text-white">Habit Privacy</h2>
                    </div>
                )}
                {error
                    ? <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{error}</p>
                    : <p className={`${embedded ? '' : 'mt-3 '}text-sm text-slate-600 dark:text-slate-400`}>Loading privacy settings...</p>}
            </section>
        );
    }

    return (
        <section className={shellClass}>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    {!embedded && (
                        <div className={iconBubble}>
                            <Shield className="h-5 w-5" />
                        </div>
                    )}
                    <div>
                        <h2 className={`font-display font-semibold tracking-tight text-slate-900 dark:text-white ${embedded ? 'text-lg' : 'text-xl'}`}>
                            Habit Privacy & AI Consent
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Aggregated patterns only — raw history never leaves your account for ML.
                        </p>
                    </div>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold backdrop-blur-md ${
                    settings.enabled
                        ? 'border-lime-300/40 bg-lime-300/20 text-emerald-900 dark:border-lime-300/30 dark:bg-lime-300/15 dark:text-lime-200'
                        : 'border-white/25 bg-white/30 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-400'
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
                    className={`${inputCls} w-auto`}
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
                    className={`${primaryBtn} disabled:cursor-not-allowed disabled:opacity-40`}
                >
                    Enable with explicit consent
                </button>
                <button
                    type="button"
                    onClick={() => updateSettings(false)}
                    disabled={!settings.enabled}
                    className={`${ghostBtn} disabled:cursor-not-allowed disabled:opacity-40`}
                >
                    Disable
                </button>
                <button
                    type="button"
                    onClick={deleteHistory}
                    className="rounded-full border border-rose-200/80 bg-rose-50/80 px-4 py-2 text-sm text-rose-700 backdrop-blur-sm hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20"
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
