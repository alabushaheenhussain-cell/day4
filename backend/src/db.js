import pg from 'pg';

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // required by Render-hosted PostgreSQL
  max: 3, // keep the pool small: each serverless instance holds its own
});

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_user (
      id SERIAL PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      email VARCHAR(150) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role VARCHAR(30) NOT NULL DEFAULT 'sales',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS customer (
      id SERIAL PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      email VARCHAR(150),
      phone VARCHAR(50),
      address TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  // Per-user ownership. Customers created before auth existed have no owner and are removed (spec 01).
  await pool.query('ALTER TABLE customer ADD COLUMN IF NOT EXISTS sales_user_id INTEGER REFERENCES app_user(id)');
  await pool.query('DELETE FROM customer WHERE sales_user_id IS NULL');
  await pool.query('ALTER TABLE customer ALTER COLUMN sales_user_id SET NOT NULL');
}
