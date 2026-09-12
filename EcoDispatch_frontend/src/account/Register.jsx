import {useState} from 'react';
import LocationPicker from './LocationPicker.jsx';

function Register({onRegisterSuccess, switchToLogin}) {
    const [step, setStep] = useState(1);

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const [userType, setUserType] = useState('CONSUMER');
    const [pvSystemKw, setPvSystemKw] = useState('');
    const [coords, setCoords] = useState({latitude: 45.7925, longitude: 24.1520});

    const [appliances, setAppliances] = useState([]);
    const [applianceName, setApplianceName] = useState('');
    const [powerKw, setPowerKw] = useState('');

    const [error, setError] = useState('');

    function handleNextStep(e) {
        e.preventDefault();

        if (step === 1) {
            if (!name || !password || !email) {
                setError("Please fill all the required fields.");
                return;
            }
            setError('');
            setStep(2); // step 2 - consumer/prosumer
        } else if (step === 2) {
            if (userType === 'PROSUMER') {
                if (!pvSystemKw) {
                    setError("Please enter the Photovoltaics capacity");
                    return;
                }
                setError('');
                setStep(3); // step 3 - go to map
            } else {
                setError('');
                setStep(4); // step 4 - appliances
            }
        } else if (step === 3) {
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

    function handleFinalRegister(e) {
        e.preventDefault();
        setError('');

        const payload = { name, email, password, userType };

        fetch('http://localhost:8080/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
            .then(async res => {
                if (!res.ok) {
                    const errorData = await res.json().catch(() => ({}));
                    throw new Error(errorData.message || 'User creation failed');
                }
                return res.json();
            })
            .then(async (user) => {
                if (userType === 'PROSUMER' && pvSystemKw) {
                    const profileRes = await fetch(`http://localhost:8080/users/${user.id}/energy`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            pvSystemKw: parseFloat(pvSystemKw),
                            latitude: coords.latitude,
                            longitude: coords.longitude,
                        })
                    });
                    if (!profileRes.ok) throw new Error('Energy profile creation failed');
                }
                for (const app of appliances) {
                    await fetch(`http://localhost:8080/users/${user.id}/appliances`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(app)
                    });
                }
            })
            .then(() => {
                if (switchToLogin) switchToLogin();
            })
            .catch(err => {
                console.error("Detailed backend error:", err);
                setError(err.message);
            });
    }

    return (
        <div className="container">
            <div className="auth-card">
                <h1 className="auth-title">Sign up</h1>
                {error && <div className="error-banner">{error}</div>}

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
                        <h3>Select consumption location</h3>
                        <LocationPicker
                            onLocationSelect={(selectedCoords) => setCoords(selectedCoords)}
                        />
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
                            <button className="authenticationButton" type="button" onClick={handleFinalRegister}>
                                Finish Registration
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