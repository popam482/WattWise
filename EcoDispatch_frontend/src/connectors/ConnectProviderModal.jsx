import {useEffect, useState} from 'react';

const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        ...(token ? {Authorization: `Bearer ${token}`} : {})
    };
};

function ConnectProviderModal({userId, open, onClose, onLiveLinked}) {
    const [connectors, setConnectors] = useState([]);
    const [accountLabel, setAccountLabel] = useState('');
    const [siteId, setSiteId] = useState('');
    const [shellyDeviceId, setShellyDeviceId] = useState('');
    const [shellyAuthKey, setShellyAuthKey] = useState('');
    const [shellyHost, setShellyHost] = useState('shelly-76-eu.shelly.cloud');
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [live, setLive] = useState(null);
    const [syncSample, setSyncSample] = useState(null);

    const loadConnectors = () => {
        if (!userId) return;
        fetch(`/users/${userId}/connectors`, {headers: getAuthHeaders()})
            .then(async res => {
                if (!res.ok) throw new Error('Could not load connectors');
                return res.json();
            })
            .then(data => setConnectors(Array.isArray(data) ? data : []))
            .catch(err => setError(err.message));
    };

    useEffect(() => {
        if (open) {
            setMessage('');
            setError('');
            setLive(null);
            setSyncSample(null);
            loadConnectors();
        }
    }, [open, userId]);

    if (!open) return null;

    const connect = async (provider) => {
        setBusy(true);
        setError('');
        setMessage('');
        try {
            const payload = provider === 'SHELLY'
                ? {
                    accountLabel: accountLabel || undefined,
                    deviceId: shellyDeviceId,
                    authKey: shellyAuthKey,
                    cloudHost: shellyHost || undefined,
                    externalSiteId: shellyDeviceId
                }
                : {
                    accountLabel: accountLabel || undefined,
                    externalSiteId: siteId || undefined
                };

            const res = await fetch(`/users/${userId}/connectors/${provider}/connect`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || 'Connection failed');
            }
            const status = await res.json();
            setMessage(
                provider === 'SHELLY'
                    ? `Shelly device linked${status.realCredentials ? ' with LIVE credentials' : ''}.`
                    : `Linked ${provider.replaceAll('_', ' ')} (mock OAuth).`
            );
            loadConnectors();
            if (provider === 'SHELLY' && typeof onLiveLinked === 'function') {
                onLiveLinked();
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    };

    const disconnect = async (provider) => {
        setBusy(true);
        setError('');
        try {
            const res = await fetch(`/users/${userId}/connectors/${provider}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            if (!res.ok) throw new Error('Disconnect failed');
            setMessage(`Disconnected ${provider}`);
            setLive(null);
            setSyncSample(null);
            loadConnectors();
            if (typeof onLiveLinked === 'function') onLiveLinked();
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    };

    const sync = async (provider) => {
        setBusy(true);
        setError('');
        try {
            const res = await fetch(`/users/${userId}/connectors/${provider}/sync`, {
                method: 'POST',
                headers: getAuthHeaders()
            });
            if (!res.ok) throw new Error('Sync failed');
            const data = await res.json();
            setSyncSample(data);
            setMessage(`Synced ${data.syncedPoints} hourly points from ${provider}.`);
            loadConnectors();
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    };

    const fetchLive = async (provider) => {
        setBusy(true);
        setError('');
        try {
            const res = await fetch(`/users/${userId}/connectors/${provider}/live`, {
                headers: getAuthHeaders()
            });
            if (!res.ok) throw new Error('Live read failed');
            const data = await res.json();
            setLive(data);
            if (typeof onLiveLinked === 'function') onLiveLinked();
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(10, 20, 18, 0.55)',
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
                style={{maxWidth: 760, width: '100%', maxHeight: '90vh', overflow: 'auto'}}
                onClick={e => e.stopPropagation()}
            >
                <div style={{display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start'}}>
                    <div>
                        <h2 style={{margin: 0}}>Connect real devices &amp; plants</h2>
                        <p style={{marginTop: 8}}>
                            Link a Shelly Cloud device with your real Device ID + Auth Key.
                            WattWise also pulls live PV estimates from Open-Meteo using your energy profile coordinates.
                        </p>
                    </div>
                    <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
                </div>

                {error && <div className="error-banner">{error}</div>}
                {message && <p role="status">{message}</p>}

                <div style={{
                    border: '1px solid #9fd0b0',
                    background: '#f2fbf5',
                    borderRadius: 10,
                    padding: 12,
                    marginBottom: 16
                }}>
                    <h3 style={{marginTop: 0}}>Shelly Cloud — real device</h3>
                    <p style={{fontSize: 13, marginTop: 0}}>
                        From the Shelly app: <em>User settings → Authorization cloud key</em> (host + auth key)
                        and <em>Device → Settings → Device Information → Device Id</em>.
                    </p>
                    <div style={{display: 'grid', gap: 8}}>
                        <input
                            type="text"
                            placeholder="Device ID (e.g. b48a0a1cd978)"
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
                            placeholder="Cloud host (default: shelly-76-eu.shelly.cloud)"
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
                            disabled={busy || !shellyDeviceId || !shellyAuthKey}
                            onClick={() => connect('SHELLY')}
                        >
                            Connect real Shelly device
                        </button>
                    </div>
                </div>

                <div style={{display: 'grid', gap: 10, marginBottom: 12}}>
                    <input
                        type="text"
                        placeholder="Plant / site ID for other mock providers"
                        value={siteId}
                        onChange={e => setSiteId(e.target.value)}
                    />
                </div>

                <div style={{display: 'grid', gap: 12}}>
                    {connectors.map(connector => (
                        <div
                            key={connector.provider}
                            style={{
                                border: '1px solid #c9d6cf',
                                borderRadius: 10,
                                padding: 12,
                                background: connector.connected ? '#f3faf5' : '#fff'
                            }}
                        >
                            <div style={{display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap'}}>
                                <div>
                                    <strong>{connector.displayName}</strong>
                                    {connector.provider === 'SHELLY' && connector.realCredentials && (
                                        <span style={{
                                            marginLeft: 8,
                                            fontSize: 11,
                                            background: '#1f8f4e',
                                            color: '#fff',
                                            borderRadius: 999,
                                            padding: '2px 8px'
                                        }}>
                                            REAL CREDS
                                        </span>
                                    )}
                                    <div style={{fontSize: 13, opacity: 0.8}}>{connector.category}</div>
                                    <div style={{fontSize: 13, marginTop: 4}}>
                                        {connector.connected
                                            ? `Connected as ${connector.accountLabel || 'account'} · device ${connector.externalSiteId || '—'}`
                                            : 'Not connected'}
                                    </div>
                                    {connector.statusMessage && (
                                        <div style={{fontSize: 12}}>{connector.statusMessage}</div>
                                    )}
                                </div>
                                <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
                                    {!connector.connected ? (
                                        connector.provider !== 'SHELLY' && (
                                            <button
                                                type="button"
                                                className="dispatch-button"
                                                disabled={busy}
                                                onClick={() => connect(connector.provider)}
                                            >
                                                Connect (demo)
                                            </button>
                                        )
                                    ) : (
                                        <>
                                            <button type="button" disabled={busy} onClick={() => sync(connector.provider)}>
                                                Sync 7 days
                                            </button>
                                            <button type="button" disabled={busy} onClick={() => fetchLive(connector.provider)}>
                                                Live snapshot
                                            </button>
                                            <button
                                                type="button"
                                                className="danger-button"
                                                disabled={busy}
                                                onClick={() => disconnect(connector.provider)}
                                            >
                                                Disconnect
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {live && (
                    <div style={{marginTop: 16}}>
                        <h3>
                            Live fusion
                            {(live.shellyLive || live.solarLive) && (
                                <span style={{marginLeft: 8, color: '#1f8f4e'}}>● LIVE</span>
                            )}
                        </h3>
                        <p style={{fontSize: 13}}>{live.dataSource} — {live.statusMessage}</p>
                        <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8}}>
                            <div><strong>{live.pvPowerKw} kW</strong><div>PV now {live.solarLive ? '(Open-Meteo)' : '(fallback)'}</div></div>
                            <div><strong>{live.homeLoadKw} kW</strong><div>Home load {live.shellyLive ? '(Shelly)' : '(fallback)'}</div></div>
                            <div><strong>{live.batterySocPercent}%</strong><div>Battery SoC</div></div>
                            <div><strong>{live.gridImportKw} kW</strong><div>Grid import</div></div>
                            <div><strong>{live.gridExportKw} kW</strong><div>Grid export</div></div>
                            <div><strong>{live.batteryPowerKw} kW</strong><div>Battery power</div></div>
                        </div>
                    </div>
                )}

                {syncSample?.sample?.length > 0 && (
                    <div style={{marginTop: 16}}>
                        <h3>Synced sample</h3>
                        <pre style={{fontSize: 11, maxHeight: 160, overflow: 'auto', background: '#f7f7f7', padding: 8}}>
{JSON.stringify(syncSample.sample.slice(0, 6), null, 2)}
                        </pre>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ConnectProviderModal;
