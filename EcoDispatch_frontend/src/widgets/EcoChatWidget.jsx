import { useMemo, useState } from 'react';
import { CheckCircle2, Loader2, MessageCircle, Send, X, Zap } from 'lucide-react';

function EcoChatWidget({
    userId,
    userName,
    userType,
    ecoAnalytics,
    userAppliances,
    scheduledTasks,
    locationName,
    solarKw,
    solarPeakWindow = '13:00-15:00',
    onScheduleAction
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        {
            sender: 'ai',
            text: `Hi ${userName || 'there'}! I'm your WattWise energy assistant. Ask me about savings, solar windows, or when to run an appliance — in any language.`
        }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [schedulingKey, setSchedulingKey] = useState(null);

    const quickPrompts = useMemo(() => ([
        { label: 'My Savings', text: 'How much CO2 and money did I save?' },
        { label: 'Solar tips', text: 'How can I get more value from my solar production today?' }
    ]), []);

    const getAuthHeaders = () => {
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        };
    };

    const handleSend = async (textToSend) => {
        const query = textToSend || input;
        if (!query.trim() || loading) return;

        const newMessages = [...messages, { sender: 'user', text: query }];
        setMessages(newMessages);
        if (!textToSend) setInput('');
        setLoading(true);

        const appliances = Array.isArray(userAppliances) ? userAppliances : [];
        const tasks = Array.isArray(scheduledTasks) ? scheduledTasks : [];
        const history = newMessages
            .slice(-10)
            .filter((m) => m.text)
            .map((m) => ({
                role: m.sender === 'user' ? 'user' : 'assistant',
                content: m.text
            }));

        const context = {
            user_info: `${userName || 'User'} (${userType || 'CONSUMER'})`,
            location_name: locationName || null,
            saved_co2_kg: ecoAnalytics?.totalSavedCo2Kg || 0,
            saved_money_ron: ecoAnalytics?.totalSavedMoneyRon || 0,
            solar_kw: Number.isFinite(Number(solarKw)) ? Number(solarKw) : null,
            solar_peak_window: solarPeakWindow,
            appliances: appliances.map((a) => `${a.name} (${a.powerConsumptionKw}kW)`).join(', '),
            appliances_raw: appliances,
            scheduled_tasks: tasks.map((t) => `${t.applianceName} at ${t.startTime}`).join(', ')
        };

        try {
            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    message: query,
                    context,
                    history
                })
            });
            if (!res.ok) {
                throw new Error(`AI chat request failed (${res.status})`);
            }
            const data = await res.json();
            const action = data.suggestedAction || data.action || null;

            setMessages((prev) => [
                ...prev,
                {
                    sender: 'ai',
                    text: data.reply,
                    action,
                    scheduleState: null
                }
            ]);
        } catch {
            setMessages((prev) => [
                ...prev,
                { sender: 'ai', text: "Sorry, I couldn't reach the AI service right now." }
            ]);
        } finally {
            setLoading(false);
        }
    };

    const handleAutoSchedule = async (messageIndex, action) => {
        if (!action?.applianceId || !action?.startTime) return;
        const key = `${messageIndex}-${action.applianceId}-${action.startTime}`;
        setSchedulingKey(key);

        try {
            if (typeof onScheduleAction === 'function') {
                await onScheduleAction(action);
            } else {
                const durationHours = Number(action.durationHours) || 2;
                const payload = {
                    id: action.applianceId,
                    startTime: String(action.startTime).replace(' ', 'T'),
                    durationMinutes: Math.max(15, Math.round(durationHours * 60)),
                    decisionReason: action.reason || 'Scheduled via WattAssistant'
                };
                const res = await fetch(`/users/${userId}/appliances/schedule`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(payload)
                });
                if (!res.ok) {
                    const detail = await res.text();
                    throw new Error(detail || `Schedule failed (${res.status})`);
                }
            }

            setMessages((prev) => prev.map((m, idx) => (
                idx === messageIndex
                    ? { ...m, scheduleState: 'done' }
                    : m
            )));
        } catch (err) {
            setMessages((prev) => prev.map((m, idx) => (
                idx === messageIndex
                    ? { ...m, scheduleState: 'error', scheduleError: err.message || 'Could not schedule' }
                    : m
            )));
        } finally {
            setSchedulingKey(null);
        }
    };

    return (
        <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3">
            {isOpen && (
                <div className="flex h-[500px] w-[min(100vw-2rem,400px)] flex-col overflow-hidden rounded-[2rem] border border-white/30 bg-white/70 shadow-2xl shadow-emerald-950/20 backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/70 dark:shadow-black/40">
                    <div className="relative overflow-hidden border-b border-white/20 px-4 py-3.5 dark:border-white/10">
                        <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-r from-lime-300/15 via-transparent to-emerald-400/10" />
                        <div className="relative flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-lime-300 text-emerald-950 shadow-[0_0_20px_rgba(190,242,100,0.45)]">
                                    <Zap className="h-4 w-4" />
                                    <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-lime-200 shadow-[0_0_8px_rgba(190,242,100,0.9)]" />
                                </div>
                                <div>
                                    <p className="font-display text-sm font-semibold tracking-tight text-slate-900 dark:text-white">WattAssistant</p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                        Energy co-pilot · multi-lingual
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="rounded-full border border-white/25 p-1.5 text-slate-500 transition hover:bg-white/50 hover:text-emerald-800 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-100"
                                aria-label="Close chat"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
                        {messages.map((m, idx) => {
                            const action = m.action;
                            const busy = schedulingKey === `${idx}-${action?.applianceId}-${action?.startTime}`;
                            return (
                                <div
                                    key={idx}
                                    className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm transition ${
                                        m.sender === 'user'
                                            ? 'ml-auto bg-gradient-to-br from-cyan-500/15 to-emerald-500/10 text-slate-800 dark:from-cyan-400/20 dark:to-emerald-500/10 dark:text-slate-100'
                                            : 'border border-emerald-500/10 bg-white/70 text-slate-800 dark:border-white/10 dark:bg-white/5 dark:text-slate-200'
                                    }`}
                                >
                                    <p className="whitespace-pre-wrap">{m.text}</p>
                                    {action?.type === 'SCHEDULE_APPLIANCE' && (
                                        <div className="mt-2 space-y-1.5">
                                            {action.reason && (
                                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                                    {action.reason}
                                                </p>
                                            )}
                                            {m.scheduleState === 'done' ? (
                                                <div className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-100 px-2 py-1.5 text-xs font-medium text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                    Scheduled {action.applianceName} at {action.time}
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    disabled={busy}
                                                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-lime-300 px-2 py-1.5 text-xs font-semibold text-emerald-950 shadow-md shadow-lime-300/25 transition hover:scale-[1.01] hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-50"
                                                    onClick={() => handleAutoSchedule(idx, action)}
                                                >
                                                    {busy ? (
                                                        <>
                                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                            Scheduling…
                                                        </>
                                                    ) : (
                                                        action.label || `[Auto-Schedule Now] ${action.applianceName}`
                                                    )}
                                                </button>
                                            )}
                                            {m.scheduleState === 'error' && (
                                                <p className="text-[11px] text-rose-600 dark:text-rose-400">
                                                    {m.scheduleError || 'Schedule failed'}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {loading && (
                            <div className="inline-flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-500" />
                                WattAssistant is thinking…
                            </div>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-2 border-t border-emerald-500/10 px-3 py-2 dark:border-white/10">
                        {quickPrompts.map((prompt) => (
                            <button
                                key={prompt.label}
                                type="button"
                                onClick={() => handleSend(prompt.text)}
                                className="rounded-full border border-emerald-500/15 bg-white/70 px-2.5 py-1 text-[11px] text-slate-600 transition hover:scale-[1.02] hover:bg-emerald-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-emerald-500/10"
                            >
                                {prompt.label}
                            </button>
                        ))}
                    </div>

                    <form
                        onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                        className="flex gap-2 border-t border-emerald-500/10 p-3 dark:border-white/10"
                    >
                        <input
                            type="text"
                            placeholder="Ask in any language about green windows…"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            className="flex-1 rounded-full border border-white/25 bg-white/60 px-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 backdrop-blur-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-100 dark:placeholder:text-slate-500"
                        />
                        <button
                            type="submit"
                            disabled={loading}
                            className="rounded-full bg-lime-300 px-3.5 text-emerald-950 shadow-lg shadow-lime-300/25 transition hover:scale-[1.03] hover:bg-lime-200 disabled:opacity-50"
                            aria-label="Send"
                        >
                            <Send className="h-4 w-4" />
                        </button>
                    </form>
                </div>
            )}

            {!isOpen && (
                <button
                    type="button"
                    onClick={() => setIsOpen(true)}
                    className="inline-flex items-center gap-2 rounded-full border border-lime-300/40 bg-lime-300 px-4 py-3 text-sm font-semibold text-emerald-950 shadow-xl shadow-lime-300/30 transition-all duration-200 hover:scale-[1.03] hover:bg-lime-200"
                >
                    <MessageCircle className="h-4 w-4" />
                    Ask WattAssistant
                </button>
            )}
        </div>
    );
}

export default EcoChatWidget;
