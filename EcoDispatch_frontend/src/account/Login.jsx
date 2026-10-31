import { useState } from 'react';
import { Zap } from 'lucide-react';

function Login({ onLoginSuccess, switchToRegister }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        fetch('/users/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        })
            .then(async (res) => {
                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData.message || 'Invalid email or password');
                }
                return res.json();
            })
            .then((userData) => {
                onLoginSuccess(userData);
            })
            .catch((err) => {
                setError(err.message);
            })
            .finally(() => {
                setLoading(false);
            });
    };

    const inputCls =
        'w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500/50 focus:outline-none';

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
            <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.10),_transparent_50%)]" />
            <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-8 backdrop-blur-md">
                <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-500/40 bg-emerald-500/15 text-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.35)]">
                        <Zap className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-100">WattWise</h1>
                        <p className="text-sm text-slate-400">Sign in to your energy cockpit</p>
                    </div>
                </div>

                {error && (
                    <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-3">
                    <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className={inputCls}
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className={inputCls}
                    />
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-4 py-2.5 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-40"
                    >
                        {loading ? 'Signing in...' : 'Sign in'}
                    </button>
                </form>

                <p className="mt-5 text-center text-sm text-slate-400">
                    Don't have an account?{' '}
                    <button
                        type="button"
                        className="font-medium text-emerald-400 hover:text-emerald-300"
                        onClick={switchToRegister}
                    >
                        Sign up
                    </button>
                </p>
            </div>
        </div>
    );
}

export default Login;
