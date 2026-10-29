# Spec 02: Admin Login and Users Dashboard

Status: Draft, awaiting approval. After approval, the implementation plan is `_plans/02_plan_admin_login.md`.

Note: this replaces the earlier draft `02_spec_admin_role.md` (an admin with full CRUD), which has been deleted.

## 1. Background

Spec 01 made every application user a `sales` user who can only see their own customers. There is no way to see who uses the application or how many customers each user has entered. This feature adds an `admin` user with a separate login and a dashboard of all users and their customer counts.

## 2. Goals

- A new role `admin`, distinct from `sales`.
- A separate admin login (own endpoint and own screen). Sales users cannot use the admin login, and admins do not use the sales login.
- A default admin account exists out of the box: email `admin@admin.com`, password `123456789`.
- After login the admin sees a dashboard listing every user of the application and the number of customers associated with each user.
- Sales users are unaffected.

## 3. Non-goals

- Admin management of users or customers (create, edit, delete, reassign, role changes). The dashboard is read-only.
- Admin viewing individual customer records or using the AI agent.
- Registering an admin through the API, password reset, audit logging.

## 4. Data model

No new tables. `app_user.role` already exists (default `sales`); `admin` becomes a second valid value.

Default admin seeding, done idempotently in `initDb()`:
- If no user with the admin email exists, insert one with role `admin`, name `Admin`, and a bcrypt hash of the default password.
- Email and password come from optional env vars `ADMIN_EMAIL` (default `admin@admin.com`) and `ADMIN_PASSWORD` (default `123456789`). The seed never overwrites an existing account, so a changed password stays changed.
- `POST /auth/register` still always creates `sales`; registering the admin email returns `409` like any existing email.

## 5. Authentication and authorization

- Admin login returns the same kind of JWT as spec 01 (same `JWT_SECRET`). The role is read from the database on each request.
- `requireAdmin` middleware runs after `requireAuth` and returns `403` if `req.user.role !== 'admin'`.
- `POST /auth/login` (sales) rejects admin accounts, and `POST /auth/admin/login` rejects sales accounts, both with the same generic `401 Invalid email or password`, so the responses do not reveal which kind of account exists.
- `/customers*` and `/agent` become sales-only (`requireSales`, `403` for admins): an admin owns no customers and must not reach the per-user data paths.

## 6. API

| Endpoint | Auth | Description |
|---|---|---|
| `POST /auth/admin/login` | public | Body `{ email, password }`. `200` with `{ token, user }` for an admin; generic `401` otherwise. |
| `GET /auth/me` | any valid token | Unchanged; includes `role`, so the frontend knows which UI to show. |
| `GET /admin/users` | admin | Lists every user with `id`, `name`, `email`, `role`, `created_at` and `customer_count` (0 if none), sorted by `created_at`. No password hashes. Admin accounts are included, distinguishable by `role`. |

Errors: `401` without or with an invalid token, `403` for a sales token on `/admin/*`.

The counts come from a single SQL query (`LEFT JOIN customer ... GROUP BY`), not one query per user.

## 7. Frontend

- The login screen gets an **Admin login** switch that posts to `/auth/admin/login`. The sales login and register form stay as they are.
- After an admin logs in, `App.jsx` shows an **Admin dashboard** instead of Customers and Chat: totals (users, customers) and a table of users (name, email, role, customers, joined). Logout and session restore via `/auth/me` work as for sales users.
- Sales users never see the dashboard.

## 8. Swagger

Add `POST /auth/admin/login` and `GET /admin/users` (tag `Admin`, `bearerAuth`, `401`/`403` responses), an `AdminUserSummary` schema with `customer_count`, add `403` to `/customers*` and `/agent`, and note the two roles.

## 9. Acceptance criteria

1. On a fresh database the admin account is created automatically with role `admin`; later requests and restarts do not duplicate or reset it.
2. `POST /auth/admin/login` with `admin@admin.com` / `123456789` returns a token; a wrong password returns `401`.
3. A sales user cannot log in through `/auth/admin/login`, and the admin cannot log in through `/auth/login` (both `401`).
4. `GET /admin/users` as admin lists all users with correct `customer_count`, checked against two sales users with different counts and one with none.
5. `GET /admin/users` with a sales token returns `403`; with no token `401`.
6. An admin token on `/customers*` or `/agent` returns `403`; sales behaviour from spec 01 is unchanged.
7. Registration cannot produce an admin, even with `role: "admin"` in the body.
8. Frontend: admin login shows the dashboard with correct numbers; sales login shows the usual UI; reload keeps the session; Swagger can exercise the new endpoints.

## 10. Open questions

1. **Default credentials in production**: `admin@admin.com` / `123456789` is easy to guess once deployed. Proposed: use them as the default as requested, allow overriding via `ADMIN_EMAIL` / `ADMIN_PASSWORD`, and document in the README that production should override them.
2. **Admin accounts in the dashboard list**: show them (proposed) or only sales users?
3. **Old draft** `02_spec_admin_role.md`: delete it (proposed) or keep it as a future spec 03?
