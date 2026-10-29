# Spec 04: Customer Deals

Status: Draft, awaiting approval (see section 11 for open questions). Plan: `_plans/04_plan_customer_deals.md` (created after approval).

## 1. Background

A customer is a company or person a sales user deals with. A **deal** is a specific sales opportunity with that customer. Example: Sunrise Hospital wants 5,000 printed brochures, so Priya (a sales user) creates a deal:

- Title: "Brochure printing – Q4"
- Amount: ر.س 150,000
- Stage: Lead → Qualified → Proposal → Won / Lost
- Expected close date: 30 Nov

One customer can have many deals over time: brochures this month, ID cards next month. Today the app only stores customers, so there is no way to track what is being sold or how far along it is.

## 2. Goals

- A sales user can create, view, edit and delete deals for their own customers.
- A customer can have any number of deals.
- Each deal has a title, amount, stage and expected close date, and moves through the stages Lead, Qualified, Proposal, Won, Lost.
- A user only ever sees and changes deals of their own customers (spec 01 isolation).
- The AI agent can manage deals with the same rules as the UI.
- Swagger documents the new endpoints.

## 3. Non-goals

- Pipeline/kanban board, forecasting, charts or revenue reports.
- Multiple currencies or currency conversion (amounts are in SAR, see section 5).
- Line items, products, quotes, invoices, or file attachments on a deal.
- Stage history/audit trail, notes or activity log per deal.
- Reassigning a deal to another customer or another user.
- Admin access to deals (the admin dashboard stays read-only and unchanged, see spec 02). Admins get 403 as on `/customers*`.
- Export of deals to Excel (could extend spec 03 later).

## 4. Data model

New table `deal`, created lazily by `initDb()` like `customer`:

| Column | Type | Notes |
|---|---|---|
| `id` | serial primary key | |
| `customer_id` | integer, not null, FK to `customer(id)` `ON DELETE CASCADE` | deleting a customer deletes its deals |
| `sales_user_id` | integer, not null, FK to `app_user(id)` | owner; always equal to the owning customer's `sales_user_id` |
| `title` | text, not null | non-empty after trim, max 200 chars |
| `amount` | numeric(14,2), not null, default 0 | `>= 0`, in SAR; returned to clients as a JSON number |
| `stage` | text, not null, default `lead` | one of `lead`, `qualified`, `proposal`, `won`, `lost` (CHECK constraint) |
| `expected_close_date` | date, null | optional; plain date, no time zone |
| `created_at` | timestamptz, default now() | |
| `updated_at` | timestamptz, default now() | set on every update |

Index on `(sales_user_id, customer_id)`.

`sales_user_id` is stored on the deal (not only derived through the customer) so every query can filter on it directly, matching the pattern in `customers.js`.

## 5. Amount and currency

Amounts are stored in Saudi riyals as `numeric(14,2)` and sent in the API as numbers (e.g. `150000`), never as formatted strings. The UI shows the Arabic riyal abbreviation before the amount, `ر.س 150,000` (`toLocaleString('en-US')`). Only SAR is supported; there is no currency column.

## 6. Stages

Allowed values: `lead`, `qualified`, `proposal`, `won`, `lost`. Displayed as Lead, Qualified, Proposal, Won, Lost.

- New deals default to `lead`.
- Any stage can be set to any other stage (no enforced order), so a mistake can be corrected and a deal can be Lost from any point or reopened.
- `won` and `lost` are the closed stages; the others are open.

## 7. API

All endpoints require a sales Bearer token (`requireSales`): `401` without or with an invalid token, `403` for an admin token. Errors are JSON `{ error }`.

| Endpoint | Description |
|---|---|
| `GET /customers/:id/deals` | List the deals of one of the caller's customers, newest first. |
| `POST /customers/:id/deals` | Create a deal for that customer. Returns `201` with the deal. |
| `GET /deals` | List all of the caller's deals across customers, each with `customer_name`. Optional `?stage=` and `?customer_id=` filters. |
| `GET /deals/:id` | Get one deal. |
| `PUT /deals/:id` | Update a deal (`title`, `amount`, `stage`, `expected_close_date`). |
| `DELETE /deals/:id` | Delete a deal. Returns `204`. |

Request body for create/update: `{ title, amount, stage, expected_close_date }`.

