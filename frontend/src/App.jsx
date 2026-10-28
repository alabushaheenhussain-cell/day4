import { useState } from 'react';
import Customers from './Customers.jsx';
import Chat from './Chat.jsx';

export default function App() {
  const [tab, setTab] = useState('customers');
  // Bumped after the chat agent runs so the customer table refreshes
  const [version, setVersion] = useState(0);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">C</span>
          <h1>Customer Manager</h1>
        </div>
        <nav className="tabs">
          <button className={tab === 'customers' ? 'active' : ''} onClick={() => setTab('customers')}>
            Customers
          </button>
          <button className={tab === 'chat' ? 'active' : ''} onClick={() => setTab('chat')}>
            AI Assistant
          </button>
        </nav>
      </header>
      <main className="content">
        {tab === 'customers' ? (
          <Customers key={version} />
        ) : (
          <Chat onDataChanged={() => setVersion((v) => v + 1)} />
        )}
      </main>
    </div>
  );
}
