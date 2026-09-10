import { useState } from 'react';

function Register({ onRegisterSuccess, switchToLogin }) {
    const [step, setStep] = useState(1);

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const [userType, setUserType] = useState('CONSUMER');
    const [pvSystemKw, setPvSystemKw] = useState('');
    const [error, setError] = useState('');

    function handleNextStep(e) {
        e.preventDefault();
        if (!name || !password || !email) {
            setError("Please fill all the required fields.");
            return;
        }
        setError('');
        setStep(2);
    }

    function handleFinalRegister(e) {
        e.preventDefault();
        setError('');

        const payload = {
            name,
            email,
            password,
            userType,
        };

        fetch('http://localhost:8080/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
            .then(res => {
                if (!res.ok) throw new Error('Registration failed');
                return res.json();
            })
            .then(data => {
                if (userType === 'PROSUMER' && pvSystemKw) {
                    return fetch(`http://localhost:8080/users/${data.id}/energy-profile`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            pvSystemKw: parseFloat(pvSystemKw),
                            latitude: 45.7925,
                            longitude: 24.1520
                        })
                    });
                }
            })
            .then(() => {
                if (switchToLogin) switchToLogin();
            })
            .catch(err => setError(err.message));
    }

    return (
        <div className="container">
            <div className="auth-card">
                <h1 className="auth-title">Sign up</h1>
                {error && <div className="error-banner">{error}</div>}

                {step === 1 ? (
                    <form onSubmit={handleNextStep}>
                        <input
                            type="text"
                            placeholder="Username"
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
                            Continuă
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleFinalRegister}>
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
                                Finish registration
                            </button>
                        </div>
                    </form>
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