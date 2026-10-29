const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const TOKEN_KEY = 'token';

// localStorage can throw (private mode, blocked site data); the session just won't persist then
export const getToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
export const setToken = (t) => {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
};

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
  const data = await res.json().catch(() => ({}));
  // A 401 on login/register is just bad credentials, not an expired session
  if (res.status === 401 && !path.endsWith('/login')) { setToken(null); onUnauthorized(); }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// Fetches the Excel export with the token (a plain link can't send the Authorization header)
async function exportCustomers(q) {
  const token = getToken();
  const res = await fetch(`${BASE}/customers/export${q ? `?q=${encodeURIComponent(q)}` : ''}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    if (res.status === 401) { setToken(null); onUnauthorized(); }
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  const match = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '');
  return { blob: await res.blob(), filename: match ? match[1] : 'customers.xlsx' };
}

export const api = {
  exportCustomers,
  register: (u) => request('/auth/register', { method: 'POST', body: JSON.stringify(u) }),
  login: (u) => request('/auth/login', { method: 'POST', body: JSON.stringify(u) }),
  adminLogin: (u) => request('/auth/admin/login', { method: 'POST', body: JSON.stringify(u) }),
  me: () => request('/auth/me'),
  adminUsers: () => request('/admin/users'),
  list: () => request('/customers'),
  create: (c) => request('/customers', { method: 'POST', body: JSON.stringify(c) }),
  update: (id, c) => request(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(c) }),
  remove: (id) => request(`/customers/${id}`, { method: 'DELETE' }),
  listDeals: (customerId) => request(`/customers/${customerId}/deals`),
  createDeal: (customerId, d) => request(`/customers/${customerId}/deals`, { method: 'POST', body: JSON.stringify(d) }),
  updateDeal: (id, d) => request(`/deals/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteDeal: (id) => request(`/deals/${id}`, { method: 'DELETE' }), // 204, empty body
  chat: (message, history) => request('/agent', { method: 'POST', body: JSON.stringify({ message, history }) }),
};
