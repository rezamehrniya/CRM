# Sales Rep Panel PRD (Execution Ready)

Last update: 2026-02-21

## 1) Product Goal
Sales rep should be able to run daily sales execution without manager/admin surfaces:
- know today priorities
- move leads through funnel
- create/send quotes
- create/assign tasks
- work only on own scoped data

## 2) IA (Sidebar)
1. Dashboard
2. Follow-ups (Inbox)
3. Leads
4. Quotes
5. Customers (Companies + Contacts)
6. Tasks Board
7. Activities
8. Import (optional, permission-based)
9. Profile Settings

Hidden for rep:
- member management
- access management
- sensitive settings

## 3) Core Screens

### 3.1 Rep Dashboard
- Today strip:
  - tasks today
  - overdue
  - leads follow-up today
  - quotes waiting response
- Reminders:
  - urgent
  - today
  - waiting response
  - upcoming
- My target:
  - target
  - achieved
  - remaining
  - pace
- Mini funnel snapshot:
  - stage counts
  - click -> `/leads?stage=<key>&owner=me`

### 3.2 Follow-ups Inbox
- Header: search + quick date range
- Tabs:
  - overdue
  - today
  - waiting
  - this week
- Filters:
  - type (`LEAD|TASK|QUOTE`)
  - lead stage
  - task priority
- Item actions:
  - open
  - call/whatsapp
  - mark done (task)
  - move stage (lead)
  - create task

### 3.3 Leads
- Tab A: vertical funnel (`COLD -> SIGNED_CONTRACT`)
- Tab B: worklist (overdue/today/qualified/quote sent)
- Rep default scope: `owner=me`

### 3.4 Quotes
- Tabs:
  - draft
  - sent
  - approved/converted
  - canceled
- Create flow:
  - company/contact
  - line items
  - save draft
  - send PDF (`quotes.write`)

### 3.5 Customers
- Account cards:
  - owner
  - open leads
  - open quotes
  - last activity
- Detail tabs:
  - overview
  - contacts
  - leads
  - quotes
  - tasks
  - activity

### 3.6 Tasks Board
- Tabs:
  - my board
  - team board (optional)
  - assigned by me
- Card:
  - due date
  - priority
  - refs
  - assignee
- Rep can assign tasks; rep cannot delete tasks.

### 3.7 Activities Timeline
- Unified timeline of calls/notes/status changes/quote events/task completions.

## 4) Permission + Scope
Authoritative matrix:
- `docs/specs/SALES-REP-ENDPOINT-SCOPE-MATRIX.md`

## 5) Acceptance Criteria
- rep only sees rep sidebar items
- no permission flash in UI
- dashboard/inbox show merged reminders from `tasks.dueAt` and `leads.followUpAt`
- all list/detail endpoints enforce rep scope in backend
- forbidden routes return `403`; unauthenticated returns `401`
- quote send works with `quotes.write`

## 6) Implementation Sequence
1. Backend scope hardening (quotes, activities, contacts detail).
2. Inbox API aggregation endpoint.
3. Rep Dashboard + Inbox UI.
4. QA matrix per role (`ADMIN`, `SALES_MANAGER`, `SALES_REP`, `VIEWER`).
