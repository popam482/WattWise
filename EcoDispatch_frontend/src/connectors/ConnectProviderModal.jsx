import {useEffect, useMemo, useState} from 'react';

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
        badgeTone: '#1f8f4e',
        description: 'Optional live home-load from Shelly Cloud. Leave blank to keep using WattWise energy models.',
        real: true,
        needsCredentials: true
    },
    {
        id: 'OPEN_METEO',
        title: 'Open-Meteo Solar Grid',
        badge: 'REAL API',
        badgeTone: '#1f8f4e',
        description: 'Always on. Uses your Energy Profile coordinates + PV capacity for live irradiance and solar production.',
        real: true,
        needsCredentials: false,
        alwaysOn: true
    },
    {
        id: 'ENTERPRISE',
        title: 'Huawei FusionSolar / Fronius',
        badge: 'ENTERPRISE',
        badgeTone: '#5b6b7c',
        description: 'Plant-level inverter connectors for enterprise demos. Uses the WattWise mock bridge until OAuth is configured.',
        real: false,
        needsCredentials: false,
        enterpriseProviders: ['HUAWEI_FUSIONSOLAR', 'FRONIUS_SOLARWEB']
    }
];

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
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(12, 22, 20, 0.52)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                padding: 16
            }}
            onClick={onClose}
        >
            <div
                className="auth-card"
                style={{
                    maxWidth: 820,
                    width: '100%',
                    maxHeight: '90vh',
                    overflow: 'auto',
                    borderRadius: 16,
                    padding: 22
                }}
                onClick={e => e.stopPropagation()}
            >
                <div style={{display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start'}}>
                    <div>
                        <p style={{margin: 0, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.65}}>
                            Integration hub
                        </p>
                        <h2 style={{margin: '6px 0 8px'}}>Connect external applications</h2>
                        <p style={{margin: 0, maxWidth: 560, lineHeight: 1.45}}>
                            WattWise already runs on Open-Meteo and on-device energy models.
                            Link Shelly only if you want live metered load during the pitch.
                        </p>
                    </div>
                    <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
                </div>

                <div
                    style={{
                        marginTop: 16,
                        marginBottom: 18,
                        padding: '12px 14px',
                        borderRadius: 12,
                        background: 'linear-gradient(120deg, rgba(31,143,78,0.10), rgba(40,90,140,0.08))',
                        border: '1px solid rgba(31,143,78,0.25)'
                    }}
                >
                    <strong style={{fontSize: 13}}>{softStatus(live)}</strong>
                    {live && (
                        <div style={{fontSize: 12, marginTop: 4, opacity: 0.85}}>
                            PV {live.pvPowerKw ?? '—'} kW · Load {live.homeLoadKw ?? '—'} kW · {live.dataSource || 'local models'}
                        </div>
                    )}
                </div>

                {notice && (
                    <p role="status" style={{fontSize: 13, marginTop: 0}}>{notice}</p>
                )}

                <div style={{display: 'grid', gap: 14}}>
                    {PROVIDER_CARDS.map(card => (
                        <article
                            key={card.id}
                            style={{
                                border: '1px solid #d5e0d9',
                                borderRadius: 14,
                                padding: 16,
                                background: '#fff'
                            }}
                        >
                            <div style={{display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap'}}>
                                <div>
                                    <div style={{display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap'}}>
                                        <h3 style={{margin: 0}}>{card.title}</h3>
                                        <span style={{
                                            fontSize: 11,
                                            fontWeight: 700,
                                            color: '#fff',
                                            background: card.badgeTone,
                                            borderRadius: 999,
                                            padding: '3px 9px'
                                        }}>
                                            {card.badge}
                                        </span>
                                    </div>
                                    <p style={{margin: '8px 0 0', fontSize: 14, lineHeight: 1.45, maxWidth: 520}}>
                                        {card.description}
                                    </p>
                                </div>

                                {card.id === 'OPEN_METEO' && (
                                    <button type="button" className="btn-secondary" disabled>
                                        Active by default
                                    </button>
                                )}

                                {card.id === 'SHELLY' && (
                                    <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
                                        {shelly?.connected ? (
                                            <>
                                                <button type="button" className="btn-secondary" disabled={busy} onClick={pullLiveHub}>
                                                    Refresh live
                                                </button>
                                                <button type="button" className="danger-button" disabled={busy} onClick={() => disconnect('SHELLY')}>
                                                    Disconnect
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                type="button"
                                                className="dispatch-button"
                                                disabled={busy}
                                                onClick={() => setExpandedShelly(v => !v)}
                                            >
                                                {expandedShelly ? 'Hide credentials' : 'Add Shelly credentials'}
                                            </button>
                                        )}
                                    </div>
                                )}

                                {card.id === 'ENTERPRISE' && (
                                    <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
                                        {huawei?.connected ? (
                                            <button type="button" className="danger-button" disabled={busy} onClick={() => disconnect('HUAWEI_FUSIONSOLAR')}>
                                                Disconnect Huawei
                                            </button>
                                        ) : (
                                            <button type="button" className="btn-secondary" disabled={busy} onClick={() => connectEnterprise('HUAWEI_FUSIONSOLAR')}>
                                                Link Huawei
                                            </button>
                                        )}
                                        {fronius?.connected ? (
                                            <button type="button" className="danger-button" disabled={busy} onClick={() => disconnect('FRONIUS_SOLARWEB')}>
                                                Disconnect Fronius
                                            </button>
                                        ) : (
                                            <button type="button" className="btn-secondary" disabled={busy} onClick={() => connectEnterprise('FRONIUS_SOLARWEB')}>
                                                Link Fronius
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {card.id === 'SHELLY' && shelly?.connected && (
                                <p style={{fontSize: 13, marginBottom: 0, marginTop: 12}}>
                                    Linked device <strong>{shelly.externalSiteId}</strong>
                                    {shelly.realCredentials ? ' · live credentials stored' : ''}
                                </p>
                            )}

                            {card.id === 'SHELLY' && expandedShelly && !shelly?.connected && (
                                <div style={{display: 'grid', gap: 8, marginTop: 14}}>
                                    <input
                                        type="text"
                                        placeholder="Device ID"
                                        value={shellyDeviceId}
                                        onChange={e => setShellyDeviceId(e.target.value)}
                                        autoComplete="off"
                                    />
                                    <input
                                        type="password"
                                        placeholder="Auth Key"
                                        value={shellyAuthKey}
                                        onChange={e => setShellyAuthKey(e.target.value)}
                                        autoComplete="off"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Cloud host (shelly-76-eu.shelly.cloud)"
                                        value={shellyHost}
                                        onChange={e => setShellyHost(e.target.value)}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Friendly label (optional)"
                                        value={accountLabel}
                                        onChange={e => setAccountLabel(e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        className="dispatch-button"
                                        disabled={busy}
                                        onClick={connectShelly}
                                    >
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
