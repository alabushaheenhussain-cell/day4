# Customer Manager

Two projects in one repo:

| Folder | Stack | Local port |
|---|---|---|
| `backend/` | Node.js, Express, PostgreSQL, Swagger UI, Anthropic SDK | 4000 |
| `frontend/` | React + Vite | 5173 |

## Run locally

```bash
cd backend  && cp .env.example .env && npm install && npm start   # fill in .env first
cd frontend && cp .env.example .env && npm install && npm run dev
```

- Swagger UI: http://localhost:4000/swagger (spec at `/swagger.json`)
- Health check: http://localhost:4000/health
- `POST /agent` needs `ANTHROPIC_API_KEY` set.

## Deploy to Vercel

Create **two** Vercel projects from this repo.

**1. Backend** – Root Directory `backend`

| Variable | Value |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | your Anthropic key |
| `ANTHROPIC_MODEL` | optional, defaults to `claude-sonnet-5-5` |
| `CORS_ORIGIN` | frontend URL, e.g. `https://your-frontend.vercel.app` (comma-separate several) |

Verify: `<backend-url>/swagger`, `<backend-url>/health`, `<backend-url>/customers`.

**2. Frontend** – Root Directory `frontend`

| Variable | Value |
|---|---|
| `VITE_API_URL` | backend URL, e.g. `https://your-backend.vercel.app` |

`VITE_API_URL` is baked in at build time, so redeploy the frontend after changing it.

## Secrets

`.env` files are git-ignored; only `.env.example` templates are committed. Set real values in the Vercel dashboard.
