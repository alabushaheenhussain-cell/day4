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

export const api = {
  register: (u) => request('/auth/register', { method: 'POST', body: JSON.stringify(u) }),
  login: (u) => request('/auth/login', { method: 'POST', body: JSON.stringify(u) }),
  adminLogin: (u) => request('/auth/admin/login', { method: 'POST', body: JSON.stringify(u) }),
  me: () => request('/auth/me'),
  adminUsers: () => request('/admin/users'),
  list: () => request('/customers'),
  create: (c) => request('/customers', { method: 'POST', body: JSON.stringify(c) }),
  update: (id, c) => request(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(c) }),
  remove: (id) => request(`/customers/${id}`, { method: 'DELETE' }),
  chat: (message, history) => request('/agent', { method: 'POST', body: JSON.stringify({ message, history }) }),
};
