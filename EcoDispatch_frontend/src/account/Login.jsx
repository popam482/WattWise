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
        'w-full rounded-xl border border-emerald-100 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 transition focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-500';

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50/50 via-teal-50/20 to-slate-100 px-4 py-8 dark:bg-slate-950 dark:bg-none">
            <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.14),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(45,212,191,0.10),_transparent_45%)]" />

            <div className="relative mx-auto w-full max-w-md rounded-2xl border border-emerald-100/80 bg-white p-8 shadow-2xl shadow-emerald-900/10 dark:border-slate-800 dark:bg-slate-900/80 dark:shadow-none dark:backdrop-blur-xl">
                <div className="mb-8 flex flex-col items-center text-center sm:flex-row sm:items-center sm:text-left">
                    <div className="mb-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-100 text-emerald-700 shadow-sm sm:mb-0 sm:mr-4 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-400 dark:shadow-[0_0_28px_rgba(16,185,129,0.4)]">
                        <Zap className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-emerald-950 dark:text-slate-100">WattWise</h1>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Sign in to your CleanTech energy cockpit</p>
                    </div>
                </div>

                {error && (
                    <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-1.5">
                        <label htmlFor="login-email" className="block text-xs font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400">
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
                        <label htmlFor="login-password" className="block text-xs font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400">
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
                        className="mt-2 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/15 transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gradient-to-r dark:from-emerald-500 dark:to-teal-600 dark:text-slate-950 dark:shadow-emerald-500/20 dark:hover:from-emerald-400 dark:hover:to-teal-500"
                    >
                        {loading ? 'Signing in...' : 'Sign in'}
                    </button>
                </form>

                <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
                    Don't have an account?{' '}
                    <button
                        type="button"
                        className="font-semibold text-emerald-700 transition hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
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
