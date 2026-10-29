# Spec 02: Admin Role (full access to all users and customers)

Status: Draft, awaiting approval. After approval, the implementation plan goes in `_plans/`.

## 1. Background

Spec 01 scoped every customer to its owning `sales` user. Hussain needs an `admin` role with full ownership: able to see and manage every user and every customer.

## 2. Goals

- A new role value `admin`. Hussain's account is made admin; all other accounts stay `sales`.
- An admin can list, view, edit and delete user accounts and change a user's role.
- An admin can list, view, create, update and delete the customers of any user, and choose which user a customer is assigned to.
- The AI agent, when the logged-in user is an admin, can work across all customers.
- Sales users are unchanged: they still only see and manage their own customers and cannot touch user management.
- Swagger and the frontend expose the admin features.

## 3. Non-goals

- More roles or fine-grained permissions.
- Audit logging, password reset, impersonating another user.
- Letting anyone become admin through the API: a role can only be set by an existing admin, or by the bootstrap step in section 4.

## 4. Making Hussain an admin (bootstrap)

There is no admin yet and registration always creates `sales` (spec 01), so the first admin is set outside the API: a script `backend/scripts/make-admin.js`, run as `npm run make-admin -- <email>`, which sets `role = 'admin'` for an existing user. Hussain registers normally first, then the script is run once against the production database (`DATABASE_URL`). No env-var based promotion, so nobody can claim admin by registering a particular email.

## 5. Authorization

- `requireAuth` already loads `req.user` including `role`. Add `requireAdmin` (403 if role is not `admin`).
- Data layer: customer functions take the caller (`{ id, role }`) instead of only `userId`. For `sales` the SQL filter `sales_user_id = $n` stays exactly as now; for `admin` the filter is omitted. The decision lives in `customers.js`, not in routes or in the agent prompt.
- The role is read from the database on each request (as `requireAuth` does now), so demoting an admin takes effect immediately.

## 6. API

New, admin only (`403` for sales users, `401` without a token):

| Endpoint | Description |
|---|---|
| `GET /users` | List all users (no password hashes), with a `customer_count` each. |
| `GET /users/:id` | One user. `404` if missing. |
| `PUT /users/:id` | Update `name`, `email` (unique, `409` on clash), `role` (`sales` or `admin`), and optionally reset `password` (min 8 characters). |
| `DELETE /users/:id` | Delete the user. See open question 1 for their customers. |

Guards: an admin cannot delete themselves, and cannot demote or delete the last remaining admin (`400` with an explanatory message).

Changed behaviour for admins on existing endpoints:

| Endpoint | Admin behaviour |
|---|---|
| `GET /customers` | All customers; optional `?user_id=` filter. Each row includes its owner (`sales_user_id`, plus `owner_name`). |
| `GET/PUT/DELETE /customers/:id` | Works on any customer. |
| `POST /customers` | Creates for the caller by default, or for another user when `sales_user_id` is in the body (`400` if that user does not exist). For sales users `sales_user_id` in the body is still ignored. |
| `PUT /customers/:id` | An admin may also reassign by sending `sales_user_id`. |
| `POST /agent` | Agent tools operate across all customers; the system prompt tells it so. |

Sales users receive exactly the responses they get today.

## 7. Frontend

- When `user.role === 'admin'`: a **Users** tab to list users, change role, edit, reset password and delete; the Customers table gets an **Owner** column and an owner filter; the customer form gets an owner selector.
- Sales users see no change. The logged-in user's role is shown next to their name.

## 8. Swagger

Add the `/users` endpoints with their schemas and `403` responses, document the admin behaviour on `/customers*` and `/agent`, add `owner_name` and `customer_count` to the schemas, and note that the roles are `sales` and `admin`.

## 9. Acceptance criteria

1. After `make-admin` for Hussain's email, `GET /auth/me` returns role `admin`; every other account is still `sales`. The script fails clearly for an unknown email.
2. Registering never yields an admin, even if the body contains `role: "admin"`.
3. A sales user calling any `/users` endpoint gets `403`; their customer access is unchanged (spec 01 criteria still pass).
4. An admin sees all customers (with owner), can filter by user, and can read, update, delete and reassign any customer.
5. An admin can create a customer for another user; the customer then appears for that user and not for other sales users.
6. An admin can list, edit, change the role of, reset the password of and delete other users; the guards in section 6 hold (no self-delete, no removing the last admin).
7. Demoting an admin removes their access on their very next request.
8. The agent answers for an admin across all customers, and for a sales user only their own.
9. Frontend: the Users tab and owner controls appear only for admins; Swagger shows and can exercise the new endpoints.

## 10. Open questions

1. **Deleting a user who owns customers**: (a) block with `409` until the customers are reassigned or deleted (proposed, safest), (b) delete their customers too, or (c) reassign them to the deleting admin.
2. **Hussain's account**: which email did Hussain register with (or should the plan use the email in your account)? The script needs it.
3. **Should the admin's own customer list default to everyone's** (proposed) or only their own with a "show all" toggle?