- Create: `title` required; `amount` optional (default 0); `stage` optional (default `lead`); `expected_close_date` optional (`YYYY-MM-DD`).
- Update: all fields optional. `PUT` follows the existing `updateCustomer` behaviour (`COALESCE`), except that `expected_close_date` may be cleared by sending `null`.
- `customer_id` and the owner cannot be changed through update, and the owner is never read from the body.

Validation (`400` with a clear message):
- `title` missing, empty after trim, or over 200 characters.
- `amount` not a finite number, negative, or more than 2 decimal places or above 999,999,999,999.99.
- `stage` not one of the five values.
- `expected_close_date` not a valid calendar date.
- Non-numeric `:id`.

An unknown deal/customer id, or one belonging to another user, returns `404` (indistinguishable, same rule as customers in spec 01).

Routing: `GET /deals` and `/deals/:id` are separate from `/customers/:id`, so there is no clash with `/customers/export` (spec 03), which stays registered before `/customers/:id`.

## 8. Scoping and security

- A new `src/deals.js` holds all deal SQL (parameterized, `pg`). Every function takes the owner `userId` first and filters on `deal.sales_user_id` in SQL, like `customers.js`.
- Creating a deal first verifies in SQL that the customer exists **and** has `sales_user_id = userId`; otherwise `404`. This stops a user attaching a deal to someone else's customer.
- The user id comes from `req.user.id`, never from the body, query or agent tool input.
- Deal text (title) is rendered by React as text, not HTML.

## 9. AI agent

`src/agent.js` gets deal tools, bound to the logged-in user through `makeHandlers(userId)` like the customer tools:

- `list_deals` (optional `customer_id`, `stage`)
- `create_deal` (`customer_id`, `title`, `amount`, `stage`, `expected_close_date`)
- `update_deal` (`id`, and any fields; used to move the stage)
- `delete_deal` (`id`)

Both `tools` and `makeHandlers` are updated together. The system prompt mentions deals and that amounts are in Saudi riyals. The iteration cap (8) is unchanged.

## 10. Frontend

- On each customer in `Customers.jsx`, a **Deals** section (expandable) lists that customer's deals with title, amount (`ر.س 150,000`), stage badge and expected close date, plus the count and total open amount.
- An **Add deal** form: title, amount, stage (dropdown, default Lead), expected close date (date input). Deals can be edited inline and deleted with a confirmation. The stage can be changed directly from a dropdown on the deal row.
- Won deals are visually distinct from open ones, and Lost deals are muted.
- `api.js` gets `listDeals(customerId)`, `createDeal`, `updateDeal`, `deleteDeal`, reusing the token and 401 handling.
- Validation errors from the backend show inline. Admins never see the Customers screen.
- Deleting a customer asks for confirmation that its deals are deleted too.

## 11. Open questions

1. **Cascade vs. block on customer delete.** Proposal: deleting a customer deletes its deals (`ON DELETE CASCADE`), with a warning in the UI. Alternative: refuse to delete a customer that has deals.
2. **Overall deals page.** `GET /deals` exists in the API, but the proposal is not to build a separate "all deals" screen in the UI in this spec (only the per-customer section). Confirm.
3. **Closed-date field.** Whether to also store an actual `closed_at` when a deal becomes Won/Lost. Proposal: no, out of scope for now.

## 12. Acceptance criteria

1. A sales user can create a deal on their own customer with title "Brochure printing – Q4", amount 150000, stage `lead`, close date 2026-11-30 and get it back with those values; the UI shows `ر.س 150,000`.
2. One customer can have several deals; `GET /customers/:id/deals` returns all of them, newest first.
3. A deal can be moved Lead → Qualified → Proposal → Won, and to Lost from any stage; an invalid stage returns `400`.
4. Invalid input (empty title, negative amount, bad date, over-long title) returns `400` and creates nothing.
5. With two sales users, neither can list, read, update or delete the other's deals, or create a deal on the other's customer; all return `404`.
6. No token returns `401`; an admin token returns `403` on all deal endpoints.
7. Deleting a customer deletes its deals (per section 11, question 1).
8. `expected_close_date` can be cleared with `null` on update; other omitted fields stay unchanged.
9. The agent can create a deal, list deals and move a deal's stage for the logged-in user only, and cannot reach another user's deals.
10. Swagger (`src/swagger.js`) documents all deal endpoints with `Deals` tag and `401`/`403`/`404` responses.
11. Existing endpoints and behaviour (specs 01 to 03) are unchanged, including `/customers/export`.
