# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Customer manager: two independent npm projects in one repo (no root `package.json`). Each deploys as its own Vercel project (Root Directory `backend` / `frontend`). There is no test runner or linter configured.

## Commands

```bash
# Backend (Express, port 4000) — copy .env.example to .env first
cd backend && npm install && npm start      # npm run dev = node --watch
# Frontend (React + Vite, port 5173)
cd frontend && npm install && npm run dev   # npm run build / npm run preview
```

Backend env: `DATABASE_URL` (required), `JWT_SECRET` (required), `ANTHROPIC_API_KEY` (needed for `/agent`), `ANTHROPIC_MODEL` (default `claude-sonnet-5-5`), `CORS_ORIGIN` (comma-separated, default `*`). Frontend env: `VITE_API_URL` (baked in at build time; defaults to `http://localhost:4000`).

Useful URLs: `/swagger`, `/swagger.json`, `/health`, `/customers`.

## Backend architecture (`backend/`, ESM)

- `src/app.js` exports the Express app and defines all routes; `src/server.js` listens locally, while `api/index.js` re-exports the same app as the Vercel serverless handler (`vercel.json` rewrites every path to `/api`). Don't add startup logic in `server.js` only — it won't run on Vercel.
- The `customer` table is created lazily by a middleware in `app.js` calling `initDb()` (serverless has no startup hook). `/swagger`, `/swagger.json` and `/health` are registered before it so they work without a DB.
- Swagger UI is served as inline HTML loading assets from a CDN (not `swagger-ui-express`) because those assets don't bundle on Vercel. The OpenAPI spec is hand-written in `src/swagger.js`; update it when routes change.
- Auth: `src/auth.js` (bcryptjs + JWT, `requireAuth` middleware setting `req.user`) and `src/users.js` (`app_user` table, role defaults to `sales`). `/customers*` and `/agent` require a Bearer token; `/auth/*`, `/health`, `/swagger*` are public.
- Admin: `initDb()` seeds one `admin` user (`ADMIN_EMAIL`/`ADMIN_PASSWORD`, defaults `admin@admin.com`/`123456789`) with `ON CONFLICT DO NOTHING`. Admins log in via `POST /auth/admin/login` and sales via `/auth/login`; each rejects the other role with the same generic 401 (shared `loginAs(role)` in `app.js`). `GET /admin/users` (`requireAdmin`) returns users with `customer_count`. `/customers*` and `/agent` use `requireSales`, so admins get 403. The admin dashboard is read-only.
- Per-user access: every function in `src/customers.js` takes the owner `userId` first and filters on `customer.sales_user_id` in SQL. Another user's customer behaves exactly like a nonexistent one (404). Never take the user id from a request body or from agent tool input. `initDb()` deletes legacy customers without an owner.
- `src/customers.js` holds all SQL (parameterized, `pg`). `updateCustomer` uses `COALESCE`, so fields cannot be cleared to NULL. `db.js` uses a small pool (`max: 3`) and `ssl: { rejectUnauthorized: false }` (Render-hosted Postgres).
- Export: `GET /customers/export` (sales only, optional `?q=` matching name/email/phone/address like the UI search) builds an `.xlsx` in memory with `exceljs` in `src/export.js`. It must stay registered before `/customers/:id`. Customer values are written as plain strings, never formulas (spreadsheet formula injection). CORS exposes `Content-Disposition` so the frontend can read the filename; the frontend fetches it as a blob because a link can't send the Bearer token.
- Deals: the `deal` table (created in `initDb()` after `customer`, `customer_id` is `ON DELETE CASCADE`, so deleting a customer deletes its deals) and `src/deals.js` follow the same owner-scoping rules as `customers.js` (`userId` first, filtered on `deal.sales_user_id`; `createDeal` checks customer ownership in the same INSERT). Routes: `/customers/:id/deals` (GET, POST) and `/deals`, `/deals/:id` (sales only; `/deals` is in the `requireSales` guard list in `app.js`). `validateDeal` is shared by the routes and the agent. SQL returns `amount` as a number and `expected_close_date` as `YYYY-MM-DD` (not pg's string/`Date`); `PUT` can clear the date with `null`. Stages: lead, qualified, proposal, won, lost.
- `src/agent.js` backs `POST /agent`: a manual tool-use loop (max 8 iterations) over Anthropic's Messages API. The ten tools (six customer, four deal) map to the same `customers.js` / `deals.js` functions via `makeHandlers(userId)`, which binds each call to the logged-in user, so adding a customer or deal operation means updating both `tools` and `makeHandlers`. The client sends `history` (prior messages) with each request; the server is stateless.

## Frontend architecture (`frontend/src/`)

Plain React 18 with no router or state library. `App.jsx` shows `Auth.jsx` (login/register) until a user session exists (JWT in localStorage, restored via `/auth/me`; a 401 from any call logs out), then composes `Customers.jsx` (CRUD UI; each customer row expands to `Deals.jsx`, that customer's deals) and `Chat.jsx` (talks to `/agent`). All HTTP goes through the `api` object in `api.js`, which surfaces the backend's `{ error }` body as thrown `Error` messages.

## Development workflow (spec-driven)

This project follows spec-driven development:

- Specs are stored in the `_specs/` folder.
- Once a spec is approved, the implementation plan is created and stored in the `_plans/` folder.
- Before starting implementation, make sure the current branch is committed (no uncommitted changes).
