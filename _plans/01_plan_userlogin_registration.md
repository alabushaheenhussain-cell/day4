# Plan 01: User Registration, Login and Per-User Customers

Implements `_specs/01_spec_userlogin_registration.md` (approved). Resolved decisions: existing customer rows are deleted, foreign ids return 404, token kept in localStorage.

Precondition: the working tree is committed before step 1 starts.

## Backend (`backend/`)

1. **Dependencies**: add `bcryptjs` and `jsonwebtoken` to `package.json`. Add `JWT_SECRET` and `JWT_EXPIRES_IN=1d` to `.env.example`.
2. **Schema (`src/db.js`)**: in `initDb()`, create `app_user` (spec section 4). For `customer`: `DELETE FROM customer WHERE sales_user_id IS NULL` is not possible before the column exists, so run, idempotently: `ALTER TABLE customer ADD COLUMN IF NOT EXISTS sales_user_id INTEGER REFERENCES app_user(id)`; delete rows where it is NULL; then `ALTER COLUMN sales_user_id SET NOT NULL`.
3. **Users data layer (`src/users.js`)**: `createUser`, `findByEmail`, `findById` (never return `password_hash` except from `findByEmail`).
4. **Auth module (`src/auth.js`)**: `hashPassword`/`verifyPassword` (bcryptjs), `signToken`, and `requireAuth` middleware that verifies the Bearer token, loads `req.user = { id, role }`, and returns 401 otherwise. Fail with 500 if `JWT_SECRET` is unset.
5. **Customers data layer (`src/customers.js`)**: every function takes `userId` first; list, search, get, update and delete add `AND sales_user_id = $n`; create inserts it.
6. **Routes (`src/app.js`)**: add `POST /auth/register`, `POST /auth/login`, `GET /auth/me` (after the `initDb` middleware). Apply `requireAuth` to `/customers` and `/agent`. Pass `req.user.id` to all data calls and ignore `sales_user_id` in bodies. Normalise email to lower case; validate fields (400), duplicate email (409), generic 401 on bad login.
7. **Agent (`src/agent.js`)**: `runAgent(message, history, userId)`; `handlers` become closures over `userId` and call the scoped data functions. Mention the scoping in the system prompt.
8. **Swagger (`src/swagger.js`)**: `bearerAuth` security scheme, `Auth` tag, `/auth/*` paths, `User` and `AuthResponse` schemas, `sales_user_id` on `Customer`, `security` plus 401 responses on `/customers*` and `/agent`.

## Frontend (`frontend/src/`)

9. **`api.js`**: token get/set/clear in localStorage (wrapped in try/catch), `Authorization` header on requests, `register`, `login`, `me`; on 401 clear the token and notify the app.
10. **`Auth.jsx`** (new): login and register form. **`App.jsx`**: gate the existing UI on a session, restore the session via `me()` on load, show the user name and a logout button. Minor styles in `styles.css`.

## Docs

11. **README.md**: add `JWT_SECRET` to the backend variable table. **CLAUDE.md**: note the auth layer and that all data functions are owner-scoped.

## Verification

There is no test runner, so verify manually against a local Postgres with the backend running (`npm start`) and curl or Swagger UI:

- Acceptance criteria 1 to 7 from the spec using two registered users (including the agent asked for the other user's customers by name and id).
- `/swagger` shows the Authorize button and the flow works (criterion 8).
- Frontend: register, login, logout, reload keeps session, a forced 401 returns to login (criterion 9). `npm run build` in `frontend/` succeeds.

## Commits

One commit per area (backend, frontend, docs) on a feature branch, then merge or PR to `main`.
