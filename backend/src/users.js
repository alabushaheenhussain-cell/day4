import { pool } from './db.js';

const PUBLIC = 'id, name, email, role, created_at';

export const createUser = async ({ name, email, passwordHash }) =>
  (await pool.query(
    `INSERT INTO app_user (name, email, password_hash) VALUES ($1,$2,$3) RETURNING ${PUBLIC}`,
    [name, email, passwordHash])).rows[0];

// Only login needs the hash
export const findByEmail = async (email) =>
  (await pool.query('SELECT * FROM app_user WHERE email = $1', [email])).rows[0];

export const findById = async (id) =>
  (await pool.query(`SELECT ${PUBLIC} FROM app_user WHERE id = $1`, [id])).rows[0];

// One query for all users; users without customers get 0
export const listUsersWithCustomerCounts = async () =>
  (await pool.query(
    `SELECT u.id, u.name, u.email, u.role, u.created_at, COUNT(c.id)::int AS customer_count
     FROM app_user u LEFT JOIN customer c ON c.sales_user_id = u.id
     GROUP BY u.id ORDER BY u.created_at, u.id`)).rows;
