import {useEffect, useState} from 'react';

const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        ...(token ? {Authorization: `Bearer ${token}`} : {})
    };
};

/**
 * Pulsating LIVE badge for the pitch — polls fused Shelly + Open-Meteo hub.
 * Never surfaces hard errors; falls back to a quiet offline label.
 */
function LiveEnergyBadge({userId, refreshKey = 0}) {
    const [live, setLive] = useState(null);

    useEffect(() => {
        if (!userId) return undefined;

        let cancelled = false;
        const controller = new AbortController();

        const pull = () => {
            fetch(`/users/${userId}/live-energy`, {
                headers: getAuthHeaders(),
                signal: controller.signal
            })
                .then(res => (res.ok ? res.json() : null))
                .then(data => {
                    if (!cancelled && data) setLive(data);
                })
                .catch(() => {
                    /* keep last good sample — never crash the dashboard */
                });
        };

        pull();
        const timer = setInterval(pull, 15000);
        return () => {
            cancelled = true;
            controller.abort();
            clearInterval(timer);
        };
    }, [userId, refreshKey]);

    const isLive = Boolean(live?.shellyLive || live?.solarLive);

    return (
        <div
            className="live-energy-badge"
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                borderRadius: 999,
                background: isLive ? 'rgba(31, 143, 78, 0.12)' : 'rgba(100, 100, 100, 0.08)',
                border: `1px solid ${isLive ? '#1f8f4e' : '#999'}`,
                marginBottom: 12
            }}
            title={live?.statusMessage || 'Waiting for live energy feeds'}
        >
            <span
                style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: isLive ? '#1f8f4e' : '#999',
                    boxShadow: isLive ? '0 0 0 0 rgba(31, 143, 78, 0.7)' : 'none',
                    animation: isLive ? 'wattwise-pulse 1.6s infinite' : 'none'
                }}
            />
            <div style={{lineHeight: 1.25}}>
                <strong style={{fontSize: 13}}>
                    {isLive
                        ? 'LIVE DATA: Fetching from Shelly & Open-Meteo'
                        : 'Energy feeds warming up (graceful fallback active)'}
                </strong>
                {live && (
                    <div style={{fontSize: 12, opacity: 0.85}}>
                        PV {live.pvPowerKw ?? '—'} kW
                        {live.solarLive ? ' ●' : ''}
                        {' · '}
                        Load {live.homeLoadKw ?? '—'} kW
                        {live.shellyLive ? ' ●' : ''}
                        {' · '}
                        {live.dataSource || '—'}
                    </div>
                )}
            </div>
            <style>{`
                @keyframes wattwise-pulse {
                    0% { box-shadow: 0 0 0 0 rgba(31, 143, 78, 0.65); }
                    70% { box-shadow: 0 0 0 12px rgba(31, 143, 78, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(31, 143, 78, 0); }
                }
            `}</style>
        </div>
    );
}

export default LiveEnergyBadge;
