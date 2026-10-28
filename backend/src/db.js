import pg from 'pg';

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // required by Render-hosted PostgreSQL
});

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS customer (
      id SERIAL PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      email VARCHAR(150),
      phone VARCHAR(50),
      address TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
}
