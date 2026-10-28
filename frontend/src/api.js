const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  list: () => request('/customers'),
  create: (c) => request('/customers', { method: 'POST', body: JSON.stringify(c) }),
  update: (id, c) => request(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(c) }),
  remove: (id) => request(`/customers/${id}`, { method: 'DELETE' }),
  chat: (message, history) => request('/agent', { method: 'POST', body: JSON.stringify({ message, history }) }),
};
