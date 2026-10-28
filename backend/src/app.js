import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import spec from './swagger.js';
import { initDb } from './db.js';
import * as db from './customers.js';
import { runAgent } from './agent.js';

const app = express();
// Allow cross-origin requests from the frontend (comma-separated list, or * for all)
const origins = (process.env.CORS_ORIGIN || '*').split(',').map((s) => s.trim());
app.use(cors({ origin: origins.includes('*') ? true : origins }));
app.use(express.json());

// Swagger UI is loaded from a CDN so no static asset files need to ship with the
// serverless function (swagger-ui-express's assets are not bundled by Vercel).
const swaggerHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Customer API – Swagger UI</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script>
    <script>
      window.onload = () => {
        window.ui = SwaggerUIBundle({ url: '/swagger.json', dom_id: '#swagger-ui', deepLinking: true });
      };
    </script>
  </body>
</html>`;
app.get('/swagger.json', (_req, res) => res.json(spec));
app.get(['/swagger', '/swagger/'], (_req, res) => res.type('html').send(swaggerHtml));
app.get('/', (_req, res) => res.redirect('/swagger'));

// Create the table once per instance, lazily (serverless has no startup hook)
let ready;
app.use((_req, _res, next) => {
  ready ??= initDb().catch((e) => { ready = undefined; throw e; });
  ready.then(() => next(), next);
});

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
const validId = (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: 'Invalid id' }); return null; }
  return id;
};

app.get('/customers', wrap(async (req, res) =>
  res.json(req.query.name ? await db.searchByName(req.query.name) : await db.listCustomers())));

app.post('/customers', wrap(async (req, res) => {
  if (!req.body?.name?.trim()) return res.status(400).json({ error: 'name is required' });
  res.status(201).json(await db.createCustomer(req.body));
}));

app.get('/customers/:id', wrap(async (req, res) => {
  const id = validId(req, res); if (id === null) return;
  const c = await db.getCustomer(id);
  c ? res.json(c) : res.status(404).json({ error: 'Customer not found' });
}));

app.put('/customers/:id', wrap(async (req, res) => {
  const id = validId(req, res); if (id === null) return;
  const c = await db.updateCustomer(id, req.body || {});
  c ? res.json(c) : res.status(404).json({ error: 'Customer not found' });
}));

app.delete('/customers/:id', wrap(async (req, res) => {
  const id = validId(req, res); if (id === null) return;
  const c = await db.deleteCustomer(id);
  c ? res.json({ deleted: c }) : res.status(404).json({ error: 'Customer not found' });
}));

app.post('/agent', wrap(async (req, res) => {
  if (!req.body?.message) return res.status(400).json({ error: 'message is required' });
  res.json(await runAgent(req.body.message, req.body.history));
}));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message });
});

export default app;
