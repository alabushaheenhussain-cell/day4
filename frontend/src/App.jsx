import { useEffect, useState } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler } from './api.js';
import Auth from './Auth.jsx';
import Customers from './Customers.jsx';
import Chat from './Chat.jsx';
import AdminDashboard from './AdminDashboard.jsx';

export default function App() {
  const [tab, setTab] = useState('customers');
  // Bumped after the chat agent runs so the customer table refreshes
  const [version, setVersion] = useState(0);
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(!!getToken()); // restoring a saved session

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    if (getToken()) {
      api.me().then(setUser).catch(() => setToken(null)).finally(() => setChecking(false));
    }
  }, []);

  const logout = () => { setToken(null); setUser(null); setTab('customers'); };

  if (checking) return null;
  if (!user) return <Auth onLogin={setUser} />;

  const isAdmin = user.role === 'admin';

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">C</span>
          <h1>{isAdmin ? 'Admin Dashboard' : 'Customer Manager'}</h1>
        </div>
        {!isAdmin && <nav className="tabs">
          <button className={tab === 'customers' ? 'active' : ''} onClick={() => setTab('customers')}>
            Customers
          </button>
          <button className={tab === 'chat' ? 'active' : ''} onClick={() => setTab('chat')}>
            AI Assistant
          </button>
        </nav>}
        <div className="userbox">
          <span className="muted">{user.name}</span>
          <button className="btn small" onClick={logout}>Log out</button>
        </div>
      </header>
      <main className="content">
        {isAdmin ? (
          <AdminDashboard />
        ) : tab === 'customers' ? (
          <Customers key={version} />
        ) : (
          <Chat onDataChanged={() => setVersion((v) => v + 1)} />
        )}
      </main>
    </div>
  );
}
