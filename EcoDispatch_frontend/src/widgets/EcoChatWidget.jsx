import { useState } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';

function EcoChatWidget({ userId, userName, userType, ecoAnalytics, userAppliances, scheduledTasks }) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { sender: 'ai', text: `Hi ${userName || 'there'}! I'm your WattAssistant. How can I help you optimize your clean energy consumption today?` }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSend = async (textToSend) => {
        const query = textToSend || input;
        if (!query.trim()) return;

        const newMessages = [...messages, { sender: 'user', text: query }];
        setMessages(newMessages);
        if (!textToSend) setInput('');
        setLoading(true);

        const appliances = Array.isArray(userAppliances) ? userAppliances : [];
        const tasks = Array.isArray(scheduledTasks) ? scheduledTasks : [];
        const context = {
            user_info: `${userName} (${userType})`,
            saved_co2_kg: ecoAnalytics?.totalSavedCo2Kg || 0,
            saved_money_ron: ecoAnalytics?.totalSavedMoneyRon || 0,
            appliances: appliances.map(a => `${a.name} (${a.powerConsumptionKw}kW)`).join(', '),
            appliances_raw: appliances,
            scheduled_tasks: tasks.map(t => `${t.applianceName} at ${t.startTime}`).join(', ')
        };

        try {
            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, message: query, context })
            });
            if (!res.ok) {
                throw new Error(`AI chat request failed (${res.status})`);
            }
            const data = await res.json();

            setMessages(prev => [
                ...prev,
                { sender: 'ai', text: data.reply, action: data.action }
            ]);
        } catch {
            setMessages(prev => [
                ...prev,
                { sender: 'ai', text: "Sorry, I couldn't reach the AI service right now." }
            ]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3">
            {isOpen && (
                <div className="flex h-[440px] w-[min(100vw-2rem,380px)] flex-col overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-2xl shadow-emerald-900/10 dark:border-slate-700 dark:bg-slate-900/95 dark:shadow-emerald-950/40 dark:backdrop-blur-md">
                    <div className="flex items-center justify-between border-b border-emerald-100 bg-gradient-to-r from-emerald-50 to-sky-50 px-4 py-3 dark:border-slate-800 dark:from-emerald-950/50 dark:to-blue-950/40">
                        <div>
                            <p className="text-sm font-semibold text-emerald-950 dark:text-slate-100">EcoAssistant AI</p>
                            <p className="text-xs text-slate-600 dark:text-slate-400">WattWise energy co-pilot</p>
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
                        {messages.map((m, idx) => (
                            <div
                                key={idx}
                                className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                                    m.sender === 'user'
                                        ? 'ml-auto border border-blue-200 bg-blue-100 text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/20 dark:text-blue-100'
                                        : 'border border-emerald-100 bg-emerald-50/60 text-slate-800 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200'
                                }`}
                            >
                                {m.text}
                                {m.action && (
                                    <button
                                        type="button"
                                        className="mt-2 block w-full rounded-lg border border-transparent bg-emerald-600 px-2 py-1.5 text-xs text-white hover:bg-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
                                        onClick={() => alert(`Confirmed: ${m.action.label}`)}
                                    >
                                        {m.action.label}
                                    </button>
                                )}
                            </div>
                        ))}
                        {loading && (
                            <div className="text-xs text-slate-600 dark:text-slate-400">EcoAssistant is thinking...</div>
                        )}
                    </div>

                    <div className="flex gap-2 border-t border-emerald-100 px-3 py-2 dark:border-slate-800">
                        <button
                            type="button"
                            onClick={() => handleSend("How much CO2 did I save?")}
                            className="rounded-full border border-emerald-100 bg-white px-2.5 py-1 text-[11px] text-slate-700 hover:bg-emerald-50 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                            My Savings
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSend("When to run Washing Machine?")}
                            className="rounded-full border border-emerald-100 bg-white px-2.5 py-1 text-[11px] text-slate-700 hover:bg-emerald-50 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                            Best Washer Time
                        </button>
                    </div>

                    <form
                        onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                        className="flex gap-2 border-t border-emerald-100 p-3 dark:border-slate-800"
                    >
                        <input
                            type="text"
                            placeholder="Ask about green windows, savings..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            className="flex-1 rounded-xl border border-emerald-100 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-emerald-500/50"
                        />
                        <button
                            type="submit"
                            className="rounded-xl border border-transparent bg-emerald-600 px-3 text-white hover:bg-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/25"
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
                    Ask EcoAssistant
                </button>
            )}
        </div>
    );
}

export default EcoChatWidget;
