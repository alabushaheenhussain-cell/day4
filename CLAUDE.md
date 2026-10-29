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

Backend env: `DATABASE_URL` (required), `ANTHROPIC_API_KEY` (needed for `/agent`), `ANTHROPIC_MODEL` (default `claude-sonnet-5-5`), `CORS_ORIGIN` (comma-separated, default `*`). Frontend env: `VITE_API_URL` (baked in at build time; defaults to `http://localhost:4000`).

Useful URLs: `/swagger`, `/swagger.json`, `/health`, `/customers`.

## Backend architecture (`backend/`, ESM)

- `src/app.js` exports the Express app and defines all routes; `src/server.js` listens locally, while `api/index.js` re-exports the same app as the Vercel serverless handler (`vercel.json` rewrites every path to `/api`). Don't add startup logic in `server.js` only — it won't run on Vercel.
- The `customer` table is created lazily by a middleware in `app.js` calling `initDb()` (serverless has no startup hook). `/swagger`, `/swagger.json` and `/health` are registered before it so they work without a DB.
- Swagger UI is served as inline HTML loading assets from a CDN (not `swagger-ui-express`) because those assets don't bundle on Vercel. The OpenAPI spec is hand-written in `src/swagger.js`; update it when routes change.
- `src/customers.js` holds all SQL (parameterized, `pg`). `updateCustomer` uses `COALESCE`, so fields cannot be cleared to NULL. `db.js` uses a small pool (`max: 3`) and `ssl: { rejectUnauthorized: false }` (Render-hosted Postgres).
- `src/agent.js` backs `POST /agent`: a manual tool-use loop (max 8 iterations) over Anthropic's Messages API. The six tools map to the same `customers.js` functions via the `handlers` table, so adding a customer operation means updating both `tools` and `handlers`. The client sends `history` (prior messages) with each request; the server is stateless.

## Frontend architecture (`frontend/src/`)

Plain React 18 with no router or state library. `App.jsx` composes `Customers.jsx` (CRUD UI) and `Chat.jsx` (talks to `/agent`). All HTTP goes through the `api` object in `api.js`, which surfaces the backend's `{ error }` body as thrown `Error` messages.

## Development workflow (spec-driven)

This project follows spec-driven development:

- Specs are stored in the `_specs/` folder.
- Once a spec is approved, the implementation plan is created and stored in the `_plans/` folder.
- Before starting implementation, make sure the current branch is committed (no uncommitted changes).
