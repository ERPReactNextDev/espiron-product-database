# ERP User, Role, and Permission Mapping

> **Purpose:** Document the relationship between user accounts, roles, permissions, and where access settings are stored.
>
> **Important:** The account mapping below is based only on the text provided. Role IDs, departments, and actual per-user permission values were not included for most accounts. Do not assume a user ID is a role ID.

## 1. Accounts from the provided listing

The numbers at the beginning of each row are labeled as **user IDs from the listing**; the actual database column name has not been confirmed.

| User ID (listing) | Name | Email | Role shown | Role ID | Status shown |
|---:|---|---|---|---|---|
| 1 | Super Admin | admin@erp.local | Super Admin (inferred from the visible label; role column unconfirmed) | Not provided | active |
| 2 | Mark Louies De Castro | decastromarklouies@gmail.com | Not shown | Not provided | active |
| 9 | Jesse Lyle Moldez | j.moldez@disruptivesolutionsinc.com | Not shown | Not provided | active |
| 10 | Ronald Antiv (name/email boundary unconfirmed) | `Antivor.antivo@disruptivesolutionsinc.com` fragment; verify against the source | Not shown | Not provided | active |
| 11 | Aaron TSA | aarontsa@disruptivesolutionsinc.com | Not shown | Not provided | active |
| 12 | Aaron TSM | aarontsm@disruptivesolutionsinc.com | Not shown | Not provided | active |
| 13 | Aaron Sales Head | aaronsaleshead@disruptivesolutionsinc.com | Not shown | Not provided | Incomplete in the provided text |

Password hashes, browser user-agent, IP address, and other session/audit fields are intentionally excluded because they are not needed for a role and permission mapping.

## 2. Access-control model found in the codebase

Based on the current implementation:

1. **User and role profile:** The application reads users from the Supabase `users` table. It uses `id`, `Email`, `Department`, and `Role`, among other profile fields. The inspected application code does not show a `role_id` relationship or relational `roles` / `role_permissions` tables.
2. **Per-user access settings:** Access overrides are stored in the Firestore `roleAccess` collection. The document ID is the user ID, and its `access` object contains permission keys with boolean values.
3. **No confirmed role-to-permission inheritance:** The application reads access by user ID; it does not look up permissions through a `role_id`.

```text
Supabase: users.id
    ├── users.Department
    ├── users.Role
    └── Firestore: roleAccess/{users.id}
            └── access: { "<permission-key>": true | false }
```

Match the Supabase `users.id` to the Firestore document ID to trace a user's overrides. Name or email alone does not confirm the stored Firestore permissions.

## 3. SQL to inspect the database

Run these queries in the Supabase SQL Editor. They first establish the real schema; do not assume that `role_id`, `roles`, or permission tables exist.

### 3.1 Find role- and permission-related tables and columns

```sql
SELECT
  table_schema,
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
  AND (
    table_name ILIKE '%role%'
    OR table_name ILIKE '%permission%'
    OR column_name ILIKE '%role%'
    OR column_name ILIKE '%permission%'
  )
ORDER BY table_schema, table_name, ordinal_position;
```

### 3.2 View the listed users' role fields

The application code confirms `id`, `Email`, `Department`, and `Role` as fields it uses. This query deliberately avoids selecting password hashes.

```sql
SELECT
  id,
  "Email",
  "Department",
  "Role"
FROM public.users
WHERE id IN (1, 2, 9, 10, 11, 12, 13)
ORDER BY id;
```

If query 3.1 confirms that `public.users` has a `role_id` column, add it to the select list:

```sql
SELECT
  id,
  "Email",
  "Department",
  "Role",
  role_id
FROM public.users
WHERE id IN (1, 2, 9, 10, 11, 12, 13)
ORDER BY id;
```

If the database uses a different schema/table name or quoted column spelling, adjust the query to match the results from 3.1.

### 3.3 Find foreign-key relationships for roles and permissions

```sql
SELECT
  tc.table_schema,
  tc.table_name,
  kcu.column_name,
  ccu.table_schema AS referenced_schema,
  ccu.table_name AS referenced_table,
  ccu.column_name AS referenced_column
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_schema = kcu.constraint_schema
  AND tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON tc.constraint_schema = ccu.constraint_schema
  AND tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND (
    tc.table_name ILIKE '%role%'
    OR tc.table_name ILIKE '%permission%'
    OR ccu.table_name ILIKE '%role%'
    OR ccu.table_name ILIKE '%permission%'
  )
ORDER BY tc.table_schema, tc.table_name, kcu.column_name;
```

If query 3.1 and 3.3 reveal relational role and permission tables, use their actual names and keys to join them. For example, **only if** the schema uses these conventional table and column names:

```sql
SELECT
  u.id AS user_id,
  u."Email",
  u."Role",
  r.id AS role_id,
  r.name AS role_name,
  p.name AS permission
FROM public.users AS u
LEFT JOIN public.roles AS r
  ON r.id = u.role_id
LEFT JOIN public.role_permissions AS rp
  ON rp.role_id = r.id
LEFT JOIN public.permissions AS p
  ON p.id = rp.permission_id
WHERE u.id IN (1, 2, 9, 10, 11, 12, 13)
ORDER BY u.id, p.name;
```

The example join is not guaranteed to work in this project; use it only after confirming those table/column names in the schema.

## 4. Permission defaults in the application code

When a Firestore `roleAccess/{userId}` document does not exist, the application uses these defaults. If a document exists, its stored `access` values are merged with the defaults and can override matching keys.

| Permission key | Default |
|---|---:|
| `page:requests` | `true` |
| `page:products` | `true` |
| `page:suppliers` | `true` |
| `page:roles` | `true` |
| `page:add-product` | `true` |
| `page:edit-product` | `true` |
| `page:analytics` | `true` |
| `page:history` | `true` |
| `page:notes` | `true` |
| `feature:approval-bypass` | `false` |
| `component:spf-request-create` | `true` |
| `component:spf-request-fetch` | `true` |
| `component:upload-product` | `true` |
| `component:upload-supplier` | `true` |
| `component:add-product-btn` | `true` |
| `component:edit-product` | `true` |

In `hasAccess`, an unspecified key also defaults to `true`. The code grants all access keys to users whose `Department` is `IT`, and to users whose `Department` is `Engineering` and `Role` is `Manager`.

These are code defaults and rules, not confirmation of the actual settings for the listed accounts. Their Firestore documents must be read to determine their actual overrides.

## 5. Roles page access

The `/roles` page exposes toggles for:

- `page:requests`
- `page:products`
- `page:suppliers`
- `page:roles`
- `page:add-product`
- `page:edit-product`
- `page:analytics`
- `page:history`
- `page:notes`
- `feature:approval-bypass`

The page allows users in the IT department, or Engineering users whose role is `Manager`, to manage access. The provided account listing does not show enough information to determine which listed users meet these conditions.

## 6. Important SQL limitation

The current application stores per-user overrides in **Firestore**, not in a SQL permission table. Therefore, SQL queries against Supabase can show the user role fields and any relational role records that actually exist, but **cannot show the Firestore `roleAccess/{userId}.access` values**. Read those documents from Firebase/Firestore using an authorized project console or application tooling.

## 7. Repository sources

- `contexts/RoleAccessContext.tsx` — default permissions, Firestore `roleAccess/{userId}` reads/writes, and access checks.
- `app/roles/page.tsx` — permission keys shown and edited by the Roles page.
- `app/api/users/route.ts` — user lookup and password removal from API responses.
- `lib/supabase-admin.ts` — Supabase `users` table access and fields used by the application.
