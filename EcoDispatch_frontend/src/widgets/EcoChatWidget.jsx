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
                <div className="flex h-[440px] w-[min(100vw-2rem,380px)] flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/95 shadow-2xl shadow-emerald-950/40 backdrop-blur-md">
                    <div className="flex items-center justify-between border-b border-slate-800 bg-gradient-to-r from-emerald-950/50 to-blue-950/40 px-4 py-3">
                        <div>
                            <p className="text-sm font-semibold text-slate-100">EcoAssistant AI</p>
                            <p className="text-xs text-slate-400">WattWise energy co-pilot</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="rounded-lg border border-slate-700 p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
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
                                        ? 'ml-auto bg-blue-500/20 text-blue-100 border border-blue-500/30'
                                        : 'bg-slate-800/80 text-slate-200 border border-slate-700'
                                }`}
                            >
                                {m.text}
                                {m.action && (
                                    <button
                                        type="button"
                                        className="mt-2 block w-full rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/20"
                                        onClick={() => alert(`Confirmed: ${m.action.label}`)}
                                    >
                                        {m.action.label}
                                    </button>
                                )}
                            </div>
                        ))}
                        {loading && (
                            <div className="text-xs text-slate-500">EcoAssistant is thinking...</div>
                        )}
                    </div>

                    <div className="flex gap-2 border-t border-slate-800 px-3 py-2">
                        <button
                            type="button"
                            onClick={() => handleSend("How much CO2 did I save?")}
                            className="rounded-full border border-slate-700 bg-slate-950/60 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-slate-800"
                        >
                            My Savings
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSend("When to run Washing Machine?")}
                            className="rounded-full border border-slate-700 bg-slate-950/60 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-slate-800"
                        >
                            Best Washer Time
                        </button>
                    </div>

                    <form
                        onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                        className="flex gap-2 border-t border-slate-800 p-3"
                    >
                        <input
                            type="text"
                            placeholder="Ask about green windows, savings..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            className="flex-1 rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500/50 focus:outline-none"
                        />
                        <button
                            type="submit"
                            className="rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-3 text-emerald-300 hover:bg-emerald-500/25"
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
                    className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-4 py-3 text-sm font-semibold text-emerald-300 shadow-lg shadow-emerald-950/50 backdrop-blur-md hover:bg-emerald-500/25"
                >
                    <MessageCircle className="h-4 w-4" />
                    Ask EcoAssistant
                </button>
            )}
        </div>
    );
}

export default EcoChatWidget;
