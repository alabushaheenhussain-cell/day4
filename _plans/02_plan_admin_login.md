# Plan 02: Admin Login and Users Dashboard

Implements `_specs/02_spec_admin_login.md` (once approved). Open questions are assumed to resolve to the proposed defaults.

Precondition: the working tree is committed, and work happens on a feature branch (e.g. `feature/admin-login`).

## Backend (`backend/`)

1. **Seed admin (`src/db.js`, `src/users.js`)**: add `ADMIN_EMAIL` / `ADMIN_PASSWORD` to `.env.example` (defaults `admin@admin.com` / `123456789`). In `initDb()`, after `app_user` exists, insert the admin with `INSERT ... ON CONFLICT (email) DO NOTHING` and a bcrypt hash. Never update an existing row. Avoid a circular import between `db.js` and `auth.js` (hash in `users.js`).
2. **Users data layer (`src/users.js`)**: add `listUsersWithCustomerCounts()`: `SELECT u.id, u.name, u.email, u.role, u.created_at, COUNT(c.id)::int AS customer_count FROM app_user u LEFT JOIN customer c ON c.sales_user_id = u.id GROUP BY u.id ORDER BY u.created_at`. Make sure `findByEmail` returns `role`.
3. **Middleware (`src/auth.js`)**: add `requireAdmin` and `requireSales` (each runs after `requireAuth`, `403` with a clear message on role mismatch).
4. **Routes (`src/app.js`)**:
   - `POST /auth/admin/login`: find by email, verify password, require `role === 'admin'`, otherwise the same generic `401`; return `{ token, user }`.
   - `POST /auth/login`: also return the generic `401` for admin accounts.
   - `GET /admin/users` with `requireAuth, requireAdmin`.
   - Add `requireSales` to `/customers*` and `/agent`.
   - Confirm `/auth/register` ignores any `role` in the body.
5. **Swagger (`src/swagger.js`)**: `Admin` tag, the two new paths, `AdminUserSummary` schema, `403` responses on `/customers*` and `/agent`.

## Frontend (`frontend/src/`)

6. **`api.js`**: add `adminLogin(email, password)` and `adminUsers()`; reuse the existing token handling and 401 logout.
7. **`Auth.jsx`**: add an "Admin login" mode (toggle) that calls `adminLogin`; the register form is available only in sales mode.
8. **`AdminDashboard.jsx`** (new): fetch `adminUsers()`, show totals (users, customers) and a table (name, email, role, customers, joined), with loading and error states.
9. **`App.jsx`**: after the session is restored, render `AdminDashboard` when `user.role === 'admin'`, otherwise the existing `Customers` + `Chat`. Logout is shared. Small additions to `styles.css`.

## Docs

10. **README.md**: document `ADMIN_EMAIL` / `ADMIN_PASSWORD`, the default admin, and that production should override the default password. **CLAUDE.md**: note the admin role, `requireAdmin` / `requireSales`, and the seeding in `initDb()`.

## Verification

No test runner, so verify manually against a local Postgres (`npm start` in `backend/`, `npm run dev` in `frontend/`):

- Spec criteria 1 to 7 with curl or Swagger: fresh DB seeds the admin; admin login works; cross-login attempts give `401`; `/admin/users` counts match `/customers` for two sales users (one with 0 customers); sales token gets `403`; admin token on `/customers` and `/agent` gets `403`; registering with `role: "admin"` yields `sales`.
- Restart the backend and confirm the admin row is not duplicated or reset.
- Frontend (criterion 8): admin sees the dashboard, sales sees the existing UI, reload keeps each session. `npm run build` in `frontend/` succeeds.

## Commits

One commit per area (backend, frontend, docs) on the feature branch, then merge or PR to `main`.
