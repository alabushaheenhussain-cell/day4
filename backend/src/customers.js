import { pool } from './db.js';

export const listCustomers = async () =>
  (await pool.query('SELECT * FROM customer ORDER BY id')).rows;

export const searchByName = async (name) =>
  (await pool.query('SELECT * FROM customer WHERE name ILIKE $1 ORDER BY id', [`%${name}%`])).rows;

export const getCustomer = async (id) =>
  (await pool.query('SELECT * FROM customer WHERE id = $1', [id])).rows[0];

export const createCustomer = async ({ name, email = null, phone = null, address = null }) =>
  (await pool.query(
    'INSERT INTO customer (name, email, phone, address) VALUES ($1,$2,$3,$4) RETURNING *',
    [name, email, phone, address])).rows[0];

export const updateCustomer = async (id, { name, email, phone, address }) =>
  (await pool.query(
    `UPDATE customer SET name = COALESCE($2, name), email = COALESCE($3, email),
       phone = COALESCE($4, phone), address = COALESCE($5, address)
     WHERE id = $1 RETURNING *`,
    [id, name ?? null, email ?? null, phone ?? null, address ?? null])).rows[0];

export const deleteCustomer = async (id) =>
  (await pool.query('DELETE FROM customer WHERE id = $1 RETURNING *', [id])).rows[0];
