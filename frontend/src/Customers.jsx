import { useEffect, useMemo, useState } from 'react';
import { api } from './api.js';

const empty = { name: '', email: '', phone: '', address: '' };

export default function Customers() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [form, setForm] = useState(null); // null = closed; object = open (with id when editing)
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try { setRows(await api.list()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? rows.filter((r) => [r.name, r.email, r.phone, r.address].some((v) => v?.toLowerCase().includes(q)))
      : rows;
  }, [rows, query]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const { id, created_at, ...body } = form;
      id ? await api.update(id, body) : await api.create(body);
      setForm(null);
      await load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  // Exports what the table shows: the server applies the same search to name, email, phone and address
  const exportXlsx = async () => {
    setExporting(true);
    setError('');
    try {
      const { blob, filename } = await api.exportCustomers(query.trim());
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setError(e.message); }
    finally { setExporting(false); }
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete ${c.name}?`)) return;
    try { await api.remove(c.id); await load(); }
    catch (e) { setError(e.message); }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>Customers</h2>
          <p className="muted">{rows.length} total</p>
        </div>
        <div className="actions">
          <input
            className="search" placeholder="Search customers…"
            value={query} onChange={(e) => setQuery(e.target.value)}
          />
          <button className="btn" onClick={exportXlsx} disabled={exporting || filtered.length === 0}>
            {exporting ? 'Exporting…' : 'Export to Excel'}
          </button>
          <button className="btn primary" onClick={() => setForm({ ...empty })}>+ Add customer</button>
        </div>
      </div>

      {error && <div className="alert">{error}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>ID</th><th>Name</th><th>Email</th><th>Phone</th><th>Address</th><th /></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan="6" className="empty">Loading…</td></tr>}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan="6" className="empty">No customers found.</td></tr>
            )}
            {filtered.map((c) => (
              <tr key={c.id}>
                <td className="muted">#{c.id}</td>
                <td className="strong">{c.name}</td>
                <td>{c.email || '—'}</td>
                <td>{c.phone || '—'}</td>
                <td>{c.address || '—'}</td>
                <td className="row-actions">
                  <button className="btn small" onClick={() => setForm({ ...c, email: c.email ?? '', phone: c.phone ?? '', address: c.address ?? '' })}>Edit</button>
                  <button className="btn small danger" onClick={() => remove(c)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setForm(null)}>
          <form className="modal" onSubmit={save}>
            <h3>{form.id ? 'Edit customer' : 'Add customer'}</h3>
            <label>Name *<input required value={form.name} onChange={set('name')} autoFocus /></label>
            <label>Email<input type="email" value={form.email} onChange={set('email')} /></label>
            <label>Phone<input value={form.phone} onChange={set('phone')} /></label>
            <label>Address<textarea rows="2" value={form.address} onChange={set('address')} /></label>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setForm(null)}>Cancel</button>
              <button className="btn primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
