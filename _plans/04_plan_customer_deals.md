# Plan 04: Customer Deals

Implements `_specs/04_spec_customer_deals.md` (approved). Decisions taken from the spec: deleting a customer cascades to its deals (UI warns); no separate "all deals" screen (the `GET /deals` API exists, the UI only shows deals per customer); no `closed_at` column.

Precondition: the working tree is committed (spec 04 is currently untracked, so commit it first), and work happens on the feature branch `feature/customer-deals`.

## Backend (`backend/`)

1. **Schema (`src/db.js`)**: in `initDb()`, after the `customer` setup, add `CREATE TABLE IF NOT EXISTS deal (...)` per spec section 4: `customer_id` FK `ON DELETE CASCADE`, `sales_user_id` FK to `app_user`, `title`, `amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (amount >= 0)`, `stage` with `CHECK (stage IN ('lead','qualified','proposal','won','lost'))`, `expected_close_date DATE`, `created_at`, `updated_at`; plus `CREATE INDEX IF NOT EXISTS deal_owner_customer ON deal (sales_user_id, customer_id)`. Must be after `customer` exists (FK). No data migration needed.
2. **Data layer (`src/deals.js`, new)**: all deal SQL, parameterized, `userId` first in every function, filtering on `deal.sales_user_id`.
   - A shared column list returns `amount::float8 AS amount` (pg returns `numeric` as a string, the API sends a number) and `to_char(expected_close_date, 'YYYY-MM-DD') AS expected_close_date` (pg would otherwise return a JS `Date` that serializes with a time and time zone shift).
   - `listDealsForCustomer(userId, customerId)`: `WHERE sales_user_id = $1 AND customer_id = $2 ORDER BY id DESC` ("newest first"). Returns `[]` for an unknown or foreign customer; the route checks the customer first to give `404`.
   - `listDeals(userId, { stage, customerId })`: joins `customer` for `customer_name`, optional filters, newest first.
   - `getDeal(userId, id)`.
   - `createDeal(userId, customerId, d)`: `INSERT ... SELECT $1, c.id, ... FROM customer c WHERE c.id = $2 AND c.sales_user_id = $1 RETURNING ...`, so ownership of the customer is verified in the same statement; zero rows means `null` (route returns `404`).
   - `updateDeal(userId, id, d)`: `COALESCE` for `title`, `amount`, `stage`; `expected_close_date` uses `CASE WHEN $flag THEN $value ELSE expected_close_date END` so `null` clears it while an omitted field keeps it; always sets `updated_at = now()`. Only `WHERE id = $ AND sales_user_id = $`. `customer_id` and owner are never in the SET list.
   - `deleteDeal(userId, id)`: returns the deleted row or `null`.
   - `validateDeal(body, { partial })` (exported, pure): returns `{ error }` or `{ value }`; trims `title` (non-empty, max 200), `amount` (finite number, `>= 0`, at most 2 decimals, `<= 999999999999.99`; accepts numeric strings from the agent), `stage` in the allowed list, `expected_close_date` (`YYYY-MM-DD` that round-trips through `Date` as a real calendar date; `null` allowed only when `partial`). Shared by the routes and the agent so the rules cannot drift.
3. **Routes (`src/app.js`)**:
   - Change the guard to `app.use(['/customers', '/deals', '/agent'], requireAuth, requireSales)` so admins get `403`, no token `401`.
   - Add `GET/POST /customers/:id/deals` next to the other `/customers/:id` routes (no ordering issue with `/customers/export`, the path has an extra segment). Both call `db.getCustomer(req.user.id, id)` first for the `404 Customer not found`, then the deal function. `POST` validates with `validateDeal` (`400`) and returns `201`.
   - Add `GET /deals` (optional `?stage=` validated against the list, `?customer_id=` must be an integer, else `400`), `GET /deals/:id`, `PUT /deals/:id` (`partial` validation), `DELETE /deals/:id` (`204`, no body). Reuse `validId`. Not-found returns `404 { error: 'Deal not found' }`.
   - The owner is always `req.user.id`; the body is only passed through `validateDeal`, which returns a whitelist of four fields, so `customer_id` or `sales_user_id` in a body are ignored.
