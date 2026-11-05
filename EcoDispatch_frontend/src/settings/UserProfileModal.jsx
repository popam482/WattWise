import {useEffect, useState} from 'react';
import {Bell, MapPin, Shield, User, X} from 'lucide-react';
import LocationPicker from '../account/LocationPicker.jsx';
import NotificationSettings from './NotificationSettings.jsx';
import HabitLearningSettings from '../privacy/HabitLearningSettings.jsx';
import {ghostBtn, primaryBtn} from '../ui/ecoStyles.js';

const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        ...(token ? {Authorization: `Bearer ${token}`} : {})
    };
};

const TABS = [
    {id: 'profile', label: 'Profile', icon: User},
    {id: 'notifications', label: 'Notifications', icon: Bell},
    {id: 'privacy', label: 'Privacy', icon: Shield}
];

function UserProfileModal({
    open,
    onClose,
    userId,
    userName,
    userEmail,
    userType,
    energyProfile,
    onEnergyProfileUpdated
}) {
    const [tab, setTab] = useState('profile');
    const [coords, setCoords] = useState(null);
    const [savingLocation, setSavingLocation] = useState(false);
    const [locationMessage, setLocationMessage] = useState('');
    const [locationError, setLocationError] = useState('');
    const [resolvedEmail, setResolvedEmail] = useState(userEmail || '');

    useEffect(() => {
        if (!open) return;
        setTab('profile');
        setLocationMessage('');
        setLocationError('');
        setResolvedEmail(userEmail || '');
        const lat = Number(energyProfile?.latitude);
        const lon = Number(energyProfile?.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
            setCoords({latitude: lat, longitude: lon});
        } else {
            setCoords({latitude: 45.7983, longitude: 24.1256});
        }
    }, [open, energyProfile?.latitude, energyProfile?.longitude, userEmail]);

    useEffect(() => {
        if (!open || resolvedEmail) return undefined;
        let cancelled = false;
        fetch('/api/v1/users/me/notifications', {headers: getAuthHeaders()})
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (cancelled || !data) return;
                const email = data.accountEmail || data.notificationEmail || '';
                if (email) setResolvedEmail(email);
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [open, resolvedEmail]);

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => {
            if (e.key === 'Escape') onClose?.();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;

    const locationLabel =
        energyProfile?.locationName
        || energyProfile?.location_name
        || (coords ? `${Number(coords.latitude).toFixed(3)}, ${Number(coords.longitude).toFixed(3)}` : '—');

    const handleSaveLocation = async () => {
        if (!userId || !coords) return;
        setSavingLocation(true);
        setLocationError('');
        setLocationMessage('');
        try {
            const body = {
                latitude: Number(coords.latitude),
                longitude: Number(coords.longitude)
            };
            if (energyProfile?.pvSystemKw != null) body.pvSystemKw = energyProfile.pvSystemKw;
            if (energyProfile?.tilt != null) body.tilt = energyProfile.tilt;
            if (energyProfile?.azimuth != null) body.azimuth = energyProfile.azimuth;
            if (energyProfile?.hasBattery != null) {
                body.hasBattery = energyProfile.hasBattery;
                body.batteryCapacityKwh = energyProfile.batteryCapacityKwh;
                body.batteryMaxChargeKw = energyProfile.batteryMaxChargeKw;
                body.batteryMaxDischargeKw = energyProfile.batteryMaxDischargeKw;
                body.batteryType = energyProfile.batteryType;
            }

            const res = await fetch(`/users/${userId}/energy`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(body)
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.message || data.error || 'Could not update location.');
            }
            const updated = await res.json();
            onEnergyProfileUpdated?.(updated);
            setLocationMessage('Home location updated — weather & solar will refresh.');
        } catch (err) {
            setLocationError(err.message || 'Could not update location.');
        } finally {
            setSavingLocation(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/45 p-4 backdrop-blur-md dark:bg-slate-950/75"
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-profile-title"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose?.();
            }}
        >
            <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] border border-white/30 bg-white/75 shadow-2xl shadow-emerald-950/25 backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/75 dark:shadow-black/40">
                <header className="flex items-start justify-between gap-3 border-b border-white/20 px-5 py-4 sm:px-6 dark:border-white/10">
                    <div>
                        <h2 id="user-profile-title" className="font-display text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
                            Profile & Settings
                        </h2>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Personal details, alerts, and AI privacy — kept out of the main dashboard.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full border border-white/25 p-2 text-slate-500 transition hover:bg-white/50 dark:border-white/10 dark:hover:bg-white/5"
                        aria-label="Close profile"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </header>

                <div className="border-b border-white/20 px-4 py-3 sm:px-6 dark:border-white/10">
                    <div className="flex flex-wrap gap-1 rounded-full border border-white/25 bg-white/40 p-1 backdrop-blur-md dark:border-white/10 dark:bg-white/5">
                        {TABS.map(({id, label, icon: Icon}) => {
                            const selected = tab === id;
                            return (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => setTab(id)}
                                    className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition sm:flex-none sm:px-4 sm:text-sm ${
                                        selected
                                            ? 'bg-lime-300 text-emerald-950 shadow-md shadow-lime-300/30'
                                            : 'text-slate-600 hover:bg-white/60 dark:text-slate-400 dark:hover:bg-white/10'
                                    }`}
                                >
                                    <Icon className="h-3.5 w-3.5" />
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="custom-scrollbar flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
                    {tab === 'profile' && (
                        <div className="space-y-6">
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="rounded-3xl border border-white/25 bg-white/40 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Name</p>
                                    <p className="mt-1 font-display text-lg font-semibold text-slate-900 dark:text-white">{userName || '—'}</p>
                                </div>
                                <div className="rounded-3xl border border-white/25 bg-white/40 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Email</p>
                                    <p className="mt-1 break-all text-sm font-medium text-slate-800 dark:text-slate-200">{resolvedEmail || '—'}</p>
                                </div>
                                <div className="rounded-3xl border border-white/25 bg-white/40 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Account type</p>
                                    <p className="mt-1 text-sm font-semibold capitalize text-emerald-700 dark:text-emerald-300">
                                        {String(userType || 'consumer').toLowerCase()}
                                    </p>
                                </div>
                                <div className="rounded-3xl border border-white/25 bg-white/40 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">City / location</p>
                                    <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-slate-800 dark:text-slate-200">
                                        <MapPin className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                        {locationLabel}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">Update home location</h3>
                                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                        Click the map to set where WattWise pulls weather and solar irradiance.
                                    </p>
                                </div>
                                {coords && (
                                    <LocationPicker
                                        initialLatitude={coords.latitude}
                                        initialLongitude={coords.longitude}
                                        onLocationSelect={(selected) => setCoords(selected)}
                                        label="Tap the map to move your home pin"
                                    />
                                )}
                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleSaveLocation}
                                        disabled={savingLocation}
                                        className={`${primaryBtn} disabled:opacity-40`}
                                    >
                                        {savingLocation ? 'Saving…' : 'Save location'}
                                    </button>
                                    <button type="button" onClick={onClose} className={ghostBtn}>
                                        Done
                                    </button>
                                </div>
                                {locationMessage && (
                                    <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">{locationMessage}</p>
                                )}
                                {locationError && (
                                    <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{locationError}</p>
                                )}
                            </div>
                        </div>
                    )}

                    {tab === 'notifications' && (
                        <NotificationSettings embedded />
                    )}

                    {tab === 'privacy' && (
                        <HabitLearningSettings userId={userId} embedded />
                    )}
                </div>
            </div>
        </div>
    );
}

export default UserProfileModal;
