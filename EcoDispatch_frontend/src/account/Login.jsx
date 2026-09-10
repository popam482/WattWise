import { useState } from 'react';

function Login({ onLoginSuccess, switchToRegister }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    function handleLogin(e) {
        e.preventDefault();
        setError('');
        fetch('http://localhost:8080/login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username, password})
        })
            .then(res => {
                if (!res.ok) throw new Error('Invalid username or password');
                return res.json();
            })
            .then(data => {
                localStorage.setItem('token', data.token);
                localStorage.setItem('userId', data.user.id);
                if (onLoginSuccess) onLoginSuccess(data.token, data.user.id);
            })
            .catch(err => setError(err.message));
    }

    return (
        <div className="container">
            <div className="auth-card">
                <h1 className="auth-title">Sign in</h1>
                {error && <div className="error-banner">{error}</div>}
                <form onSubmit={handleLogin}>
                    <input
                        type="text"
                        placeholder="Username"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                    />
                    <button className="authenticationButton" type="submit">Login</button>
                </form>
                <p>New here?
                    <button className="authenticationButton" onClick={switchToRegister}>Sign up</button>
                </p>
            </div>
        </div>
    );
}

export default Login;