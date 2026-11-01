import { CalendarClock, Leaf, Wallet, X, Ban, RefreshCw, Zap } from 'lucide-react';

const overlay =
    'fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/40 p-4 backdrop-blur-sm dark:bg-slate-950/70';
const panel =
    'w-full max-w-xl rounded-2xl border border-emerald-100 bg-white p-5 shadow-2xl shadow-emerald-900/10 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900 dark:shadow-none sm:p-6';
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

function pad2(n) {
    return String(n).padStart(2, '0');
}

/** Round UP to next :00 / :15 / :30 / :45. */
export function snapToNext15MinDate(date) {
    const d = new Date(date.getTime());
    d.setSeconds(0, 0);
    const remainder = d.getMinutes() % 15;
    if (remainder !== 0) {
        d.setMinutes(d.getMinutes() + (15 - remainder));
    }
    return d;
}

function formatClock(date) {
    const snapped = snapToNext15MinDate(date);
    return `${pad2(snapped.getHours())}:${pad2(snapped.getMinutes())}`;
}

export function formatWindowLabel(rec) {
    const startRaw = parseLocalDateTime(rec?.best_start_time);
    if (!startRaw) return '—';
    const start = snapToNext15MinDate(startRaw);

    let endRaw = parseLocalDateTime(rec?.best_end_time);
    if (!endRaw && rec?.durationMinutes) {
        endRaw = new Date(start.getTime() + Number(rec.durationMinutes) * 60_000);
    }
    const end = endRaw ? snapToNext15MinDate(endRaw) : null;

    const today = new Date();
    const isToday =
        start.getFullYear() === today.getFullYear() &&
        start.getMonth() === today.getMonth() &&
        start.getDate() === today.getDate();

    const dayLabel = isToday
        ? 'Today'
        : start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

    const endLabel = end ? formatClock(end) : '—';
    return `${dayLabel}, ${formatClock(start)} - ${endLabel}`;
}

/** 1 tree ≈ 1.75 kg CO₂ absorbed / month. */
export const KG_CO2_PER_TREE_PER_MONTH = 1.75;

/** Honest annual run counts for recurring rules. */
export function runsPerYear(recurringDays) {
    const rule = String(recurringDays || 'DAILY').toUpperCase();
    if (rule === 'WEEKDAYS') return 250;
    if (rule === 'WEEKENDS') return 104;
    if (rule === 'DAILY') return 365;
    return 250;
}

/**
 * Prefer server-side RunCost / CO₂ delta; fall back to intensity×energy only when absent.
 * Handles already-optimal (near-now) windows via evening-peak comparison + absolute footprint.
 */
