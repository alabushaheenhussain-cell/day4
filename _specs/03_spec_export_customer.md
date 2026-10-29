# Spec 03: Export Customers to Excel

Status: Approved (search filter respected via `?q=`; columns as in section 6). Plan: `_plans/03_plan_export_customer.md`.

## 1. Background

Sales users manage their customers in the web UI and through the AI agent, but cannot take the data out of the application. This feature lets a logged-in sales user download their customers as an Excel file.

## 2. Goals

- A logged-in sales user can download an Excel (`.xlsx`) file containing their customers.
- The file contains only customers owned by the logged-in user, never anyone else's.
- The export is available from the Customers screen with one click.
- Swagger documents the endpoint.

## 3. Non-goals

- Importing customers from Excel, or other formats (CSV, PDF).
- Exporting for admins (admins own no customers, see spec 02), emailing or scheduling exports.
- Column selection, custom formatting, or multiple sheets.
- Exporting the AI agent conversation.

## 4. API

| Endpoint | Auth | Description |
|---|---|---|
| `GET /customers/export` | sales (Bearer token) | Returns an `.xlsx` file with the caller's customers. |

Response on success:
- `200`, `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
- `Content-Disposition: attachment; filename="customers-YYYY-MM-DD.xlsx"` (server date, UTC).
- A customer-less user still gets `200` with a file containing only the header row.

Errors: `401` without or with an invalid token, `403` for an admin token (the existing `requireSales` guard on `/customers*`). Errors are JSON `{ error }` as elsewhere.

Routing: the route must be registered **before** `GET /customers/:id`, otherwise `export` is read as an id and returns `400 Invalid id`.

The optional `?q=` filter exports only customers whose name, email, phone or address contains the text (case-insensitive), the same rule the Customers screen search box uses, so the file matches what is on screen. The existing `?name=` filter on `GET /customers` only matches names, so it is not reused.

## 5. Scoping and security

- The export uses owner-scoped data functions in `customers.js`: the existing `listCustomers(userId)` and a new `searchCustomers(userId, q)` that adds `AND (name ILIKE $2 OR email ILIKE $2 OR phone ILIKE $2 OR address ILIKE $2)` to the same `sales_user_id = $1` filter, with `%`, `_` and `` in `q` escaped so they match literally. The user id comes from `req.user.id`, never from the query string or body, and the per-user filter in SQL (spec 01) stays the single enforcement point.
- Cells starting with `=`, `+`, `-` or `@` are written as plain text, not formulas, so a customer name like `=HYPERLINK(...)` cannot run when the file is opened (spreadsheet formula injection). Values are never interpreted as formulas.
- The file is generated in memory and streamed in the response; nothing is written to disk (the backend runs on serverless Vercel).

## 6. File format

One worksheet named `Customers`. First row is a bold header; columns:

| Column | Source | Notes |
|---|---|---|
| ID | `id` | number |
| Name | `name` | |
| Email | `email` | empty if null |
| Phone | `phone` | text, so leading `+`/`0` are kept |
| Address | `address` | empty if null |
| Created | `created_at` | date-time cell |

Rows are ordered like the Customers list (same order as `listCustomers`). Column widths are set to fit the content; header row is frozen. The owner column is not included (it is always the logged-in user).

## 7. Implementation notes

- New backend dependency for writing `.xlsx`: `exceljs` (pure JavaScript, no native build, works on Vercel). Avoid the `xlsx` (SheetJS) npm package, which is unmaintained on npm and has known vulnerabilities.
- Add `searchCustomers` to `src/customers.js`, the route in `src/app.js` and the path in `src/swagger.js` (binary response, tag `Customers`, `401`/`403` responses).

## 8. Frontend

- An **Export to Excel** button in the Customers header, next to the existing add/search controls.
- The request must carry the `Authorization` header, so a plain link or `window.open` cannot be used. `api.js` gets an `exportCustomers()` that fetches the file as a blob (reusing the token and 401 handling), and the UI triggers the download from a temporary object URL with the filename from `Content-Disposition`.
- The button passes the current search text as `?q=`. It shows a busy state while the download is in progress and an inline error if it fails. It is disabled while the list is empty.
- Admins never see the Customers screen, so they never see the button.

## 9. Acceptance criteria

1. As a sales user with customers, `GET /customers/export` returns a valid `.xlsx` that opens in Excel with the header row and one row per customer, with values matching the Customers list.
2. With two sales users, each export contains only that user's customers; ids of the other user's customers never appear.
3. A user with no customers gets a file with only the header row.
4. No token returns `401`; an admin token returns `403`.
5. `GET /customers/export` is not treated as `/customers/:id`.
6. A customer named `=1+1` appears in the cell as the text `=1+1`, not as a calculated value.
7. A phone like `+1-555-0100` or `0123` keeps its leading character.
8. Frontend: clicking the button downloads `customers-YYYY-MM-DD.xlsx`; it fails gracefully on an error; the Swagger entry is present.
9. With `?q=`, only customers matching name, email, phone or address (case-insensitive, `%` and `_` literal) are exported, identical to the rows the Customers screen shows for that search.
10. Existing endpoints and behaviour (specs 01 and 02) are unchanged.

## 10. Resolved decisions

1. The export respects the current search text of the Customers screen (`?q=`, matching name, email, phone and address); with no filter it exports all of the user's customers.
2. The columns in section 6 are final.
