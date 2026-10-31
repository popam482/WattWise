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
        'w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 transition focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40';

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8">
            <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.12),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(45,212,191,0.08),_transparent_45%)]" />

            <div className="relative mx-auto w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-xl">
                <div className="mb-8 flex flex-col items-center text-center sm:flex-row sm:items-center sm:text-left">
                    <div className="mb-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/40 bg-emerald-500/15 text-emerald-400 shadow-[0_0_28px_rgba(16,185,129,0.4)] sm:mb-0 sm:mr-4">
                        <Zap className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-100">WattWise</h1>
                        <p className="mt-1 text-sm text-slate-400">Sign in to your CleanTech energy cockpit</p>
                    </div>
                </div>

                {error && (
                    <div className="mb-5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-1.5">
                        <label htmlFor="login-email" className="block text-xs font-medium uppercase tracking-wide text-slate-500">
                            Email
                        </label>
                        <input
                            id="login-email"
                            type="email"
                            placeholder="you@company.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoComplete="email"
                            className={inputCls}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label htmlFor="login-password" className="block text-xs font-medium uppercase tracking-wide text-slate-500">
                            Password
                        </label>
                        <input
                            id="login-password"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            autoComplete="current-password"
                            className={inputCls}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="mt-2 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition-all hover:from-emerald-400 hover:to-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {loading ? 'Signing in...' : 'Sign in'}
                    </button>
                </form>

                <p className="mt-6 text-center text-sm text-slate-400">
                    Don't have an account?{' '}
                    <button
                        type="button"
                        className="font-semibold text-emerald-400 transition hover:text-emerald-300"
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