export function estimateImpact(rec, powerKw) {
    const hours = Number(rec?.durationMinutes || 120) / 60;
    const power = Number(powerKw) || 0;
    const energyKwh = hours * power;

    const serverCo2 = Number(rec?.co2_avoided_kg ?? rec?.co2AvoidedKg);
    const co2Kg = Number.isFinite(serverCo2)
        ? Math.max(0, serverCo2)
        : Math.max(
            0,
            ((Number(rec?.baseline_carbon_intensity ?? 420) -
                Number(rec?.recommended_carbon_intensity ?? 180)) *
                energyKwh) /
                1000
        );

    const serverRunCo2 = Number(rec?.run_co2_kg ?? rec?.runCo2Kg);
    const runCo2Kg = Number.isFinite(serverRunCo2)
        ? Math.max(0, serverRunCo2)
        : Math.max(0, (Number(rec?.recommended_carbon_intensity ?? 180) * energyKwh) / 1000);

    const serverSavings = Number(rec?.single_run_savings_ron ?? rec?.singleRunSavingsRon);
    const savingsRon = Number.isFinite(serverSavings)
        ? Math.max(0, serverSavings)
        : Math.max(
            0,
            (Number(rec?.baseline_energy_price ?? 1.3) -
                Number(rec?.recommended_energy_price ?? 0.45)) *
                energyKwh
        );

    let renewableShare = Number(
        rec?.renewable_share_percent ?? rec?.renewableSharePercent ?? NaN
    );
    // Never display a dead 0% when decision factors carry a live SEN mix
    const senFromFactors = Number(rec?.decision_factors?.['SEN Renewable Mix %']);
    if ((!Number.isFinite(renewableShare) || renewableShare < 1) && Number.isFinite(senFromFactors) && senFromFactors >= 1) {
        renewableShare = senFromFactors;
    }

    const isFixedTariff = Boolean(
        rec?.is_fixed_tariff ?? rec?.isFixedTariff ?? (Number.isFinite(savingsRon) && savingsRon < 0.05)
    );
    const isAlreadyOptimal = Boolean(rec?.is_already_optimal ?? rec?.isAlreadyOptimal);
    const co2Basis = String(rec?.co2_comparison_basis ?? rec?.co2ComparisonBasis ?? 'immediate');
    const showPeakDelta = co2Basis === 'evening_peak' && co2Kg >= 0.01;
    const showAbsoluteFootprint = isAlreadyOptimal && co2Kg < 0.01;

    return {
        co2Kg: Number.isFinite(co2Kg) ? co2Kg : 0,
        runCo2Kg: Number.isFinite(runCo2Kg) ? runCo2Kg : 0,
        savingsRon: Number.isFinite(savingsRon) ? savingsRon : 0,
        renewableShare: Number.isFinite(renewableShare) ? renewableShare : null,
        isFixedTariff,
        isAlreadyOptimal,
        co2Basis,
        showPeakDelta,
        showAbsoluteFootprint,
        treesMonth: Number.isFinite(co2Kg) && co2Kg > 0
            ? co2Kg / KG_CO2_PER_TREE_PER_MONTH
            : (Number.isFinite(runCo2Kg) ? 0 : 0)
    };
}

function shortImpactSummary(recommendation) {
    const hours = Math.max(1, Math.round(Number(recommendation?.durationMinutes || 60) / 60));
    const raw = String(recommendation?.reason || '').trim();
    if (raw) {
        const first = raw.split(/(?<=\.)\s+/)[0].trim();
        if (first.length > 0 && first.length <= 110) return first;
        if (first.length > 110) return `${first.slice(0, 107).trim()}…`;
    }
    return `Selected the lowest-carbon & cost-effective ${hours}-hour window.`;
}

/** Compact 3-metric strip: Savings · CO₂ · Renewable — always all three. */
function ImpactCards({ recommendation, powerKw, isRecurring = false, recurringDays = 'DAILY' }) {
    const impact = estimateImpact(recommendation, powerKw);
    const annualRon = isRecurring ? impact.savingsRon * runsPerYear(recurringDays) : null;
    const co2Value = impact.showAbsoluteFootprint ? impact.runCo2Kg : impact.co2Kg;

    return (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-blue-100 bg-sky-50/60 p-3 dark:border-blue-500/20 dark:bg-blue-500/5">
                <div className="mb-1 flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400">
                    <Wallet className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    Est. Savings
                </div>
                <p className="text-lg font-bold tabular-nums text-blue-800 dark:text-blue-300">
                    {impact.savingsRon.toFixed(2)}
                    <span className="ml-1 text-xs font-medium text-slate-500">RON</span>
                </p>
                {isRecurring && annualRon != null && annualRon > 0 && (
                    <span className="mt-1 inline-block rounded-md border border-blue-200 bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:border-blue-500/30 dark:bg-slate-950/40 dark:text-blue-300">
                        ~{Math.round(annualRon)} RON/yr
                    </span>
                )}
                {impact.isFixedTariff && impact.savingsRon < 0.05 && (
                    <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">Fixed tariff</p>
                )}
            </div>

            <div className="rounded-xl border border-emerald-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/50">
                <div className="mb-1 flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400">
                    <Leaf className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    {impact.showPeakDelta ? 'CO₂ vs Peak' : 'CO₂ Impact'}
                </div>
                <p className="text-lg font-bold tabular-nums text-emerald-800 dark:text-emerald-300">
                    {co2Value.toFixed(2)}
                    <span className="ml-1 text-xs font-medium text-slate-500">kg CO₂</span>
                </p>
            </div>

            <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 dark:border-emerald-500/20 dark:bg-emerald-500/5">
                <div className="mb-1 flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400">
                    <Zap className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    Renewable
                </div>
                <p className="text-lg font-bold tabular-nums text-emerald-800 dark:text-emerald-300">
                    {impact.renewableShare != null && impact.renewableShare >= 1
                        ? impact.renewableShare.toFixed(0)
                        : '—'}
                    <span className="ml-1 text-xs font-medium text-slate-500">%</span>
                </p>
            </div>
        </div>
    );
}

