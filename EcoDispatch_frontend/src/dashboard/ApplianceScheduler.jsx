import { CalendarClock, Leaf, Wallet, X } from 'lucide-react';

const overlay =
    'fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/40 p-4 backdrop-blur-sm dark:bg-slate-950/70';
const panel =
    'w-full max-w-lg rounded-2xl border border-emerald-100 bg-white p-6 shadow-2xl shadow-emerald-900/10 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900 dark:shadow-none';
const inputCls =
    'w-full rounded-xl border border-emerald-100 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-emerald-500/50';
const ghostBtn =
    'rounded-xl border border-emerald-100 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-emerald-50 dark:border-slate-700 dark:bg-transparent dark:text-slate-300 dark:hover:bg-slate-800';
const primaryBtn =
    'rounded-xl border border-transparent bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/25';

function parseLocalDateTime(value) {
    if (!value) return null;
    const normalized = String(value).replace(' ', 'T');
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
}

function formatClock(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatWindowLabel(rec) {
    const start = parseLocalDateTime(rec?.best_start_time);
    if (!start) return '—';

    let end = parseLocalDateTime(rec?.best_end_time);
    if (!end && rec?.durationMinutes) {
        end = new Date(start.getTime() + Number(rec.durationMinutes) * 60_000);
    }

    const today = new Date();
    const isToday =
        start.getFullYear() === today.getFullYear() &&
        start.getMonth() === today.getMonth() &&
        start.getDate() === today.getDate();

    const dayLabel = isToday
        ? 'Today'
        : start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

    const endLabel = end ? formatClock(end) : '—';
    return `${dayLabel} at ${formatClock(start)} – ${endLabel}`;
}

function estimateImpact(rec, powerKw) {
    const hours = Number(rec?.durationMinutes || 120) / 60;
    const power = Number(powerKw) || 0;
    const energyKwh = hours * power;

    const baseCarbon = Number(rec?.baseline_carbon_intensity ?? 420);
    const recCarbon = Number(rec?.recommended_carbon_intensity ?? 180);
    const co2Kg = Math.max(0, ((baseCarbon - recCarbon) * energyKwh) / 1000);

    const basePrice = Number(rec?.baseline_energy_price ?? 1.3);
    const recPrice = Number(rec?.recommended_energy_price ?? 0.45);
    const savingsRon = Math.max(0, (basePrice - recPrice) * energyKwh);

    return {
        co2Kg: Number.isFinite(co2Kg) ? co2Kg : 0,
        savingsRon: Number.isFinite(savingsRon) ? savingsRon : 0
    };
}

export default function ApplianceScheduler({
    appliance,
    step,
    durationHours,
    earliestStart,
    latestEnd,
    loading,
    confirming,
    recommendation,
    onDurationChange,
    onEarliestChange,
    onLatestChange,
    onFindCleanestWindow,
    onConfirm,
    onDecline,
    onClose
}) {
    if (!appliance || !step) return null;

    const powerKw = appliance.powerConsumptionKw;
    const impact = estimateImpact(recommendation, powerKw);

    return (
        <div
            className={overlay}
            role="dialog"
            aria-modal="true"
            aria-label={step === 'config' ? 'Schedule appliance' : 'Confirm schedule'}
            onClick={onClose}
        >
            <div className={panel} onClick={(e) => e.stopPropagation()}>
                <div className="mb-5 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400">
                            <CalendarClock className="h-5 w-5" />
                        </div>
                        <div>
                            {step === 'config' ? (
                                <>
                                    <h2 className="text-lg font-semibold text-emerald-950 dark:text-slate-100">
                                        Optimize Run: {appliance.name}{' '}
                                        <span className="font-medium text-slate-600 dark:text-slate-400">
                                            ({powerKw} kW)
                                        </span>
                                    </h2>
                                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                                        Set your flexibility window — we&apos;ll find the cleanest energy slot.
                                    </p>
                                </>
                            ) : (
                                <>
                                    <h2 className="text-lg font-semibold text-emerald-950 dark:text-slate-100">
                                        Optimal Execution Window Found!
                                    </h2>
                                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                                        Recommendation for {appliance.name} ({powerKw} kW)
                                    </p>
                                </>
                            )}
                        </div>
                    </div>
                    <button
                        type="button"
                        className={ghostBtn}
                        onClick={onClose}
                        aria-label="Close"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {step === 'config' && (
                    <form
                        className="space-y-4"
                        onSubmit={(e) => {
                            e.preventDefault();
                            onFindCleanestWindow();
                        }}
                    >
                        <div>
                            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400" htmlFor="sched-runtime">
                                Runtime
                            </label>
                            <select
                                id="sched-runtime"
                                value={durationHours}
                                onChange={(e) => onDurationChange(Number(e.target.value))}
                                className={inputCls}
                            >
                                <option value={1}>1 hour</option>
                                <option value={2}>2 hours</option>
                                <option value={3}>3 hours</option>
                                <option value={4}>4 hours</option>
                            </select>
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400" htmlFor="sched-earliest">
                                Earliest start
                            </label>
                            <input
                                id="sched-earliest"
                                type="datetime-local"
                                value={earliestStart}
                                onChange={(e) => onEarliestChange(e.target.value)}
                                className={inputCls}
                                required
                            />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400" htmlFor="sched-latest">
                                Must finish by
                            </label>
                            <input
                                id="sched-latest"
                                type="datetime-local"
                                value={latestEnd}
                                onChange={(e) => onLatestChange(e.target.value)}
                                className={inputCls}
                                required
                            />
                        </div>

                        <div className="flex flex-wrap gap-2 pt-2">
                            <button type="button" className={ghostBtn} onClick={onClose}>
                                Cancel
                            </button>
                            <button type="submit" className={`${primaryBtn} flex-1 sm:flex-none`} disabled={loading}>
                                {loading ? 'Scanning energy windows…' : 'Find cleanest window'}
                            </button>
                        </div>
                    </form>
                )}

                {step === 'result' && (
                    <div className="space-y-4">
                        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/5">
                            <p className="text-xs font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400">
                                Scheduled time range
                            </p>
                            <p className="mt-1 text-lg font-semibold text-emerald-950 dark:text-slate-100">
                                {formatWindowLabel(recommendation)}
                            </p>
                            {recommendation?.reason && (
                                <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                                    {recommendation.reason}
                                </p>
                            )}
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-xl border border-emerald-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/50">
                                <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
                                    <Leaf className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                    CO₂ avoided
                                </div>
                                <p className="text-xl font-bold text-emerald-800 dark:text-emerald-300">
                                    {impact.co2Kg.toFixed(2)}
                                    <span className="ml-1 text-sm font-medium text-slate-500">kg</span>
                                </p>
                            </div>
                            <div className="rounded-xl border border-blue-100 bg-sky-50/60 p-3 dark:border-blue-500/20 dark:bg-blue-500/5">
                                <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
                                    <Wallet className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                                    Financial savings
                                </div>
                                <p className="text-xl font-bold text-blue-800 dark:text-blue-300">
                                    {impact.savingsRon.toFixed(2)}
                                    <span className="ml-1 text-sm font-medium text-slate-500">RON</span>
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row-reverse">
                            <button
                                type="button"
                                className={`${primaryBtn} w-full sm:w-auto`}
                                onClick={onConfirm}
                                disabled={confirming}
                            >
                                {confirming ? 'Scheduling…' : 'Confirm & Schedule'}
                            </button>
                            <button
                                type="button"
                                className={`${ghostBtn} w-full sm:w-auto`}
                                onClick={onDecline}
                                disabled={confirming}
                            >
                                Decline / Reconfigure
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
