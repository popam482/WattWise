import { useState } from 'react';
import { Zap } from 'lucide-react';
import { authCard, authShell, inputCls, primaryBtn } from '../ui/ecoStyles.js';

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
            body: JSON.stringify({ email: email.trim(), password })
        })
            .then(async (res) => {
                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(
                        errData.error ||
                        errData.message ||
                        errData.detail ||
                        'Invalid email or password'
                    );
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

    return (
        <div className={authShell}>
            <div aria-hidden className="pointer-events-none absolute inset-0">
                <img
                    src="/images/eco-hero.jpg"
                    alt=""
                    className="h-full w-full object-cover object-[center_35%] opacity-90"
                />
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/85 via-slate-950/60 to-amber-950/50" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_20%,rgba(163,230,53,0.22),transparent_45%),radial-gradient(ellipse_at_80%_80%,rgba(16,185,129,0.2),transparent_50%)]" />
            </div>

            <div className={`${authCard} max-w-md`}>
                <div className="mb-8 flex flex-col items-center text-center">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-lime-300 text-emerald-950 shadow-[0_0_32px_rgba(190,242,100,0.45)]">
                        <Zap className="h-7 w-7" />
                    </div>
                    <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
                        WattWise
                    </h1>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                        Sign in to your personal clean energy future
                    </p>
                </div>

                {error && (
                    <div className="mb-5 rounded-3xl border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 backdrop-blur-sm dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-1.5">
                        <label htmlFor="login-email" className="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
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
                        <label htmlFor="login-password" className="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
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
                        className={`${primaryBtn} mt-2 w-full py-3`}
                    >
                        {loading ? 'Signing in...' : 'Sign in'}
                    </button>
                </form>

                <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
                    Don&apos;t have an account?{' '}
                    <button
                        type="button"
                        className="font-semibold text-emerald-700 transition hover:text-emerald-800 dark:text-lime-300 dark:hover:text-lime-200"
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
