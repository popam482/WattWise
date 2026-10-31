import {useState} from 'react';
import LocationPicker from './LocationPicker.jsx';

function Register({ switchToLogin }) {
    const [step, setStep] = useState(1);

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const [userType, setUserType] = useState('CONSUMER');
    const [pvSystemKw, setPvSystemKw] = useState('');
    const [coords, setCoords] = useState({ latitude: 45.7925, longitude: 24.1520 });
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
                setError("Please fill all the required fields.");
                return;
            }
            setError('');
            setStep(2);
        } else if (step === 2) {
            if (userType === 'PROSUMER') {
                if (!pvSystemKw) {
                    setError("Please enter the Photovoltaics capacity");
                    return;
                }
                setError('');
                setStep(3);
            } else {
                setError('');
                setStep(4);
            }
        } else if (step === 3) {
            if (hasBattery) {
                if (!batteryCapacityKwh || parseFloat(batteryCapacityKwh) <= 0) {
                    setError('Enter a valid battery capacity (kWh).');
                    return;
                }
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
            // create user
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

            // Authenticated follow-up calls require a JWT
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

            //energy profile - prosumers
            if (userType === 'PROSUMER' && pvSystemKw) {
                const profileRes = await fetch(`/users/${targetUserId}/energy`, {
                    method: 'POST',
                    headers: authHeaders,
                    body: JSON.stringify({
                        pvSystemKw: parseFloat(pvSystemKw),
                        latitude: coords.latitude,
                        longitude: coords.longitude,
                        tilt: parseFloat(tilt),
                        azimuth: parseFloat(azimuth),
                        hasBattery,
                        batteryCapacityKwh: hasBattery ? parseFloat(batteryCapacityKwh) : null,
                        batteryMaxChargeKw: hasBattery ? parseFloat(batteryMaxChargeKw) : null,
                        batteryMaxDischargeKw: hasBattery ? parseFloat(batteryMaxDischargeKw) : null,
                        batteryType: hasBattery ? batteryType : null,
                    })
                });

                if (!profileRes.ok) throw new Error('Energy profile creation failed');
            }

            // save appliances
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

            // redirect to login
            if (switchToLogin) switchToLogin();

        } catch (err) {
            console.error("Detailed backend error:", err);
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="flex min-h-screen items-start justify-center bg-slate-950 px-4 py-10 text-slate-100">
            <div className="relative w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900/80 p-6 backdrop-blur-md sm:p-8 [&_input]:mb-2 [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:border-slate-700 [&_input]:bg-slate-950/60 [&_input]:px-3 [&_input]:py-2 [&_input]:text-sm [&_input]:text-slate-100 [&_select]:mb-2 [&_select]:w-full [&_select]:rounded-xl [&_select]:border [&_select]:border-slate-700 [&_select]:bg-slate-950/60 [&_select]:px-3 [&_select]:py-2 [&_select]:text-sm [&_select]:text-slate-100 [&_button]:rounded-xl [&_button]:border [&_button]:border-slate-700 [&_button]:bg-slate-950/40 [&_button]:px-3 [&_button]:py-2 [&_button]:text-sm [&_button]:text-slate-200 [&_button:hover]:bg-slate-800 [&_.authenticationButton]:border-emerald-500/30 [&_.authenticationButton]:bg-emerald-500/15 [&_.authenticationButton]:text-emerald-300 [&_h3]:mb-3 [&_h3]:text-lg [&_h3]:font-semibold [&_label]:text-sm [&_label]:text-slate-400">
                <h1 className="mb-4 text-xl font-bold text-slate-100">Sign up to WattWise</h1>
                {error && <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</div>}

                {step === 1 && (
                    <form onSubmit={handleNextStep}>
                        <input
                            type="text"
                            placeholder="Name"
                            value={name}
                            onChange={e => setName(e.target.value)}
                        />
                        <input
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                        />
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                        />
                        <button className="authenticationButton" type="submit">
                            Continue
                        </button>
                    </form>
                )}

                {step === 2 && (
                    <form onSubmit={handleNextStep}>
                        <h3>Are you a prosumer or consumer?</h3>
                        <div className="user-type-selector">
                            <button
                                type="button"
                                className={userType === 'CONSUMER' ? 'active' : ''}
                                onClick={() => setUserType('CONSUMER')}
                            >
                                Consumer
                            </button>
                            <button
                                type="button"
                                className={userType === 'PROSUMER' ? 'active' : ''}
                                onClick={() => setUserType('PROSUMER')}
                            >
                                Prosumer
                            </button>
                        </div>

                        {userType === 'PROSUMER' && (
                            <div className="prosumer-fields">
                                <input
                                    type="number"
                                    step="0.1"
                                    min={"1.0"}
                                    max={"27.0"}
                                    placeholder="Photovoltaics capacity (kWp)"
                                    value={pvSystemKw}
                                    onChange={e => setPvSystemKw(e.target.value)}
                                />
                            </div>
                        )}

                        <div className="actions">
                            <button type="button" onClick={() => setStep(1)}>
                                Back
                            </button>
                            <button className="authenticationButton" type="submit">
                                Next
                            </button>
                        </div>
                    </form>
                )}

                {step === 3 && (
                    <form onSubmit={handleNextStep}>
                        <h3>Select consumption location & PV details</h3>

                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '5px' }}>Panels Orientation (Azimuth):</label>
                            <select
                                value={azimuth}
                                onChange={e => setAzimuth(e.target.value)}
                                style={{ width: '100%', padding: '8px' }}
                                required
                            >
                                <option value={90}>East (Morning Sun)</option>
                                <option value={135}>South-East</option>
                                <option value={180}>South (Noon Sun)</option>
                                <option value={225}>South-West</option>
                                <option value={270}>West (Afternoon Sun)</option>
                            </select>
                        </div>

                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '5px' }}>Panels Tilt (Degrees):</label>
                            <input
                                type="number"
                                min="0"
                                max="90"
                                value={tilt}
                                onChange={e => setTilt(e.target.value)}
                                style={{ width: '100%', padding: '8px' }}
                                required
                            />
                        </div>

                        <LocationPicker
                            onLocationSelect={(selectedCoords) => setCoords(selectedCoords)}
                        />

                        <div style={{ marginTop: 16, marginBottom: 8 }}>
                            <label>
                                <input
                                    type="checkbox"
                                    checked={hasBattery}
                                    onChange={e => setHasBattery(e.target.checked)}
                                />
                                {' '}I have a home battery (storage)
                            </label>
                        </div>

                        {hasBattery && (
                            <div className="prosumer-fields" style={{ display: 'grid', gap: 8 }}>
                                <input
                                    type="number"
                                    min="0.5"
                                    step="0.1"
                                    placeholder="Battery capacity (kWh)"
                                    value={batteryCapacityKwh}
                                    onChange={e => setBatteryCapacityKwh(e.target.value)}
                                />
                                <input
                                    type="number"
                                    min="0.1"
                                    step="0.1"
                                    placeholder="Max charge rate (kW)"
                                    value={batteryMaxChargeKw}
                                    onChange={e => setBatteryMaxChargeKw(e.target.value)}
                                />
                                <input
                                    type="number"
                                    min="0.1"
                                    step="0.1"
                                    placeholder="Max discharge rate (kW)"
                                    value={batteryMaxDischargeKw}
                                    onChange={e => setBatteryMaxDischargeKw(e.target.value)}
                                />
                                <select value={batteryType} onChange={e => setBatteryType(e.target.value)}>
                                    <option value="LFP">LFP (LiFePO4)</option>
                                    <option value="LITHIUM_ION">Lithium-ion</option>
                                    <option value="LEAD_ACID">Lead-acid</option>
                                    <option value="FLOW">Flow battery</option>
                                    <option value="OTHER">Other</option>
                                </select>
                            </div>
                        )}

                        <div className="actions" style={{ marginTop: '15px' }}>
                            <button type="button" onClick={() => setStep(2)}>
                                Back
                            </button>
                            <button className="authenticationButton" type="submit">
                                Next
                            </button>
                        </div>
                    </form>
                )}

                {step === 4 && (
                    <div>
                        <h3>Add Appliances</h3>
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                            <input
                                type="text"
                                placeholder="Appliance name (e.g. Boiler)"
                                value={applianceName}
                                onChange={e => setApplianceName(e.target.value)}
                            />
                            <input
                                type="number"
                                step="0.1"
                                placeholder="Power (kW)"
                                value={powerKw}
                                onChange={e => setPowerKw(e.target.value)}
                            />
                            <button type="button" onClick={handleAddAppliance}>Add</button>
                        </div>

                        <div className="appliances-list">
                            {appliances.map((app, idx) => (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                    <span>{app.name} - {app.powerConsumptionKw} kW</span>
                                    <button type="button" onClick={() => handleRemoveAppliance(idx)}>Delete</button>
                                </div>
                            ))}
                        </div>

                        <div className="actions" style={{ marginTop: '15px' }}>
                            <button type="button" onClick={() => setStep(userType === 'PROSUMER' ? 3 : 2)}>
                                Back
                            </button>
                            <button
                                className="authenticationButton"
                                type="button"
                                onClick={handleFinalRegister}
                                disabled={submitting}
                            >
                                {submitting ? 'Creating account...' : 'Finish Registration'}
                            </button>
                        </div>
                    </div>
                )}

                <p>
                    Already registered?{' '}
                    <button className="authenticationButton" onClick={switchToLogin}>
                        Sign in
                    </button>
                </p>
            </div>
        </div>
    );
}

export default Register;