import {ArrowRight, Sun, Zap} from 'lucide-react';

/**
 * Immersive Eco-Hero — full-bleed marketing first viewport for WattWise.
 * Background: /images/eco-hero.jpg (warm “idea of power” visual).
 */
function SolarPulseHero({
    isProsumer = false,
    solarKw = null,
    liveLabel = 'LIVE DATA',
    userName = 'User',
    welcomeMessage = 'Welcome',
    tipText = null,
    briefing = null,
    savingsCo2 = 0,
    savingsRon = 0,
    actions = null,
    onPrimaryAction = null,
    primaryLabel = 'Open Live Dispatch'
}) {
    const hasLiveSolar = isProsumer && Number.isFinite(Number(solarKw)) && Number(solarKw) > 0.05;
    const statusText = hasLiveSolar
        ? 'Live Solar Pulse'
        : (isProsumer ? 'Solar Standby' : 'Grid Clean Pulse');

    return (
        <section className="relative isolate min-h-[88vh] w-full overflow-hidden">
            {/* Dominant hero visual */}
            <img
                src="/images/eco-hero.jpg"
                alt=""
                className="absolute inset-0 h-full w-full object-cover object-[center_40%]"
            />
            {/* Warm eco overlay for readability — matches lightbulb glow + forest greens */}
            <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-br from-emerald-950/85 via-slate-950/55 to-amber-950/45"
            />
            <div
                aria-hidden
                className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(251,191,36,0.22),transparent_45%),radial-gradient(ellipse_at_80%_70%,rgba(16,185,129,0.18),transparent_50%)]"
            />
            <div
                aria-hidden
                className={`pointer-events-none absolute -left-10 top-24 h-72 w-72 rounded-full blur-3xl animate-pulse-slow ${
                    hasLiveSolar ? 'bg-amber-400/25' : 'bg-emerald-400/15'
                }`}
            />
            {/* Soft blend into dashboard content below */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-36 bg-gradient-to-b from-transparent via-slate-50/40 to-slate-50 dark:via-slate-950/50 dark:to-slate-950"
            />

            <div className="relative mx-auto flex min-h-[88vh] max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
                {/* Minimal glass nav */}
                <nav className="flex flex-wrap items-center justify-between gap-3 rounded-full border border-white/15 bg-white/10 px-3 py-2 shadow-2xl shadow-black/20 backdrop-blur-md sm:px-4">
                    <div className="flex items-center gap-2.5 pl-1">
                        <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-lime-300 text-emerald-950 shadow-[0_0_24px_rgba(190,242,100,0.45)]">
                            {hasLiveSolar ? <Sun className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
                            <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime-300 opacity-70" />
                                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-lime-200" />
                            </span>
                        </div>
                        <div>
                            <p className="font-display text-base font-semibold tracking-tight text-white">WattWise</p>
                            <p className="text-[11px] text-white/65">{welcomeMessage} {userName}</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="hidden items-center gap-1.5 rounded-full border border-white/15 bg-black/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80 sm:inline-flex">
                            <span className="relative flex h-1.5 w-1.5">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime-300 opacity-70" />
                                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-lime-300" />
                            </span>
                            {liveLabel}
                        </span>
                        {actions}
                    </div>
                </nav>

                {/* Brand-first hero copy — first viewport composition */}
                <div className="mt-auto flex max-w-3xl flex-col gap-6 pb-10 pt-16 sm:pb-14 sm:pt-20">
                    <p className="inline-flex w-fit items-center gap-2 rounded-full border border-lime-300/30 bg-lime-300/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-lime-100 backdrop-blur-sm">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime-300 opacity-70" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-lime-300 shadow-[0_0_10px_rgba(190,242,100,0.9)]" />
                        </span>
                        {statusText}
                        {hasLiveSolar && (
                            <span className="normal-case tracking-normal text-lime-50">
                                · {Number(solarKw).toFixed(2)} kW
                            </span>
                        )}
                    </p>

                    <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
                        Your personal clean energy future
                    </h1>

                    <p className="max-w-xl text-base leading-relaxed text-white/80 sm:text-lg">
                        Plug into smarter solar windows, quieter bills, and a greener grid —
                        WattWise turns every kilowatt into momentum for your home.
                    </p>

                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            type="button"
                            onClick={onPrimaryAction}
                            className="inline-flex items-center gap-2 rounded-full bg-lime-300 px-5 py-3 text-sm font-semibold text-emerald-950 shadow-2xl shadow-lime-300/25 transition-all duration-200 hover:scale-[1.03] hover:bg-lime-200"
                        >
                            {primaryLabel}
                            <ArrowRight className="h-4 w-4" />
                        </button>
                        <div className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs text-white/85 backdrop-blur-md">
                            Saved{' '}
                            <span className="font-semibold text-lime-200">{Number(savingsCo2 || 0).toFixed(1)} kg CO₂</span>
                            {' · '}
                            <span className="font-semibold text-white">{Number(savingsRon || 0).toFixed(2)} RON</span>
                        </div>
                    </div>

                    {(briefing || tipText) && (
                        <div className="max-w-2xl rounded-3xl border border-white/15 bg-black/25 p-5 shadow-2xl shadow-black/30 backdrop-blur-md">
                            {briefing ? (
                                <>
                                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-lime-200/90">
                                        Today&apos;s energy briefing
                                    </p>
                                    <p className="text-sm leading-relaxed text-white/90">{briefing}</p>
                                </>
                            ) : (
                                <p className="text-sm leading-relaxed text-white/85">
                                    <span className="font-semibold text-lime-200">Tip · </span>
                                    {tipText}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}

export default SolarPulseHero;
