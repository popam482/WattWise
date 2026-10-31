import {useState} from 'react';
import {Zap} from 'lucide-react';
import LocationPicker from './LocationPicker.jsx';

const SIBIU = {latitude: 45.7983, longitude: 24.1256};

const inputCls =
    'mb-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 transition focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40';
const ghostBtn =
    'rounded-xl border border-slate-700 bg-slate-950/40 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-800';
const primaryBtn =
    'rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition-all hover:from-emerald-400 hover:to-teal-500 disabled:cursor-not-allowed disabled:opacity-50';

function Register({ switchToLogin }) {
    const [step, setStep] = useState(1);

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const [userType, setUserType] = useState('CONSUMER');
    const [pvSystemKw, setPvSystemKw] = useState('');
    const [coords, setCoords] = useState({...SIBIU});
    const [tilt, setTilt] = useState(35);
    const [azimuth, setAzimuth] = useState(180);
    const [hasBattery, setHasBattery] = useState(false);
    const [batteryCapacityKwh, setBatteryCapacityKwh] = useState('10');
    const [batteryMaxChargeKw, setBatteryMaxChargeKw] = useState('3.5');
    const [batteryMaxDischargeKw, setBatteryMaxDischargeKw] = useState('3.5');
    const [batteryType, setBatteryType] = useState('LFP');

    const [appliances, setAppliances] = useState([]);
    const [applianceName, setApplianceName] = useState('');
    const [powerKw, setPowerKw] = useState('');

    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    function handleNextStep(e) {
        e.preventDefault();

        if (step === 1) {
            if (!name || !password || !email) {
                setError('Please fill all the required fields.');
                return;
            }
            setError('');
            setStep(2);
        } else if (step === 2) {
            if (userType === 'PROSUMER' && !pvSystemKw) {
                setError('Please enter the Photovoltaics capacity');
                return;
            }
            setError('');
            setStep(3); // both consumers and prosumers set a location
        } else if (step === 3) {
            if (userType === 'PROSUMER' && hasBattery) {
                if (!batteryCapacityKwh || parseFloat(batteryCapacityKwh) <= 0) {
                    setError('Enter a valid battery capacity (kWh).');
                    return;
                }
            }
            if (!Number.isFinite(Number(coords.latitude)) || !Number.isFinite(Number(coords.longitude))) {
                setError('Please pick a location on the map.');
                return;
            }
            setError('');
            setStep(4);
        }
    }

    function handleAddAppliance(e) {
        e.preventDefault();
        if (!applianceName || !powerKw) return;
        setAppliances([...appliances, { name: applianceName, powerConsumptionKw: parseFloat(powerKw) }]);
        setApplianceName('');
        setPowerKw('');
    }

    function handleRemoveAppliance(index) {
        setAppliances(appliances.filter((_, i) => i !== index));
    }

    async function handleFinalRegister(e) {
        e.preventDefault();
        if (submitting) return;
        setError('');
        setSubmitting(true);

        const payload = { name, email, password, userType };

        try {
            const res = await fetch('/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(
                    errorData.message ||
                    errorData.detail ||
                    errorData.error ||
                    `User creation failed (${res.status})`
                );
            }

            const user = await res.json();
            const targetUserId = user.id || user.userId || user.user_id;

            const loginRes = await fetch('/users/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            if (!loginRes.ok) {
                throw new Error('Account created, but automatic sign-in failed. Please sign in manually.');
            }
            const loginData = await loginRes.json();
            const token = loginData.token;
            if (!token) {
                throw new Error('Account created, but no auth token was returned. Please sign in manually.');
            }

            const authHeaders = {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            };

            // Location profile for everyone (consumers: weather only · prosumers: PV + weather)
            const profileBody = userType === 'PROSUMER'
                ? {
                    pvSystemKw: parseFloat(pvSystemKw),
                    latitude: coords.latitude,
                    longitude: coords.longitude,
                    tilt: parseFloat(tilt),
                    azimuth: parseFloat(azimuth),
                    hasBattery,
                    batteryCapacityKwh: hasBattery ? parseFloat(batteryCapacityKwh) : null,
                    batteryMaxChargeKw: hasBattery ? parseFloat(batteryMaxChargeKw) : null,
                    batteryMaxDischargeKw: hasBattery ? parseFloat(batteryMaxDischargeKw) : null,
                    batteryType: hasBattery ? batteryType : null
                }
                : {
                    pvSystemKw: 0,
                    latitude: coords.latitude ?? SIBIU.latitude,
                    longitude: coords.longitude ?? SIBIU.longitude,
                    hasBattery: false
                };

            const profileRes = await fetch(`/users/${targetUserId}/energy`, {
                method: 'POST',
                headers: authHeaders,
                body: JSON.stringify(profileBody)
            });
            if (!profileRes.ok) {
                throw new Error('Energy / location profile creation failed');
            }

            for (const app of appliances) {
                const applianceRes = await fetch(`/users/${targetUserId}/appliances`, {
                    method: 'POST',
                    headers: authHeaders,
                    body: JSON.stringify(app)
                });
                if (!applianceRes.ok) {
                    throw new Error(`Failed to save appliance "${app.name}"`);
                }
            }

            if (switchToLogin) switchToLogin();
        } catch (err) {
            console.error('Detailed backend error:', err);
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="flex min-h-screen items-start justify-center bg-slate-950 px-4 py-8 text-slate-100 sm:py-10">
            <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.10),_transparent_50%)]" />
            <div className="relative mx-auto w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
                <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-500/40 bg-emerald-500/15 text-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.35)]">
                        <Zap className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-100">Sign up to WattWise</h1>
                        <p className="text-sm text-slate-400">Step {step} of 4</p>
                    </div>
                </div>

                {error && (
                    <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                        {error}
                    </div>
                )}

                {step === 1 && (
                    <form onSubmit={handleNextStep} className="space-y-1">
                        <input type="text" placeholder="Name" value={name} onChange={e => setName(e.target.value)} className={inputCls} />
                        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} />
                        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className={inputCls} />
                        <button className={`${primaryBtn} mt-3 w-full`} type="submit">Continue</button>
                    </form>
                )}

                {step === 2 && (
                    <form onSubmit={handleNextStep} className="space-y-4">
                        <h3 className="text-lg font-semibold text-slate-100">Are you a prosumer or consumer?</h3>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                                    userType === 'CONSUMER'
                                        ? 'border-blue-500/40 bg-blue-500/15 text-blue-300'
                                        : 'border-slate-700 bg-slate-950/50 text-slate-400 hover:bg-slate-800'
                                }`}
                                onClick={() => setUserType('CONSUMER')}
                            >
                                Consumer
                            </button>
                            <button
                                type="button"
                                className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                                    userType === 'PROSUMER'
                                        ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                                        : 'border-slate-700 bg-slate-950/50 text-slate-400 hover:bg-slate-800'
                                }`}
                                onClick={() => setUserType('PROSUMER')}
                            >
                                Prosumer
                            </button>
                        </div>

                        {userType === 'PROSUMER' && (
                            <input
                                type="number"
                                step="0.1"
                                min="1.0"
                                max="27.0"
                                placeholder="Photovoltaics capacity (kWp)"
                                value={pvSystemKw}
                                onChange={e => setPvSystemKw(e.target.value)}
                                className={inputCls}
                            />
                        )}

                        <div className="flex flex-wrap gap-2 pt-2">
                            <button type="button" className={ghostBtn} onClick={() => setStep(1)}>Back</button>
                            <button className={primaryBtn} type="submit">Next</button>
                        </div>
                    </form>
                )}

                {step === 3 && (
                    <form onSubmit={handleNextStep} className="space-y-4">
                        <h3 className="text-lg font-semibold text-slate-100">
                            {userType === 'PROSUMER' ? 'Location & PV details' : 'Your home location'}
                        </h3>
                        <p className="text-sm text-slate-400">
                            {userType === 'PROSUMER'
                                ? 'We use this for live solar irradiance and local weather.'
                                : 'Used for local weather and SEN grid outlook — no solar capacity required.'}
                        </p>

                        <LocationPicker
                            initialLatitude={coords.latitude}
                            initialLongitude={coords.longitude}
                            onLocationSelect={(selectedCoords) => setCoords(selectedCoords)}
                            label={userType === 'PROSUMER'
                                ? 'Click the map to set your PV site'
                                : 'Click the map to set your home city'}
                        />

                        {userType === 'PROSUMER' && (
                            <>
                                <div>
                                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
                                        Panels Orientation (Azimuth)
                                    </label>
                                    <select
                                        value={azimuth}
                                        onChange={e => setAzimuth(e.target.value)}
                                        className={inputCls}
                                        required
                                    >
                                        <option value={90}>East (Morning Sun)</option>
                                        <option value={135}>South-East</option>
                                        <option value={180}>South (Noon Sun)</option>
                                        <option value={225}>South-West</option>
                                        <option value={270}>West (Afternoon Sun)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
                                        Panels Tilt (Degrees)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="90"
                                        value={tilt}
                                        onChange={e => setTilt(e.target.value)}
                                        className={inputCls}
                                        required
                                    />
                                </div>

                                <label className="flex items-center gap-2 text-sm text-slate-300">
                                    <input
                                        type="checkbox"
                                        checked={hasBattery}
                                        onChange={e => setHasBattery(e.target.checked)}
                                        className="accent-emerald-500"
                                    />
                                    I have a home battery (storage)
                                </label>

                                {hasBattery && (
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        <input type="number" min="0.5" step="0.1" placeholder="Battery capacity (kWh)" value={batteryCapacityKwh} onChange={e => setBatteryCapacityKwh(e.target.value)} className={inputCls} />
                                        <input type="number" min="0.1" step="0.1" placeholder="Max charge rate (kW)" value={batteryMaxChargeKw} onChange={e => setBatteryMaxChargeKw(e.target.value)} className={inputCls} />
                                        <input type="number" min="0.1" step="0.1" placeholder="Max discharge rate (kW)" value={batteryMaxDischargeKw} onChange={e => setBatteryMaxDischargeKw(e.target.value)} className={inputCls} />
                                        <select value={batteryType} onChange={e => setBatteryType(e.target.value)} className={inputCls}>
                                            <option value="LFP">LFP (LiFePO4)</option>
                                            <option value="LITHIUM_ION">Lithium-ion</option>
                                            <option value="LEAD_ACID">Lead-acid</option>
                                            <option value="FLOW">Flow battery</option>
                                            <option value="OTHER">Other</option>
                                        </select>
                                    </div>
                                )}
                            </>
                        )}

                        <div className="flex flex-wrap gap-2 pt-2">
                            <button type="button" className={ghostBtn} onClick={() => setStep(2)}>Back</button>
                            <button className={primaryBtn} type="submit">Next</button>
                        </div>
                    </form>
                )}

                {step === 4 && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-slate-100">Add Appliances</h3>
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <input type="text" placeholder="Appliance name (e.g. Boiler)" value={applianceName} onChange={e => setApplianceName(e.target.value)} className={`${inputCls} mb-0 sm:flex-1`} />
                            <input type="number" step="0.1" placeholder="Power (kW)" value={powerKw} onChange={e => setPowerKw(e.target.value)} className={`${inputCls} mb-0 sm:w-32`} />
                            <button type="button" onClick={handleAddAppliance} className={ghostBtn}>Add</button>
                        </div>

                        <div className="space-y-2">
                            {appliances.map((app, idx) => (
                                <div key={idx} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm">
                                    <span className="text-slate-300">{app.name} — {app.powerConsumptionKw} kW</span>
                                    <button type="button" onClick={() => handleRemoveAppliance(idx)} className="text-rose-400 hover:text-rose-300">Delete</button>
                                </div>
                            ))}
                        </div>

                        <div className="flex flex-wrap gap-2 pt-2">
                            <button type="button" className={ghostBtn} onClick={() => setStep(3)}>Back</button>
                            <button
                                className={primaryBtn}
                                type="button"
                                onClick={handleFinalRegister}
                                disabled={submitting}
                            >
                                {submitting ? 'Creating account...' : 'Finish Registration'}
                            </button>
                        </div>
                    </div>
                )}

                <p className="mt-6 text-center text-sm text-slate-400">
                    Already registered?{' '}
                    <button type="button" className="font-semibold text-emerald-400 hover:text-emerald-300" onClick={switchToLogin}>
                        Sign in
                    </button>
                </p>
            </div>
        </div>
    );
}

export default Register;
