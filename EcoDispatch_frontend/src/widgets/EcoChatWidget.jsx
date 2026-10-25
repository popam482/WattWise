import { useState } from 'react';

function EcoChatWidget({ userId, userName, userType, ecoAnalytics, userAppliances, scheduledTasks }) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { sender: 'ai', text: `Hi ${userName || 'there'}! I'm your EcoAssistant. How can I help you optimize your clean energy consumption today?` }
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

        const context = {
            user_info: `${userName} (${userType})`,
            saved_co2_kg: ecoAnalytics?.totalSavedCo2Kg || 20.8,
            saved_money_ron: ecoAnalytics?.totalSavedMoneyRon || 185.0,
            appliances: userAppliances.map(a => `${a.name} (${a.powerConsumptionKw}kW)`).join(', '),
            appliances_raw: userAppliances,
            scheduled_tasks: scheduledTasks.map(t => `${t.applianceName} at ${t.startTime}`).join(', ')
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
        <div className="eco-chat-container">
            {!isOpen ? (
                <button onClick={() => setIsOpen(true)}>
                    <span>Ask EcoAssistant</span>
                </button>
            ) : (
                <div>
                    <div>
                        <strong>EcoAssistant AI</strong>
                        <button onClick={() => setIsOpen(false)}>Close</button>
                    </div>

                    <div>
                        {messages.map((m, idx) => (
                            <div key={idx}>
                                {m.text}

                                {m.action && (
                                    <button
                                        onClick={() => alert(`Confirmed: ${m.action.label}`)}
                                    >
                                        {m.action.label}
                                    </button>
                                )}
                            </div>
                        ))}
                        {loading && <div>EcoAssistant is thinking...</div>}
                    </div>

                    <div>
                        <button onClick={() => handleSend("How much CO2 did I save?")}>My Savings</button>
                        <button onClick={() => handleSend("When to run Washing Machine?")}>Best Washer Time</button>
                    </div>

                    <form onSubmit={(e) => { e.preventDefault(); handleSend(); }}>
                        <input
                            type="text"
                            placeholder="Ask about green windows, savings..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                        />
                        <button type="submit">Send</button>
                    </form>
                </div>
            )}
        </div>
    );
}

export default EcoChatWidget;