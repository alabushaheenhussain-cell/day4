import { pool } from './db.js';

export const STAGES = ['lead', 'qualified', 'proposal', 'won', 'lost'];

// numeric comes back from pg as a string and date as a JS Date; return a number and 'YYYY-MM-DD'
const COLS = `d.id, d.customer_id, d.sales_user_id, d.title, d.amount::float8 AS amount, d.stage,
  to_char(d.expected_close_date, 'YYYY-MM-DD') AS expected_close_date, d.created_at, d.updated_at`;

// Shared by the routes and the agent. Returns { value } (whitelisted fields only) or { error }.
// partial: update semantics, every field optional and the close date may be cleared with null.
export function validateDeal(body = {}, { partial = false } = {}) {
  const value = {};
  if (body.title !== undefined || !partial) {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) return { error: 'title is required' };
    if (title.length > 200) return { error: 'title must be at most 200 characters' };
    value.title = title;
  }
  if (body.amount !== undefined && body.amount !== null) {
    const n = typeof body.amount === 'string' && body.amount.trim() !== '' ? Number(body.amount) : body.amount;
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 999999999999.99
        || Math.abs(Math.round(n * 100) - n * 100) > 1e-6) {
      return { error: 'amount must be a number between 0 and 999999999999.99 with at most 2 decimals' };
    }
    value.amount = n;
  }
  if (body.stage !== undefined && body.stage !== null) {
    if (!STAGES.includes(body.stage)) return { error: `stage must be one of: ${STAGES.join(', ')}` };
    value.stage = body.stage;
  }
  if (body.expected_close_date !== undefined) {
    const d = body.expected_close_date;
    if (d === null || d === '') {
      if (partial) value.expected_close_date = null;
    } else {
      const ok = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)
        && new Date(`${d}T00:00:00Z`).toISOString().startsWith(d);
      if (!ok) return { error: 'expected_close_date must be a valid date in YYYY-MM-DD format' };
      value.expected_close_date = d;
    }
  }
  return { value };
}

// Every function is scoped to the owning sales user (userId), like customers.js.
export const listDealsForCustomer = async (userId, customerId) =>
  (await pool.query(
    `SELECT ${COLS} FROM deal d WHERE d.sales_user_id = $1 AND d.customer_id = $2 ORDER BY d.id DESC`,
    [userId, customerId])).rows;

export const listDeals = async (userId, { stage = null, customerId = null } = {}) =>
  (await pool.query(
    `SELECT ${COLS}, c.name AS customer_name FROM deal d JOIN customer c ON c.id = d.customer_id
      WHERE d.sales_user_id = $1 AND ($2::text IS NULL OR d.stage = $2) AND ($3::int IS NULL OR d.customer_id = $3)
      ORDER BY d.id DESC`,
    [userId, stage, customerId])).rows;

export const getDeal = async (userId, id) =>
  (await pool.query(`SELECT ${COLS} FROM deal d WHERE d.id = $1 AND d.sales_user_id = $2`, [id, userId])).rows[0];

// The customer's ownership is checked in the same statement: no row inserted for someone else's customer
export const createDeal = async (userId, customerId, { title, amount = 0, stage = 'lead', expected_close_date = null }) =>
  (await pool.query(
    `INSERT INTO deal AS d (customer_id, sales_user_id, title, amount, stage, expected_close_date)
     SELECT c.id, c.sales_user_id, $3, $4, $5, $6 FROM customer c WHERE c.id = $2 AND c.sales_user_id = $1
     RETURNING ${COLS}`,
    [userId, customerId, title, amount, stage, expected_close_date])).rows[0];

// Omitted fields keep their value; expected_close_date can be cleared by passing null
export const updateDeal = async (userId, id, d) =>
  (await pool.query(
    `UPDATE deal d SET title = COALESCE($3, title), amount = COALESCE($4, amount), stage = COALESCE($5, stage),
       expected_close_date = CASE WHEN $6 THEN $7::date ELSE expected_close_date END, updated_at = now()
     WHERE d.id = $1 AND d.sales_user_id = $2 RETURNING ${COLS}`,
    [id, userId, d.title ?? null, d.amount ?? null, d.stage ?? null,
      d.expected_close_date !== undefined, d.expected_close_date ?? null])).rows[0];

export const deleteDeal = async (userId, id) =>
  (await pool.query('DELETE FROM deal d WHERE d.id = $1 AND d.sales_user_id = $2 RETURNING d.id', [id, userId])).rows[0];
