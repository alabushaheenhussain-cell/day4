import { useState } from 'react';
import { api, setToken } from './api.js';

export default function Auth({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const registering = mode === 'register';
  const admin = mode === 'admin';

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (registering) await api.register(form);
      const { token, user } = await (admin ? api.adminLogin : api.login)({ email: form.email, password: form.password });
      setToken(token);
      onLogin(user);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="auth">
      <form className="card auth-card" onSubmit={submit}>
        <div className="brand">
          <span className="logo">C</span>
          <h1>Customer Manager</h1>
        </div>
        <p className="muted">{registering ? 'Create a sales account' : admin ? 'Admin login' : 'Log in to see your customers'}</p>
        {error && <div className="alert">{error}</div>}
        {registering && (
          <input placeholder="Name" value={form.name} onChange={set('name')} required autoFocus />
        )}
        <input type="email" placeholder="Email" value={form.email} onChange={set('email')} required />
        <input
          type="password" placeholder={registering ? 'Password (min 8 characters)' : 'Password'}
          value={form.password} onChange={set('password')} minLength={registering ? 8 : undefined} required
        />
        <button className="btn primary" disabled={busy}>{registering ? 'Register' : 'Log in'}</button>
        {!admin && (
          <button
            type="button" className="link"
            onClick={() => { setMode(registering ? 'login' : 'register'); setError(''); }}
          >
            {registering ? 'Already have an account? Log in' : 'No account? Register'}
          </button>
        )}
        {!registering && (
          <button
            type="button" className="link"
            onClick={() => { setMode(admin ? 'login' : 'admin'); setError(''); }}
          >
            {admin ? 'Sales login' : 'Admin login'}
          </button>
        )}
      </form>
    </div>
  );
}
