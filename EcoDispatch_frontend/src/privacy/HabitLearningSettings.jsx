import {useEffect, useState} from 'react';

const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        ...(token ? {'Authorization': `Bearer ${token}`} : {})
    };
};

function HabitLearningSettings({userId}) {
    const [settings, setSettings] = useState(null);
    const [retentionDays, setRetentionDays] = useState(90);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        fetch(`/users/${userId}/privacy/habit-learning`, {
            headers: getAuthHeaders()
        }).then(async response => {
            if (!response.ok) throw new Error('Nu am putut încărca setările de confidențialitate.');
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
            <section className="privacy-section">
                <h2>Habit Privacy</h2>
                {error ? <p className="error-banner">{error}</p> : <p>Loading privacy settings...</p>}
            </section>
        );
    }

    return (
        <section className="privacy-section">
            <h2>Habit Privacy</h2>
            <p>
                We only use the day of the week, time, device type, and duration to create aggregated patterns.
                We do not send raw history to the ML service. By default, data collection is disabled.
            </p>
            <label>
                Retain data for a maximum of
                <select value={retentionDays} onChange={event => setRetentionDays(event.target.value)}>
                    <option value="30">30 days</option>
                    <option value="90">90 days</option>
                    <option value="180">180 days</option>
                    <option value="365">365 days</option>
                </select>
            </label>
            <div>
                <button type="button" onClick={() => updateSettings(true)} disabled={settings.enabled}>
                    Enable with explicit consent
                </button>
                <button type="button" onClick={() => updateSettings(false)} disabled={!settings.enabled}>
                    Disable
                </button>
                <button type="button" onClick={deleteHistory}>
                    Delete history
                </button>
            </div>
            {message && <p role="status">{message}</p>}
            {error && <p role="alert">{error}</p>}
        </section>
    );
}

export default HabitLearningSettings;
