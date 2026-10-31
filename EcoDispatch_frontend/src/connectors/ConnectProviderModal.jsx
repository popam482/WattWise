import {useEffect, useMemo, useState} from 'react';
import {Cable, X} from 'lucide-react';

const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        ...(token ? {Authorization: `Bearer ${token}`} : {})
    };
};

const PROVIDER_CARDS = [
    {
        id: 'SHELLY',
        title: 'Shelly Smart Meter',
        badge: 'REAL API',
        badgeClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
        description: 'Optional live home-load from Shelly Cloud. Leave blank to keep using WattWise energy models.',
        real: true,
        needsCredentials: true
    },
    {
        id: 'OPEN_METEO',
        title: 'Open-Meteo Solar Grid',
        badge: 'REAL API',
        badgeClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
        description: 'Always on. Uses your Energy Profile coordinates + PV capacity for live irradiance and solar production.',
        real: true,
        needsCredentials: false,
        alwaysOn: true
    },
    {
        id: 'ENTERPRISE',
        title: 'Huawei FusionSolar / Fronius',
        badge: 'ENTERPRISE',
        badgeClass: 'border-slate-600 bg-slate-800/80 text-slate-300',
        description: 'Plant-level inverter connectors for enterprise demos. Uses the WattWise mock bridge until OAuth is configured.',
        real: false,
        needsCredentials: false,
        enterpriseProviders: ['HUAWEI_FUSIONSOLAR', 'FRONIUS_SOLARWEB']
    }
];

const inputClass =
    'w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500/50 focus:outline-none';
const ghostBtn =
    'rounded-xl border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40';
const primaryBtn =
    'rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-3 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-40';
const dangerBtn =
    'rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300 hover:bg-rose-500/20 disabled:opacity-40';

