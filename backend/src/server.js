import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import spec from './swagger.js';
import { initDb } from './db.js';
import * as db from './customers.js';
import { runAgent } from './agent.js';

const app = express();
// Allow cross-origin requests from the frontend (comma-separated list, or * for all)
const origins = (process.env.CORS_ORIGIN || '*').split(',').map((s) => s.trim());
app.use(cors({ origin: origins.includes('*') ? true : origins }));
app.use(express.json());

app.use('/swagger', swaggerUi.serve, swaggerUi.setup(spec));
app.get('/', (_req, res) => res.redirect('/swagger'));

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

const port = process.env.PORT || 4000;
await initDb();
app.listen(port, () => console.log(`API on http://localhost:${port}  |  Swagger: http://localhost:${port}/swagger`));
