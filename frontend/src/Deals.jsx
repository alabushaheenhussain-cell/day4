import { useEffect, useState } from 'react';
import { api } from './api.js';

const STAGES = ['lead', 'qualified', 'proposal', 'won', 'lost'];
const label = (s) => s[0].toUpperCase() + s.slice(1);
const rupees = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
const empty = { title: '', amount: '', stage: 'lead', expected_close_date: '' };

export default function Deals({ customer }) {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null); // null = closed; object = open (with id when editing)
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setError('');
    try { setDeals(await api.listDeals(customer.id)); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [customer.id]);

  const open = deals.filter((d) => d.stage !== 'won' && d.stage !== 'lost');
  const openTotal = open.reduce((sum, d) => sum + d.amount, 0);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body = {
        title: form.title,
        amount: form.amount === '' ? 0 : Number(form.amount),
        stage: form.stage,
        expected_close_date: form.expected_close_date || null,
      };
      form.id ? await api.updateDeal(form.id, body) : await api.createDeal(customer.id, body);
      setForm(null);
      await load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const changeStage = async (d, stage) => {
    setError('');
    try { await api.updateDeal(d.id, { stage }); await load(); }
    catch (e) { setError(e.message); }
  };

  const remove = async (d) => {
    if (!window.confirm(`Delete deal "${d.title}"?`)) return;
    setError('');
    try { await api.deleteDeal(d.id); await load(); }
    catch (e) { setError(e.message); }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div>
      <div className="deals-head">
        <p className="muted">
          {deals.length} {deals.length === 1 ? 'deal' : 'deals'} · {rupees(openTotal)} open
        </p>
        <button className="btn small primary" onClick={() => setForm({ ...empty })}>+ Add deal</button>
      </div>

      {error && <div className="alert">{error}</div>}

      <table>
        <thead>
          <tr><th>Title</th><th>Amount</th><th>Stage</th><th>Expected close</th><th /></tr>
        </thead>
        <tbody>
          {loading && <tr><td colSpan="5" className="empty">Loading…</td></tr>}
          {!loading && deals.length === 0 && <tr><td colSpan="5" className="empty">No deals yet.</td></tr>}
          {deals.map((d) => (
            <tr key={d.id} className={`deal-${d.stage}`}>
              <td className="strong">{d.title}</td>
              <td>{rupees(d.amount)}</td>
              <td>
                <select className="stage-select" value={d.stage} onChange={(e) => changeStage(d, e.target.value)}>
                  {STAGES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
                </select>
              </td>
              <td>{d.expected_close_date || '—'}</td>
              <td className="row-actions">
                <button className="btn small" onClick={() => setForm({ ...d, amount: String(d.amount), expected_close_date: d.expected_close_date ?? '' })}>Edit</button>
                <button className="btn small danger" onClick={() => remove(d)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {form && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setForm(null)}>
          <form className="modal" onSubmit={save}>
            <h3>{form.id ? 'Edit deal' : `Add deal for ${customer.name}`}</h3>
            <label>Title *<input required maxLength="200" value={form.title} onChange={set('title')} autoFocus /></label>
            <label>Amount (₹)<input type="number" min="0" step="0.01" value={form.amount} onChange={set('amount')} /></label>
            <label>Stage
              <select value={form.stage} onChange={set('stage')}>
                {STAGES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
              </select>
            </label>
            <label>Expected close date<input type="date" value={form.expected_close_date} onChange={set('expected_close_date')} /></label>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setForm(null)}>Cancel</button>
              <button className="btn primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
