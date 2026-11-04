import {useEffect, useState} from 'react';
import {Bell, Info} from 'lucide-react';

const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        ...(token ? {Authorization: `Bearer ${token}`} : {})
    };
};

const panel =
    'rounded-2xl border border-emerald-100/80 bg-white p-6 shadow-sm shadow-emerald-900/5 dark:border-slate-800 dark:bg-slate-900/80 dark:shadow-none dark:backdrop-blur-md';

const inputCls =
    'mt-1.5 w-full rounded-xl border border-emerald-100 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100 dark:placeholder-slate-500';

function Toggle({checked, onChange, disabled, label, description}) {
    return (
        <label className={`flex items-start justify-between gap-4 rounded-xl border px-4 py-3 ${
            disabled
                ? 'border-slate-100 bg-slate-50/80 opacity-60 dark:border-slate-800 dark:bg-slate-950/40'
                : 'border-emerald-100/80 bg-emerald-50/40 dark:border-slate-700 dark:bg-slate-950/50'
        }`}>
            <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{label}</p>
                {description && (
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</p>
                )}
            </div>
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                disabled={disabled}
                onClick={() => onChange(!checked)}
                className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${
                    checked ? 'bg-emerald-600 dark:bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                } disabled:cursor-not-allowed`}
            >
                <span
                    className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                        checked ? 'translate-x-5' : 'translate-x-0'
                    }`}
                />
            </button>
        </label>
    );
}

function NotificationSettings() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const [consentGiven, setConsentGiven] = useState(false);
    const [emailEnabled, setEmailEnabled] = useState(true);
    const [telegramEnabled, setTelegramEnabled] = useState(false);
    const [telegramChatId, setTelegramChatId] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [accountEmail, setAccountEmail] = useState('');
    const [consentTimestamp, setConsentTimestamp] = useState(null);
    const [serverFlags, setServerFlags] = useState({emailConfigured: false, telegramConfigured: false});

    const loadSettings = () => {
        setError('');
        setLoading(true);
        fetch('/api/v1/users/me/notifications', {headers: getAuthHeaders()})
            .then(async (res) => {
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data.error || data.message || 'Could not load notification settings.');
                }
                return res.json();
            })
            .then((data) => {
                setConsentGiven(Boolean(data.consentGiven));
                setEmailEnabled(data.emailNotificationsEnabled !== false);
                setTelegramEnabled(Boolean(data.telegramNotificationsEnabled));
                setTelegramChatId(data.telegramChatId || '');
                setPhoneNumber(data.phoneNumber || '');
                setAccountEmail(data.accountEmail || data.notificationEmail || '');
                setConsentTimestamp(data.consentTimestamp || null);
                setServerFlags({
                    emailConfigured: Boolean(data.emailConfigured),
                    telegramConfigured: Boolean(data.telegramConfigured)
                });
            })
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        loadSettings();
    }, []);

    const handleSave = (event) => {
        event.preventDefault();
        setError('');
        setMessage('');

        if (!consentGiven) {
            setError('Consent is required before saving notification preferences.');
            return;
        }
        if (telegramEnabled && !telegramChatId.trim()) {
            setError('Paste your Telegram Chat ID to enable Telegram alerts.');
            return;
        }

        setSaving(true);
        fetch('/api/v1/users/me/notifications', {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                consentGiven: true,
                notificationsEnabled: true,
                emailNotificationsEnabled: emailEnabled,
                telegramNotificationsEnabled: telegramEnabled,
                telegramChatId: telegramChatId.trim(),
                phoneNumber: phoneNumber.trim()
            })
        })
            .then(async (res) => {
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data.error || data.message || 'Could not save settings.');
                }
                return res.json();
            })
            .then((data) => {
                setConsentGiven(Boolean(data.consentGiven));
                setConsentTimestamp(data.consentTimestamp || null);
                setMessage('Notification preferences saved.');
            })
            .catch((err) => setError(err.message))
            .finally(() => setSaving(false));
    };

    const handleRevoke = () => {
        if (!window.confirm('Stop all automated WattWise alerts? You can re-enable them later.')) return;
        setError('');
        setMessage('');
        setSaving(true);
        fetch('/api/v1/users/me/notifications', {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                consentGiven: false,
                notificationsEnabled: false
            })
        })
            .then(async (res) => {
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data.error || 'Could not revoke consent.');
                }
                return res.json();
            })
            .then(() => {
                setConsentGiven(false);
                setConsentTimestamp(null);
                setMessage('Consent revoked. Alerts are paused.');
            })
            .catch((err) => setError(err.message))
            .finally(() => setSaving(false));
    };

    const handleTest = () => {
        setError('');
        setMessage('');
        setTesting(true);
        fetch('/api/v1/notifications/test', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({})
        })
            .then(async (res) => {
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || 'Test notification failed.');
                setMessage(`Test ${data.status || 'sent'}${data.channel ? ` via ${data.channel}` : ''}.`);
            })
            .catch((err) => setError(err.message))
            .finally(() => setTesting(false));
    };

    if (loading) {
        return (
            <section className={panel}>
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-300">
                        <Bell className="h-5 w-5" />
                    </div>
                    <h2 className="text-lg font-semibold text-emerald-950 dark:text-slate-100">Notification Settings</h2>
                </div>
                {error
                    ? <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{error}</p>
                    : <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">Loading notification preferences...</p>}
            </section>
        );
    }

    const formEnabled = consentGiven;

    return (
        <section className={panel}>
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-300">
                        <Bell className="h-5 w-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-emerald-950 dark:text-slate-100">Notification Settings</h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            Choose how WattWise alerts you when an optimal energy window opens.
                        </p>
                    </div>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    consentGiven
                        ? 'border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                        : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-400'
                }`}>
                    {consentGiven ? 'CONSENT ON' : 'CONSENT OFF'}
                </span>
            </div>

            <form onSubmit={handleSave} className="space-y-5">
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-emerald-100/80 bg-emerald-50/50 px-4 py-3 dark:border-slate-700 dark:bg-slate-950/50">
                    <input
                        type="checkbox"
                        checked={consentGiven}
                        onChange={(e) => setConsentGiven(e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                        I consent to receive automated energy optimization alerts via Email and Telegram.
                        {consentTimestamp && (
                            <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                                Recorded {new Date(consentTimestamp).toLocaleString()}
                            </span>
                        )}
                    </span>
                </label>

                <fieldset disabled={!formEnabled} className="space-y-4 disabled:opacity-70">
                    <div>
                        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Account email
                        </p>
                        <p className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
                            {accountEmail || '—'}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Email alerts use your profile address
                            {serverFlags.emailConfigured ? '' : ' (SMTP not configured on server yet)'}.
                        </p>
                    </div>

                    <Toggle
                        checked={emailEnabled}
                        onChange={setEmailEnabled}
                        disabled={!formEnabled}
                        label="Enable Email Notifications"
                        description="Send alerts to your account email when a window is recommended."
                    />

                    <Toggle
                        checked={telegramEnabled}
                        onChange={setTelegramEnabled}
                        disabled={!formEnabled}
                        label="Enable Telegram Notifications"
                        description={serverFlags.telegramConfigured
                            ? 'Push alerts through the WattWise Telegram bot.'
                            : 'Telegram bot token not configured on the server yet.'}
                    />

                    <div>
                        <label htmlFor="telegram-chat-id" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                            Telegram Chat ID
                        </label>
                        <input
                            id="telegram-chat-id"
                            type="text"
                            inputMode="numeric"
                            placeholder="e.g. 123456789"
                            value={telegramChatId}
                            onChange={(e) => setTelegramChatId(e.target.value)}
                            disabled={!formEnabled || !telegramEnabled}
                            className={inputCls}
                        />
                        <p className="mt-1.5 flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                            <span>
                                Start our bot <span className="font-medium text-slate-700 dark:text-slate-300">@WattWiseAlertBot</span>,
                                send <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">/start</code> to obtain your Chat ID, and paste it here.
                            </span>
                        </p>
                    </div>

                    <div>
                        <label htmlFor="phone-number" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                            Phone number <span className="font-normal text-slate-400">(optional)</span>
                        </label>
                        <input
                            id="phone-number"
                            type="tel"
                            placeholder="+40 7xx xxx xxx"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            disabled={!formEnabled}
                            className={inputCls}
                        />
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Reserved for future SMS / WhatsApp sandbox delivery.
                        </p>
                    </div>
                </fieldset>

                <div className="flex flex-wrap gap-2 pt-1">
                    <button
                        type="submit"
                        disabled={saving || !consentGiven}
                        className="rounded-xl border border-transparent bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
                    >
                        {saving ? 'Saving...' : 'Save preferences'}
                    </button>
                    <button
                        type="button"
                        onClick={handleTest}
                        disabled={testing || !consentGiven}
                        className="rounded-xl border border-emerald-100 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                        {testing ? 'Sending...' : 'Send test alert'}
                    </button>
                    <button
                        type="button"
                        onClick={handleRevoke}
                        disabled={saving || !consentTimestamp}
                        className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20"
                    >
                        Revoke consent
                    </button>
                </div>
            </form>

            {message && <p role="status" className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">{message}</p>}
            {error && <p role="alert" className="mt-3 text-sm text-rose-600 dark:text-rose-400">{error}</p>}
        </section>
    );
}

export default NotificationSettings;
