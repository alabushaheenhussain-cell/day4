# Plan 03: Export Customers to Excel

Implements `_specs/03_spec_export_customer.md` (approved). Resolved decisions: the export respects the Customers screen search via `?q=` (name, email, phone, address); columns are as in spec section 6.

Precondition: the working tree is committed, and work happens on the feature branch `feature/export-customers`.

## Backend (`backend/`)

1. **Dependency**: add `exceljs` to `package.json` (pure JavaScript, no native build, works on Vercel).
2. **Data layer (`src/customers.js`)**: add `searchCustomers(userId, q)`: `SELECT * FROM customer WHERE sales_user_id = $1 AND (name ILIKE $2 OR email ILIKE $2 OR phone ILIKE $2 OR address ILIKE $2) ORDER BY id`, with `\`, `%` and `_` in `q` escaped before wrapping in `%...%`. Keep `listCustomers` for the unfiltered case. Both keep `userId` first.
3. **Export module (`src/export.js`, new)**: `customersToXlsx(rows)` returns a Buffer. One worksheet `Customers`, bold frozen header row, columns ID, Name, Email, Phone, Address, Created. Phone is written as a string; every string cell starting with `=`, `+`, `-` or `@` is stored as a plain string value (never a formula; ExcelJS writes JS strings as text, and set the cell type explicitly to be safe). `Created` is a Date cell. Set column widths from content length (capped).
4. **Route (`src/app.js`)**: `GET /customers/export`, registered **before** `GET /customers/:id`. It sits under the existing `requireAuth, requireSales` guard. Take `q` from the query (trimmed string), call `searchCustomers` or `listCustomers` with `req.user.id`, build the buffer, send with the `.xlsx` content type and `Content-Disposition: attachment; filename="customers-YYYY-MM-DD.xlsx"` (UTC date). Empty result still returns a header-only file.
5. **CORS**: expose `Content-Disposition` to the browser by adding `exposedHeaders: ['Content-Disposition']` to the `cors(...)` options, otherwise the frontend cannot read the filename cross-origin.
6. **Swagger (`src/swagger.js`)**: path `/customers/export` (tag `Customers`, `bearerAuth`, `q` query parameter, binary `200` response with the xlsx media type, `401`, `403`), placed before `/customers/{id}`.

## Frontend (`frontend/src/`)

7. **`api.js`**: add `exportCustomers(q)`. It cannot reuse `request()` because that parses JSON; extract the shared header/401 handling or write a small variant that fetches `/customers/export?q=...` with the token, treats non-OK as a JSON `{ error }`, and returns `{ blob, filename }` (filename from `Content-Disposition`, fallback `customers.xlsx`). A 401 still clears the token and logs out.
8. **`Customers.jsx`**: **Export to Excel** button in the card header next to the search box. It passes the trimmed `query`, creates an object URL from the blob, clicks a temporary `<a download>`, then revokes the URL. Busy state while downloading, inline error on failure, disabled when there are no rows to export (`filtered.length === 0`). Small style additions in `styles.css` only if needed.

## Docs

9. **CLAUDE.md**: note `GET /customers/export` (must stay before `/customers/:id`), the `exceljs` use in `src/export.js`, and the formula-injection guard. **README.md**: mention the export feature if it lists features.

## Verification

No test runner, so verify manually (backend on `npm start`, restart it after changes; `npm run dev` in `frontend/`). Create test users with a `zz` email prefix and delete them and their customers afterwards.

- Spec criteria 1 to 7 and 9 via curl: two sales users with different customers, each export contains only their own rows (inspect the xlsx by unzipping or reading it with a short ExcelJS script); header-only file for a user with no customers; 401 without token, 403 with the admin token; `/customers/export` not treated as an id; `=1+1` stored as text; `+1-555-0100` and `0123` keep their leading character; `?q=` matches on email/phone/address and treats `%` and `_` literally and returns the same rows as the UI filter.
- Criterion 10: spec 01 and 02 behaviours still work (login, `/customers*`, `/admin/users`).
- Frontend (criterion 8): button downloads `customers-YYYY-MM-DD.xlsx`, with and without a search; error state shows; `npm run build` in `frontend/` succeeds.

## Commits

One commit per area (backend, frontend, docs) on the feature branch, then merge to `main`.