function ConnectProviderModal({userId, open, onClose}) {
    const [connectors, setConnectors] = useState([]);
    const [shellyDeviceId, setShellyDeviceId] = useState('');
    const [shellyAuthKey, setShellyAuthKey] = useState('');
    const [shellyHost, setShellyHost] = useState('shelly-76-eu.shelly.cloud');
    const [accountLabel, setAccountLabel] = useState('');
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState('');
    const [live, setLive] = useState(null);
    const [expandedShelly, setExpandedShelly] = useState(false);

    const byProvider = useMemo(() => {
        const map = {};
        for (const c of connectors) map[c.provider] = c;
        return map;
    }, [connectors]);

    const shelly = byProvider.SHELLY;
    const huawei = byProvider.HUAWEI_FUSIONSOLAR;
    const fronius = byProvider.FRONIUS_SOLARWEB;

    const loadConnectors = () => {
        if (!userId) return;
        fetch(`/users/${userId}/connectors`, {headers: getAuthHeaders()})
            .then(res => (res.ok ? res.json() : []))
            .then(data => setConnectors(Array.isArray(data) ? data : []))
            .catch(() => setConnectors([]));
    };

    const pullLiveHub = () => {
        if (!userId) return;
        fetch(`/users/${userId}/live-energy`, {headers: getAuthHeaders()})
            .then(res => (res.ok ? res.json() : null))
            .then(data => {
                if (data) setLive(data);
            })
            .catch(() => {
                /* silent — demo never stalls */
            });
    };

    useEffect(() => {
        if (!open) return;
        setNotice('');
        setLive(null);
        setExpandedShelly(false);
        loadConnectors();
        pullLiveHub();
    }, [open, userId]);

    if (!open) return null;

    const connectShelly = async () => {
        if (!shellyDeviceId.trim() || !shellyAuthKey.trim()) {
            setNotice('Add a Shelly Device ID and Auth Key, or skip — Open-Meteo stays active either way.');
            return;
        }
        setBusy(true);
        setNotice('');
        try {
            const res = await fetch(`/users/${userId}/connectors/SHELLY/connect`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    accountLabel: accountLabel || 'Shelly home meter',
                    deviceId: shellyDeviceId.trim(),
                    authKey: shellyAuthKey.trim(),
                    cloudHost: shellyHost.trim() || undefined,
                    externalSiteId: shellyDeviceId.trim()
                })
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || 'Could not link Shelly right now');
            }
            setNotice('Shelly linked. Live load will appear when the cloud responds.');
            setShellyAuthKey('');
            loadConnectors();
            pullLiveHub();
        } catch (err) {
            setNotice(err.message || 'Shelly link deferred — continuing on Open-Meteo + local models.');
        } finally {
            setBusy(false);
        }
    };

    const disconnect = async (provider) => {
        setBusy(true);
        setNotice('');
        try {
            const res = await fetch(`/users/${userId}/connectors/${provider}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            if (!res.ok) throw new Error('Disconnect failed');
            setNotice(`${provider.replaceAll('_', ' ')} disconnected.`);
            loadConnectors();
            pullLiveHub();
        } catch (err) {
            setNotice(err.message || 'Disconnect skipped.');
        } finally {
            setBusy(false);
        }
    };

    const connectEnterprise = async (provider) => {
        setBusy(true);
        setNotice('');
        try {
            const res = await fetch(`/users/${userId}/connectors/${provider}/connect`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    accountLabel: `${provider} demo plant`,
                    externalSiteId: `SITE-${userId}`
                })
            });
            if (!res.ok) throw new Error('Enterprise connector unavailable');
            setNotice(`${provider === 'HUAWEI_FUSIONSOLAR' ? 'Huawei FusionSolar' : 'Fronius Solar.web'} linked (enterprise bridge).`);
            loadConnectors();
        } catch (err) {
            setNotice(err.message || 'Enterprise connector deferred.');
        } finally {
            setBusy(false);
        }
    };

    const softStatus = (liveData) => {
        if (!liveData) return 'Open-Meteo + WattWise models active by default.';
        if (liveData.shellyLive && liveData.solarLive) return 'Live fusion: Shelly load + Open-Meteo PV.';
        if (liveData.solarLive) return 'Open-Meteo solar live. Shelly optional.';
        if (liveData.shellyLive) return 'Shelly load live. Solar using local estimate.';
        return 'Running on graceful local simulation — demo-safe.';
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Integrations"
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl border border-slate-700 bg-slate-900/95 p-6 shadow-2xl backdrop-blur-md"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                            <Cable className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Integration hub</p>
                            <h2 className="mt-1 text-xl font-semibold text-slate-100">Connect external applications</h2>
                            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">
                                WattWise already runs on Open-Meteo and on-device energy models.
                                Link Shelly only if you want live metered load during the pitch.
                            </p>
                        </div>
                    </div>
                    <button type="button" className={ghostBtn} onClick={onClose} aria-label="Close">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="mt-5 rounded-xl border border-emerald-500/20 bg-gradient-to-r from-emerald-950/40 to-blue-950/40 p-4">
                    <strong className="text-sm text-slate-100">{softStatus(live)}</strong>
                    {live && (
                        <div className="mt-1 text-xs text-slate-400">
                            PV {live.pvPowerKw ?? '—'} kW · Load {live.homeLoadKw ?? '—'} kW · {live.dataSource || 'local models'}
                        </div>
                    )}
                </div>

                {notice && (
                    <p role="status" className="mt-3 text-sm text-emerald-300">{notice}</p>
                )}

                <div className="mt-5 grid gap-4">
                    {PROVIDER_CARDS.map(card => (
                        <article
                            key={card.id}
                            className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4"
                        >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="text-base font-semibold text-slate-100">{card.title}</h3>
                                        <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${card.badgeClass}`}>
                                            {card.badge}
                                        </span>
                                    </div>
                                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">
                                        {card.description}
                                    </p>
                                </div>

                                {card.id === 'OPEN_METEO' && (
                                    <button type="button" className={ghostBtn} disabled>
                                        Active by default
                                    </button>
                                )}

                                {card.id === 'SHELLY' && (
                                    <div className="flex flex-wrap gap-2">
                                        {shelly?.connected ? (
                                            <>
                                                <button type="button" className={ghostBtn} disabled={busy} onClick={pullLiveHub}>
                                                    Refresh live
                                                </button>
                                                <button type="button" className={dangerBtn} disabled={busy} onClick={() => disconnect('SHELLY')}>
                                                    Disconnect
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                type="button"
                                                className={primaryBtn}
                                                disabled={busy}
                                                onClick={() => setExpandedShelly(v => !v)}
                                            >
                                                {expandedShelly ? 'Hide credentials' : 'Add Shelly credentials'}
                                            </button>
                                        )}
                                    </div>
                                )}

                                {card.id === 'ENTERPRISE' && (
                                    <div className="flex flex-wrap gap-2">
                                        {huawei?.connected ? (
                                            <button type="button" className={dangerBtn} disabled={busy} onClick={() => disconnect('HUAWEI_FUSIONSOLAR')}>
                                                Disconnect Huawei
                                            </button>
                                        ) : (
                                            <button type="button" className={ghostBtn} disabled={busy} onClick={() => connectEnterprise('HUAWEI_FUSIONSOLAR')}>
                                                Link Huawei
                                            </button>
                                        )}
                                        {fronius?.connected ? (
                                            <button type="button" className={dangerBtn} disabled={busy} onClick={() => disconnect('FRONIUS_SOLARWEB')}>
                                                Disconnect Fronius
                                            </button>
                                        ) : (
                                            <button type="button" className={ghostBtn} disabled={busy} onClick={() => connectEnterprise('FRONIUS_SOLARWEB')}>
                                                Link Fronius
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {card.id === 'SHELLY' && shelly?.connected && (
                                <p className="mt-3 text-sm text-slate-400">
                                    Linked device <strong className="text-slate-200">{shelly.externalSiteId}</strong>
                                    {shelly.realCredentials ? ' · live credentials stored' : ''}
                                </p>
                            )}

                            {card.id === 'SHELLY' && expandedShelly && !shelly?.connected && (
                                <div className="mt-4 grid gap-2">
                                    <input type="text" placeholder="Device ID" value={shellyDeviceId} onChange={e => setShellyDeviceId(e.target.value)} autoComplete="off" className={inputClass} />
                                    <input type="password" placeholder="Auth Key" value={shellyAuthKey} onChange={e => setShellyAuthKey(e.target.value)} autoComplete="off" className={inputClass} />
                                    <input type="text" placeholder="Cloud host (shelly-76-eu.shelly.cloud)" value={shellyHost} onChange={e => setShellyHost(e.target.value)} className={inputClass} />
                                    <input type="text" placeholder="Friendly label (optional)" value={accountLabel} onChange={e => setAccountLabel(e.target.value)} className={inputClass} />
                                    <button type="button" className={primaryBtn} disabled={busy} onClick={connectShelly}>
                                        Save &amp; connect Shelly
                                    </button>
                                </div>
                            )}
                        </article>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default ConnectProviderModal;
