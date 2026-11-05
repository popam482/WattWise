/**
 * Shared Eco-SaaS visual tokens — glass, pills, ambient surfaces.
 * Keep light + dark modes in sync across dashboard, widgets, and auth.
 */

export const glass =
    'rounded-3xl border border-white/30 bg-white/45 shadow-xl shadow-emerald-950/10 backdrop-blur-xl ' +
    'transition-all duration-200 dark:border-white/10 dark:bg-slate-900/35 dark:shadow-black/30 ' +
    'hover:border-emerald-400/25 hover:shadow-lg hover:shadow-emerald-950/15';

export const surface =
    'rounded-3xl border border-white/25 bg-white/40 shadow-lg shadow-emerald-950/5 backdrop-blur-xl ' +
    'transition-all duration-200 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-black/20 ' +
    'hover:scale-[1.01] hover:border-emerald-400/20';

export const inset =
    'rounded-3xl border border-white/20 bg-white/30 p-5 shadow-inner backdrop-blur-md ' +
    'dark:border-white/10 dark:bg-white/[0.03]';

export const metricChip =
    'rounded-3xl border border-white/25 bg-white/35 p-4 shadow-lg shadow-emerald-950/5 backdrop-blur-xl ' +
    'dark:border-white/10 dark:bg-white/[0.04] dark:shadow-black/20';

export const inputCls =
    'w-full rounded-full border border-emerald-500/20 bg-white/70 px-4 py-2.5 text-sm text-slate-900 ' +
    'placeholder:text-slate-400 shadow-sm backdrop-blur-sm transition ' +
    'focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 ' +
    'dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-100 dark:placeholder:text-slate-500 ' +
    'dark:focus:border-emerald-400/50';

export const selectCls = inputCls.replace('rounded-full', 'rounded-2xl');

export const ghostBtn =
    'rounded-full border border-emerald-500/20 bg-white/60 px-4 py-2 text-sm font-medium text-slate-700 ' +
    'shadow-sm backdrop-blur-sm transition-all duration-200 hover:scale-[1.02] hover:bg-emerald-50/90 ' +
    'dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-emerald-500/10';

export const primaryBtn =
    'rounded-full border border-transparent bg-lime-300 px-5 py-2.5 text-sm font-semibold text-emerald-950 ' +
    'shadow-lg shadow-lime-300/25 transition-all duration-200 hover:scale-[1.02] hover:bg-lime-200 ' +
    'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 ' +
    'dark:bg-lime-300 dark:text-emerald-950 dark:hover:bg-lime-200';

export const primaryBtnSolid =
    'rounded-full border border-transparent bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white ' +
    'shadow-lg shadow-emerald-600/25 transition-all duration-200 hover:scale-[1.02] hover:bg-emerald-500 ' +
    'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 ' +
    'dark:bg-emerald-500/25 dark:text-emerald-100 dark:hover:bg-emerald-500/35';

export const sectionTitle = 'font-display text-xl font-semibold tracking-tight text-slate-900 dark:text-white';
export const sectionSub = 'mt-1 text-sm text-slate-500 dark:text-slate-400';
export const labelCaps = 'text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400';

export const pageAmbient =
    'pointer-events-none absolute inset-0 overflow-hidden';

export const authShell =
    'relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10';

export const authCard =
    'relative w-full rounded-[2rem] border border-white/30 bg-white/55 p-8 shadow-2xl shadow-emerald-950/15 ' +
    'backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/55 dark:shadow-black/40';
