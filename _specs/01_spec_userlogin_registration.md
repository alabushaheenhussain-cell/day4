# Spec 01: User Registration, Login and Per-User Customers

Status: Approved as written (open questions resolved to the proposed defaults: 1a delete existing rows, 2 return 404, 3 localStorage). Plan: `_plans/01_plan_userlogin_registration.md`.

## 1. Background

The initial project had no authentication: every client could read and modify every customer, and the AI agent (`POST /agent`) operated on the whole `customer` table. This feature adds user registration and login, and scopes all customer data to the logged-in user.

## 2. Goals

- A visitor can register a new user account and log in.
- Every user has a role; new users get the role `sales` by default.
- Each customer belongs to exactly one sales user.
- A logged-in user can only see and manage their own customers (CRUD behaves as today, restricted to that user).
- The AI agent only reads and modifies the logged-in user's customers.
- Access to a customer owned by someone else is denied.
- Swagger documents the new auth endpoints and per-user behaviour, and can be used to test them (including an "Authorize" button for the token).

## 3. Non-goals

- Admin or manager roles and their permissions (only the `role` column is introduced; `sales` is the only value used).
- Password reset, email verification, refresh tokens, social login.
- Reassigning or sharing customers between users.

## 4. Data model

### New table `app_user`

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | |
| `name` | VARCHAR(150) NOT NULL | |
| `email` | VARCHAR(150) NOT NULL UNIQUE | stored lower-cased, used as login |
| `password_hash` | TEXT NOT NULL | bcrypt hash, never returned by the API |
| `role` | VARCHAR(30) NOT NULL DEFAULT `'sales'` | |
| `created_at` | TIMESTAMPTZ NOT NULL DEFAULT now() | |

### Changed table `customer`

- Add `sales_user_id INTEGER NOT NULL REFERENCES app_user(id)`.
- Applied idempotently in `initDb()` (the project has no migration tool; the table is created lazily).
- Existing rows have no owner. Open question 1 covers how to handle them.

## 5. Authentication

- Passwords are hashed with bcrypt (a new dependency, e.g. `bcryptjs`, to avoid native builds on Vercel).
- Login returns a signed JWT (a new dependency, `jsonwebtoken`), sent as `Authorization: Bearer <token>`. Stateless tokens fit the serverless deployment.
- New env vars: `JWT_SECRET` (required) and `JWT_EXPIRES_IN` (optional, default `1d`). Add both to `backend/.env.example` and the README deploy table.
- An auth middleware verifies the token and sets `req.user = { id, role }`. It is applied to `/customers/*` and `/agent`. `/health`, `/swagger`, `/swagger.json`, `/auth/*` stay public.

## 6. API

### New endpoints

| Method and path | Auth | Description |
|---|---|---|
| `POST /auth/register` | public | Body `{ name, email, password }`. Creates a user with role `sales`. Returns `201` with the user (no hash). `400` if a field is missing, the email is malformed or the password is under 8 characters. `409` if the email already exists. A client cannot choose the role. |
| `POST /auth/login` | public | Body `{ email, password }`. Returns `200` with `{ token, user }`. `401` with a generic "Invalid email or password" for unknown email or wrong password. |
| `GET /auth/me` | required | Returns the current user. |

### Changed endpoints (all require a valid token)

| Endpoint | New behaviour |
|---|---|
| `GET /customers` | Returns only the caller's customers. `?name=` search is also restricted to them. |
| `POST /customers` | Creates the customer with `sales_user_id` set to the caller. Any `sales_user_id` in the body is ignored. |
| `GET /customers/:id` | `200` if owned by the caller. |
| `PUT /customers/:id` | Updates only if owned by the caller. |
| `DELETE /customers/:id` | Deletes only if owned by the caller. |
| `POST /agent` | Agent tools operate only on the caller's customers (section 7). |

Error semantics:
- Missing, invalid or expired token: `401`.
- Customer id that exists but belongs to another user: `404 Customer not found` (same response as a nonexistent id, so ids of other users' customers are not revealed). Open question 2 asks whether `403` is preferred.
- Response shape of a customer is unchanged, plus `sales_user_id`.

## 7. AI agent

- `runAgent` receives the authenticated user id from the route, never from the request body or from model-supplied tool input.
- Every tool handler passes the user id into the `customers.js` data functions, so scoping is enforced in SQL (`WHERE sales_user_id = $n`), not by the prompt.
- `customers.js` functions all take the owner id: list, search, get, update and delete add `AND sales_user_id = $n`; create inserts it. This also protects the REST routes.
- The `history` sent by the client is still untrusted; tool results are always freshly queried with the scoped functions.
- The system prompt may mention that the assistant only has access to the logged-in user's customers, but it is not the control.

## 8. Frontend

- New Register and Login screens; on success store the token (localStorage) and show the existing customers and chat UI.
- `api.js` attaches the `Authorization` header to every request; on a `401` it clears the token and returns to the login screen.
- A logout action clears the token. The header shows the logged-in user's name.
- Customer UI and chat otherwise unchanged.

## 9. Swagger

`src/swagger.js` is updated to:
- Add a `bearerAuth` security scheme (HTTP bearer, JWT) so the Swagger UI "Authorize" button works. The Swagger HTML in `app.js` already supports this.
- Document `/auth/register`, `/auth/login`, `/auth/me` with request and response schemas and the `400`/`401`/`409` responses.
- Mark `/customers*` and `/agent` as requiring `bearerAuth`, add `401` and `404` responses, and state that results are limited to the caller's customers.
- Add `sales_user_id` to the Customer schema, and define `User` and `AuthResponse` schemas.

Testing through Swagger: register, login, copy the token into Authorize, then call the customer endpoints. Registering a second user and confirming it cannot see or change the first user's customers is the main manual check.

## 10. Acceptance criteria

1. Registering with valid data creates a user with role `sales`; the response has no password or hash.
2. Duplicate email returns `409`; weak or missing fields return `400`.
3. Login with correct credentials returns a token; wrong credentials return `401`.
4. Calling `/customers` or `/agent` without a token, or with a bad token, returns `401`.
5. User A creating a customer stores it with A's id; user B's `GET /customers` does not include it.
6. User B calling GET, PUT or DELETE on A's customer id gets `404` and the customer is unchanged.
7. The agent, asked to list, find, update or delete customers, only touches the caller's customers, including when asked for another user's customer by id or name.
8. Swagger UI shows the auth endpoints and an Authorize button, and the flow in section 9 works end to end.
9. Frontend: register, login, logout, and a persisted session after reload all work; a `401` returns to login.

## 11. Open questions

1. **Existing customers**: rows created before this feature have no owner. Options: (a) delete them / start fresh (simplest, this appears to be a lab project), (b) make `sales_user_id` nullable and hide unowned rows, (c) assign them to the first registered user. Proposed default: (a).
2. **Foreign-id response**: `404` (proposed, avoids leaking existence) or `403`?
3. **Token storage in the browser**: localStorage (proposed, simple) vs httpOnly cookie (needs cross-origin cookie and CSRF handling between the two Vercel projects).
