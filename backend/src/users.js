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