/** Manual flexible-load schedule wizard (config → result). */
function nowLocalDatetimeValue() {
    const snapped = snapToNext15MinDate(new Date());
    return `${snapped.getFullYear()}-${pad2(snapped.getMonth() + 1)}-${pad2(snapped.getDate())}T${pad2(snapped.getHours())}:${pad2(snapped.getMinutes())}`;
}

function snapDatetimeLocalValue(value) {
    const parsed = parseLocalDateTime(value);
    if (!parsed) return nowLocalDatetimeValue();
    const snapped = snapToNext15MinDate(parsed);
    return `${snapped.getFullYear()}-${pad2(snapped.getMonth() + 1)}-${pad2(snapped.getDate())}T${pad2(snapped.getHours())}:${pad2(snapped.getMinutes())}`;
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
    const minEarliest = nowLocalDatetimeValue();

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
                    <button type="button" className={ghostBtn} onClick={onClose} aria-label="Close">
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
                                step={900}
                                value={earliestStart}
                                min={minEarliest}
                                onChange={(e) => {
                                    const raw = e.target.value < minEarliest ? minEarliest : e.target.value;
                                    onEarliestChange(snapDatetimeLocalValue(raw));
                                }}
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
                                step={900}
                                value={latestEnd}
                                min={earliestStart || minEarliest}
                                onChange={(e) => onLatestChange(snapDatetimeLocalValue(e.target.value))}
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
                        <div>
                            <p className="text-lg font-semibold text-emerald-950 dark:text-slate-100">
                                {formatWindowLabel(recommendation)}
                            </p>
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                                {shortImpactSummary(recommendation)}
                            </p>
                        </div>

                        <ImpactCards
                            recommendation={recommendation}
                            powerKw={powerKw}
                            isRecurring={false}
                        />

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

/** Shared Manual ↔ Automatic mode toggle (mint / dark aware). */
export function RecurringModeSwitch({ checked, onChange, disabled = false, label = 'Enable Smart Recurring Rule' }) {
    return (
        <label className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                disabled={disabled}
                onClick={() => onChange(!checked)}
                className={`relative h-6 w-11 shrink-0 rounded-full border transition disabled:opacity-40 ${
                    checked
                        ? 'border-emerald-300 bg-emerald-200 dark:border-emerald-500/40 dark:bg-emerald-500/30'
                        : 'border-slate-300 bg-slate-200 dark:border-slate-600 dark:bg-slate-800'
                }`}
            >
                <span
                    className={`absolute rounded-full bg-white transition ${
                        checked ? 'left-5' : 'left-0.5'
                    }`}
                    style={{ width: 18, height: 18, top: 3 }}
                />
            </button>
            <span className="font-medium">{label}</span>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide ${
                checked
                    ? 'border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                    : 'border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300'
            }`}>
                {checked ? 'AUTOMATIC' : 'MANUAL'}
            </span>
        </label>
    );
}

/** Immediate approval after creating / enabling a smart recurring appliance. */
export function RecurringApprovalModal({
    open,
    appliance,
    recommendation,
    loading,
    confirming,
    onApprove,
    onCancel,
    recurringDays = 'DAILY'
}) {
    if (!open || !appliance) return null;

    const windowLabel = formatWindowLabel(recommendation);

    return (
        <div
            className={overlay}
            role="dialog"
            aria-modal="true"
            aria-label="Confirm automatic schedule"
            onClick={onCancel}
        >
            <div className={panel} onClick={(e) => e.stopPropagation()}>
                <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <RefreshCw className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                            <h2 className="truncate text-base font-semibold text-emerald-950 dark:text-slate-100 sm:text-lg">
                                {appliance.name}
                            </h2>
                        </div>
                        {!loading && (
                            <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-800 dark:text-emerald-300">
                                {windowLabel}
                            </p>
                        )}
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                            {loading
                                ? 'Calculating the cleanest upcoming window…'
                                : shortImpactSummary(recommendation)}
                        </p>
                    </div>
                    <button type="button" className={ghostBtn} onClick={onCancel} aria-label="Close">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {!loading && (
                    <div className="space-y-4">
                        <ImpactCards
                            recommendation={recommendation}
                            powerKw={appliance.powerConsumptionKw}
                            isRecurring
                            recurringDays={
                                recurringDays
                                || recommendation?.pendingConfig?.recurringDays
                                || appliance?.recurringDays
                                || 'DAILY'
                            }
                        />

                        <div className="flex flex-col gap-2 sm:flex-row-reverse">
                            <button
                                type="button"
                                className={`${primaryBtn} w-full sm:w-auto`}
                                onClick={onApprove}
                                disabled={confirming || !recommendation?.best_start_time}
                            >
                                {confirming ? 'Activating…' : 'Approve & Activate Rule'}
                            </button>
                            <button
                                type="button"
                                className={`${ghostBtn} w-full sm:w-auto`}
                                onClick={onCancel}
                                disabled={confirming}
                            >
                                Cancel / Reconfigure
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/** Choose one-day skip vs deactivate entire recurring rule. */
export function RecurringCancelModal({
    open,
    applianceName,
    selectedDateLabel,
    busy,
    onCancelOneDay,
    onCancelAllFuture,
    onClose
}) {
    if (!open) return null;

    return (
        <div
            className={overlay}
            role="dialog"
            aria-modal="true"
            aria-label="Cancel recurring schedule"
            onClick={onClose}
        >
            <div className={panel} onClick={(e) => e.stopPropagation()}>
                <div className="mb-5 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                            <Ban className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-emerald-950 dark:text-slate-100">
                                Cancel Schedule
                            </h2>
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                                Choose how to cancel {applianceName ? `"${applianceName}"` : 'this recurring run'}.
                            </p>
                        </div>
                    </div>
                    <button type="button" className={ghostBtn} onClick={onClose} aria-label="Close" disabled={busy}>
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="space-y-3">
                    <button
                        type="button"
                        className="w-full rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 text-left transition hover:bg-emerald-50 dark:border-slate-700 dark:bg-slate-950/50 dark:hover:bg-slate-800"
                        onClick={onCancelOneDay}
                        disabled={busy}
                    >
                        <p className="text-sm font-semibold text-emerald-950 dark:text-slate-100">
                            Cancel ONLY the run on {selectedDateLabel}
                        </p>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                            Adds an exception for this date. The recurring rule stays active for future days.
                        </p>
                    </button>

                    <button
                        type="button"
                        className="w-full rounded-xl border border-rose-200 bg-rose-50/60 p-4 text-left transition hover:bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/5 dark:hover:bg-rose-500/10"
                        onClick={onCancelAllFuture}
                        disabled={busy}
                    >
                        <p className="text-sm font-semibold text-rose-800 dark:text-rose-300">
                            Cancel ALL future recurring runs
                        </p>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                            Deactivates the automatic rule completely. You can re-enable it later from Edit.
                        </p>
                    </button>
                </div>

                <div className="mt-4 flex justify-end">
                    <button type="button" className={ghostBtn} onClick={onClose} disabled={busy}>
                        Keep schedule
                    </button>
                </div>
            </div>
        </div>
    );
}
