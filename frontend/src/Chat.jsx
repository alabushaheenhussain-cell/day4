import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';

const suggestions = ['Show all customers', 'Find customer named John', 'Add customer Jane Doe, jane@example.com'];
const MUTATING = ['add_customer', 'update_customer', 'delete_customer'];

export default function Chat({ onDataChanged }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hi! Ask me about your customers — I can list, find, add, update or delete them.' },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const history = useRef([]); // plain-text turns sent back to the server for context
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);

  const send = async (text) => {
    text = text.trim();
    if (!text || busy) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text }]);
    setBusy(true);
    try {
      const { reply, toolCalls } = await api.chat(text, history.current);
      history.current = [
        ...history.current,
        { role: 'user', content: text },
        { role: 'assistant', content: reply || '(no reply)' },
      ];
      setMessages((m) => [...m, { role: 'assistant', text: reply, tools: toolCalls }]);
      if (toolCalls?.some((t) => MUTATING.includes(t.name))) onDataChanged?.();
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', text: e.message, error: true }]);
    } finally { setBusy(false); }
  };

  return (
    <section className="card chat">
      <div className="card-head">
        <div>
          <h2>AI Assistant</h2>
          <p className="muted">Manage customers using natural language</p>
        </div>
      </div>

      <div className="messages">
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}${m.error ? ' error' : ''}`}>
            <div className="bubble">{m.text}</div>
            {m.tools?.length > 0 && (
              <div className="chips">
                {m.tools.map((t, j) => <span key={j} className="chip">⚙ {t.name}</span>)}
              </div>
            )}
          </div>
        ))}
        {busy && <div className="msg assistant"><div className="bubble typing">Thinking…</div></div>}
        <div ref={endRef} />
      </div>

      <div className="suggestions">
        {suggestions.map((s) => <button key={s} className="chip action" onClick={() => send(s)}>{s}</button>)}
      </div>

      <form className="composer" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <input
          value={input} onChange={(e) => setInput(e.target.value)}
          placeholder="Ask something like “get customer named Alice”…"
        />
        <button className="btn primary" disabled={busy || !input.trim()}>Send</button>
      </form>
    </section>
  );
}
