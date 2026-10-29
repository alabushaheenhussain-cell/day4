import { pool } from './db.js';

// Every function is scoped to the owning sales user (userId); rows of other users are invisible.
export const listCustomers = async (userId) =>
  (await pool.query('SELECT * FROM customer WHERE sales_user_id = $1 ORDER BY id', [userId])).rows;

export const searchByName = async (userId, name) =>
  (await pool.query(
    'SELECT * FROM customer WHERE sales_user_id = $1 AND name ILIKE $2 ORDER BY id',
    [userId, `%${name}%`])).rows;

// Same rule as the Customers screen search: substring of name, email, phone or address.
// \, % and _ are escaped so they match literally.
export const searchCustomers = async (userId, q) =>
  (await pool.query(
    `SELECT * FROM customer WHERE sales_user_id = $1
       AND (name ILIKE $2 OR email ILIKE $2 OR phone ILIKE $2 OR address ILIKE $2) ORDER BY id`,
    [userId, `%${q.replace(/[\\%_]/g, '\\$&')}%`])).rows;

export const getCustomer =async (userId, id) =>
  (await pool.query('SELECT * FROM customer WHERE id = $1 AND sales_user_id = $2', [id, userId])).rows[0];

export const createCustomer = async (userId, { name, email = null, phone = null, address = null }) =>
  (await pool.query(
    'INSERT INTO customer (name, email, phone, address, sales_user_id) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [name, email, phone, address, userId])).rows[0];

export const updateCustomer = async (userId, id, { name, email, phone, address }) =>
  (await pool.query(
    `UPDATE customer SET name = COALESCE($3, name), email = COALESCE($4, email),
       phone = COALESCE($5, phone), address = COALESCE($6, address)
     WHERE id = $1 AND sales_user_id = $2 RETURNING *`,
    [id, userId, name ?? null, email ?? null, phone ?? null, address ?? null])).rows[0];

export const deleteCustomer = async (userId, id) =>
  (await pool.query('DELETE FROM customer WHERE id = $1 AND sales_user_id = $2 RETURNING *', [id, userId])).rows[0];
