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
                <div className="flex h-[480px] w-[min(100vw-2rem,400px)] flex-col overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-2xl shadow-emerald-900/10 dark:border-slate-700 dark:bg-slate-900/95 dark:shadow-emerald-950/40 dark:backdrop-blur-md">
                    <div className="flex items-center justify-between border-b border-emerald-100 bg-gradient-to-r from-emerald-50 to-sky-50 px-4 py-3 dark:border-slate-800 dark:from-emerald-950/50 dark:to-blue-950/40">
                        <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300">
                                <Zap className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-emerald-950 dark:text-slate-100">WattAssistant</p>
                                <p className="text-xs text-slate-600 dark:text-slate-400">
                                    Energy co-pilot · multi-lingual
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="rounded-lg border border-emerald-100 p-1.5 text-slate-600 hover:bg-emerald-50 hover:text-emerald-950 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                            aria-label="Close chat"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
                        {messages.map((m, idx) => {
                            const action = m.action;
                            const busy = schedulingKey === `${idx}-${action?.applianceId}-${action?.startTime}`;
                            return (
                                <div
                                    key={idx}
                                    className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                                        m.sender === 'user'
                                            ? 'ml-auto border border-blue-200 bg-blue-100 text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/20 dark:text-blue-100'
                                            : 'border border-emerald-100 bg-emerald-50/60 text-slate-800 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200'
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
                                                <div className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-100 px-2 py-1.5 text-xs font-medium text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                    Scheduled {action.applianceName} at {action.time}
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    disabled={busy}
                                                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-transparent bg-emerald-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/25"
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
                            <div className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                WattAssistant is thinking…
                            </div>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-2 border-t border-emerald-100 px-3 py-2 dark:border-slate-800">
                        {quickPrompts.map((prompt) => (
                            <button
                                key={prompt.label}
                                type="button"
                                onClick={() => handleSend(prompt.text)}
                                className="rounded-full border border-emerald-100 bg-white px-2.5 py-1 text-[11px] text-slate-700 hover:bg-emerald-50 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                                {prompt.label}
                            </button>
                        ))}
                    </div>

                    <form
                        onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                        className="flex gap-2 border-t border-emerald-100 p-3 dark:border-slate-800"
                    >
                        <input
                            type="text"
                            placeholder="Ask in any language about green windows…"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            className="flex-1 rounded-xl border border-emerald-100 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-emerald-500/50"
                        />
                        <button
                            type="submit"
                            disabled={loading}
                            className="rounded-xl border border-transparent bg-emerald-600 px-3 text-white hover:bg-emerald-700 disabled:opacity-50 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/25"
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
                    className="inline-flex items-center gap-2 rounded-full border border-transparent bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/20 hover:bg-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300 dark:shadow-emerald-950/50 dark:backdrop-blur-md dark:hover:bg-emerald-500/25"
                >
                    <MessageCircle className="h-4 w-4" />
                    Ask WattAssistant
                </button>
            )}
        </div>
    );
}

export default EcoChatWidget;
