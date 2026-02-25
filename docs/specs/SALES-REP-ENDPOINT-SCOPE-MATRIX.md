# Sales Rep Endpoint + Scope Matrix

Last update: 2026-02-21  
Tenant base path: `/t/:tenantSlug/*`

## 1) Locked Decisions
- Quote PDF send is part of normal sales flow: `POST /quotes/:id/send` uses `quotes.write`.
- Sales rep can create `Company` and `Contact` with limited fields.
- Sales rep cannot access user management or sensitive settings.
- Data scope must be enforced in backend query/service layer, not only UI.

## 2) SALES_REP Default Permissions
- `dashboard.read`
- `leads.read`, `leads.write`
- `quotes.read`, `quotes.write`
- `companies.read`, `companies.write`
- `contacts.read`, `contacts.write`
- `tasks.read`, `tasks.write`
- `activities.read`
- `products.read`
- `settings.read` (profile-level UX only)

Denied by default:
- `users.read`, `users.write`, `users.manage`
- `settings.manage`
- `imports.write`, `imports.manage`
- `*.manage` for leads/quotes/companies/contacts/tasks

## 3) Endpoint Matrix (Rep Panel)

### Dashboard + Inbox
- `GET /dashboard/rep`
  - Permission: `dashboard.read`
  - Scope: actor-only metrics/reminders from:
    - tasks where `assignedToUserId = me OR createdByUserId = me`
    - leads where `ownerUserId = me`
    - quotes where `ownerUserId = me`
- `GET /dashboard/manager/overview`
  - Permission: recommended `dashboard.manage` (currently `dashboard.read`)
  - Scope: manager/all
- `GET /dashboard/manager/team`
  - Permission: recommended `dashboard.manage` (currently `dashboard.read`)
  - Scope: manager/all

### Leads
- `GET /leads`
  - Permission: `leads.read`
  - Scope for rep: `ownerUserId = me` (or assigned semantics if added later)
- `GET /leads/:id`
  - Permission: `leads.read`
  - Scope for rep: same rule
- `POST /leads`
  - Permission: `leads.write`
  - Scope for rep: force `ownerUserId = me`
- `PATCH /leads/:id`
  - Permission: `leads.write`
  - Scope for rep: only own lead
- `PATCH /leads/:id/move`
  - Permission: `leads.write`
  - Scope for rep: only own lead
- `PATCH /leads/:id/convert`
  - Permission: `leads.write`
  - Scope for rep: only own lead
- `PATCH /leads/:id/assign`
  - Permission: `leads.manage`
  - Scope: manager only
- `PATCH /leads/bulk`
  - Permission: `leads.manage`
  - Scope: manager only
- `DELETE /leads/:id`
  - Permission: `leads.manage`
  - Scope: manager only

### Quotes
- `GET /quotes`, `GET /quotes/:id`
  - Permission: `quotes.read`
  - Scope for rep: `ownerUserId = me`
- `POST /quotes`
  - Permission: `quotes.write`
  - Scope for rep: force `ownerUserId = me`
- `PATCH /quotes/:id`
  - Permission: `quotes.write`
  - Scope for rep: only own quote
- `POST /quotes/:id/send`
  - Permission: `quotes.write`
  - Scope for rep: only own quote
- `POST /quotes/:id/convert-to-invoice`
  - Permission: `invoices.write`
  - Scope for rep: only own quote
- `DELETE /quotes/:id`
  - Permission: `quotes.manage`
  - Scope: manager/admin only

### Companies / Contacts
- `GET /companies`, `GET /companies/:id`
  - Permission: `companies.read`
  - Scope for rep: only companies related to own records/ownership
- `POST /companies`
  - Permission: `companies.write`
  - Scope for rep: create allowed with limited fields
- `PATCH /companies/:id`
  - Permission: `companies.write`
  - Scope for rep: only owned/related companies
- `DELETE /companies/:id`
  - Permission: `companies.manage`
  - Scope: manager/admin
- `POST /companies/import`
  - Permission: `imports.write`
  - Scope: off for rep by default

- `GET /contacts`, `GET /contacts/:id`
  - Permission: `contacts.read`
  - Scope for rep: `ownerUserId = me`
- `POST /contacts`
  - Permission: `contacts.write`
  - Scope for rep: create allowed, force owner to me if owner omitted
- `PATCH /contacts/:id`
  - Permission: `contacts.write`
  - Scope for rep: only own contact
- `PATCH /contacts/reassign`
  - Permission: `contacts.manage`
  - Scope: manager/admin
- `DELETE /contacts/:id`
  - Permission: `contacts.manage`
  - Scope: manager/admin
- `POST /contacts/import`
  - Permission: `imports.write`
  - Scope: off for rep by default

### Tasks
- `GET /tasks`, `GET /tasks/:id`, `GET /tasks/assignees`
  - Permission: `tasks.read`
  - Scope for rep: tasks where `assignedToUserId = me OR createdByUserId = me`
- `POST /tasks`
  - Permission: `tasks.write`
  - Scope for rep: create allowed, assignment policy below
- `PATCH /tasks/:id`, `PATCH /tasks/:id/move`
  - Permission: `tasks.write`
  - Scope for rep: task is mine (assignee or creator)
- `DELETE /tasks/:id`
  - Permission: `tasks.manage`
  - Scope: manager/admin

Assignment policy target for rep:
- Rep can assign tasks (to self and others in same tenant).
- Rep still cannot delete tasks.

### Activities
- `GET /activities`, `GET /activities/:id`
  - Permission: `activities.read`
  - Scope for rep: only activities attached to entities visible to rep
- `POST /activities`
  - Permission: `activities.write`
  - Scope for rep: create only for visible entities

### Products / Import / Settings
- `GET /products`
  - Permission: `products.read`
  - Scope: tenant-wide read
- `POST /products/import`
  - Permission: `imports.write`
  - Scope: off for rep by default
- `GET /settings`
  - Permission: `settings.read`
  - Scope for rep UI: profile-only settings surface
- `/settings/members`, `/settings/roles`, `/settings/permissions`
  - Permission: `users.*`
  - Scope: denied for rep

## 4) Backend Scope Rule Snippets

Use in each service:

```ts
const isManage = hasPermission(actor, '<domain>.manage');
if (!isManage) {
  where.ownerUserId = actor.userId;
}
```

Tasks:

```ts
if (!isManage) {
  where.OR = [{ assignedToUserId: actor.userId }, { createdByUserId: actor.userId }];
}
```

## 5) Current Code Status (Gap List)
- Leads scope: mostly implemented.
- Contacts scope: list is scoped; `getOne` needs actor scope check.
- Companies scope: mostly implemented.
- Tasks scope: implemented; rep can assign to active tenant members.
- Quotes scope: missing in service/controller (critical).
- Activities scope: missing in service/controller (critical).
- Dashboard manager endpoints: currently accessible by `dashboard.read`; should be tightened to `dashboard.manage` if required.

## 6) Priority Patch Order
1. Quotes service/controller actor-scope enforcement.
2. Activities service/controller actor-scope enforcement.
3. Contacts `getOne` actor-scope check.
4. Optional hardening: manager dashboard endpoints to `dashboard.manage`.