4. **Agent (`src/agent.js`)**: add tools `list_deals` (`customer_id`, `stage` optional), `create_deal` (`customer_id`, `title` required; `amount`, `stage`, `expected_close_date`), `update_deal` (`id` required plus fields), `delete_deal` (`id`) to `tools`, and matching entries in `makeHandlers(userId)` calling `deals.js` through `validateDeal` (a validation error is returned as `{ error }` so the model can correct itself). Not-found returns `{ error: 'Deal not found' }` like the customer handlers. Extend `SYSTEM` to mention deals, that amounts are in rupees, and the stages. Iteration cap stays 8.
5. **Swagger (`src/swagger.js`)**: add tag `Deals` and a `Deal` / `DealInput` schema; paths `/customers/{id}/deals` (get, post), `/deals` (get with `stage`, `customer_id`), `/deals/{id}` (get, put, delete), all with `bearerAuth` and `400`/`401`/`403`/`404` as applicable; `stage` documented as an enum.

## Frontend (`frontend/src/`)

6. **`api.js`**: add `listDeals(customerId)`, `createDeal(customerId, body)`, `updateDeal(id, body)`, `deleteDeal(id)` using the existing `request()` (token and 401 logout). `DELETE` returns `204` with no body, so check `request()` handles an empty response and adjust it minimally if it always calls `res.json()`.
7. **`Deals.jsx` (new)**: props `customer`. Loads `api.listDeals` when mounted (i.e. when the row is expanded). Shows count and total open amount (stages other than won/lost), then rows: title, amount as `₹` + `toLocaleString('en-IN')`, stage badge, expected close date, Edit/Delete. A stage `<select>` on the row calls `updateDeal` directly. An "Add deal" form (title, amount, stage default Lead, date) reusing the existing `.overlay` / `.modal` styles, same pattern as the customer form (add and edit in one). Backend errors show in an inline `.alert`. Delete asks `window.confirm`. Won rows get a "won" style, Lost rows a muted style.
8. **`Customers.jsx`**: add a **Deals** toggle button in each row's actions; expanding renders an extra `<tr>` with `<td colSpan="6"><Deals customer={c} /></td>` (track the expanded id in state). Update the customer delete confirmation to: `Delete ${c.name} and all their deals?`.
9. **`styles.css`**: small additions for the stage badge colours, won/lost row styles, and the nested deals panel; reuse existing variables.

## Docs

10. **CLAUDE.md**: add to Backend architecture: `deal` table, `src/deals.js` (owner-scoped, same rules as `customers.js`, `validateDeal` shared by routes and agent, numeric/date returned as number/`YYYY-MM-DD` string), the `/deals` guard, cascade on customer delete, and that adding a deal operation means updating `tools` and `makeHandlers`. Add `Deals.jsx` to the Frontend section. **README.md**: mention deals if it lists features.

## Verification

No test runner, so verify manually (backend `npm start`, restart after changes; `npm run dev` in `frontend/`). Create test users with a `zz` email prefix and delete them and their customers (cascading to deals) afterwards.

- Criterion 1 and 2: create the "Brochure printing – Q4" deal (150000, `lead`, 2026-11-30) via curl and the UI; response `amount` is a number, date is `2026-11-30` (no time zone shift); UI shows `ر.س 150,000`; several deals on one customer are listed newest first.
- Criterion 3 and 4: move through all stages and to `lost` from any stage; invalid stage, empty title, 201-char title, negative amount, 3 decimals, `2026-02-30`, non-numeric id all return `400` and create nothing.
- Criterion 5: two sales users; the second gets `404` on list/get/put/delete of the first's deals and on `POST /customers/<other's id>/deals`, and `GET /deals` never returns the first's rows. A body containing `customer_id` / `sales_user_id` on `PUT` changes nothing.
- Criterion 6: `401` with no token and `403` with the admin token on every deal endpoint.
- Criterion 7: deleting a customer removes its deals (check in the DB or via `GET /deals`).
- Criterion 8: `PUT { expected_close_date: null }` clears the date; a `PUT { stage: 'won' }` keeps title, amount and date.
- Criterion 9: via `/agent` (needs `ANTHROPIC_API_KEY`): "create a deal for <customer> ...", "list deals", "move it to proposal"; confirm the agent cannot see the other user's deals.
- Criterion 10: Swagger at `/swagger` shows the `Deals` endpoints and `/swagger.json` parses.
- Criterion 11: specs 01 to 03 still work (login, admin dashboard, customer CRUD, `/customers/export`).
- Frontend: add/edit/delete a deal, change stage from the dropdown, errors show inline, deleting a customer shows the new warning, `npm run build` in `frontend/` succeeds.

## Commits

One commit per area on the feature branch: spec + plan, backend (schema, data layer, routes, swagger), agent, frontend, docs. Then merge to `main`.
