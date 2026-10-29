import { useEffect, useState } from 'react';
import { api } from './api.js';

export default function AdminDashboard() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.adminUsers().then(setRows).catch((e) => setError(e.message));
  }, []);

  const totalCustomers = (rows || []).reduce((sum, u) => sum + u.customer_count, 0);

  return (
    <section className="card">
      <div className="card-head">
        <h2>Users</h2>
        {rows && <span className="muted">{rows.length} users · {totalCustomers} customers</span>}
      </div>
      {error && <div className="alert">{error}</div>}
      {!rows && !error && <p className="muted" style={{ padding: 24 }}>Loading…</p>}
      {rows && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>Customers</th><th>Joined</th></tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>{u.customer_count}</td>
                  <td>{new Date(u.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
