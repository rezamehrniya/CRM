# Leads API Contract (Manager vs Rep)

Last updated: 2026-02-23  
API base: `/api/t/:tenantSlug`

## 1) Goal
Execution-ready API contract for Leads page with role split:
- `SALES_MANAGER` (team-wide control)
- `SALES_REP` (own workload only)

This contract is aligned with current backend controllers/services and explicitly marks recommended extensions.

## 2) Auth, Guards, RBAC
- Guards: `JwtAuthGuard` + `PermissionsGuard`
- Tenant scope: `:tenantSlug` resolved by tenant middleware
- Core lead permissions:
  - `leads.read`
  - `leads.write`
  - `leads.manage`

Role defaults (from `permissions.constants.ts`):
- `SALES_MANAGER`: has `leads.manage`
- `SALES_REP`: has `leads.read`, `leads.write` (no `leads.manage`)

## 3) Scope Rules (Canonical)
- Manager scope:
  - Full tenant scope for leads.
- Rep scope:
  - Current behavior in service: can read/update leads where:
    - `ownerUserId = me` OR
    - `ownerUserId IS NULL`
  - Rep cannot assign/reassign and cannot delete (missing `leads.manage`).

## 4) Lead Status Model
Allowed statuses:
- `NEW`
- `CONTACTED`
- `QUALIFIED`
- `CONVERTED`
- `LOST`

Open statuses (used by overdue logic):
- `NEW`, `CONTACTED`, `QUALIFIED`

## 5) Endpoints: Leads

### 5.1 List leads + KPIs + funnel
`GET /leads`

Permission:
- `leads.read`

Query params:
- `q` string
- `page` number (default `1`)
- `pageSize` number (default `25`, max `500`)
- `status` csv or single (`NEW,QUALIFIED`)
- `source` csv or single
- `owner`:
  - `me`
  - `all`
  - specific `userId`
- `overdue` boolean-like (`true/false/1/0`)
- `activityDays` number

Response:
```json
{
  "data": [
    {
      "id": "lead_id",
      "firstName": "Ali",
      "lastName": "Rezaei",
      "phone": "0912...",
      "email": null,
      "companyName": "Acme",
      "source": "Website",
      "status": "NEW",
      "notes": null,
      "followUpAt": "2026-02-23T08:00:00.000Z",
      "ownerUserId": "user_id",
      "createdAt": "2026-02-20T10:00:00.000Z",
      "updatedAt": "2026-02-22T10:00:00.000Z",
      "owner": {
        "id": "user_id",
        "firstName": "Sara",
        "lastName": "Ahmadi",
        "displayName": "Sara Ahmadi",
        "avatarUrl": null,
        "email": null,
        "phone": "0912...",
        "role": "MEMBER"
      }
    }
  ],
  "total": 120,
  "page": 1,
  "pageSize": 25,
  "kpis": {
    "leadsNewToday": 6,
    "qualifiedCount": 14,
    "avgFirstContactHours": 7,
    "overdueFollowUps": 19
  },
  "funnel": [
    { "status": "NEW", "count": 30, "overdueCount": 8 },
    { "status": "CONTACTED", "count": 25, "overdueCount": 5 },
    { "status": "QUALIFIED", "count": 14, "overdueCount": 6 },
    { "status": "CONVERTED", "count": 20, "overdueCount": 0 },
    { "status": "LOST", "count": 31, "overdueCount": 0 }
  ]
}
```

### 5.2 Owners list (for filters/assignment)
`GET /leads/owners`

Permission:
- `leads.read`

Scope:
- Manager: all active members in tenant
- Rep: only self

### 5.3 Get single lead
`GET /leads/:id`

Permission:
- `leads.read`

Scope:
- Manager: any tenant lead
- Rep: own or unassigned lead

### 5.4 Create lead
`POST /leads`

Permission:
- `leads.write`

Body:
```json
{
  "firstName": "Ali",
  "lastName": "Rezaei",
  "phone": "0912...",
  "email": null,
  "companyName": "Acme",
  "source": "Website",
  "status": "NEW",
  "notes": "Initial note",
  "followUpAt": "2026-02-25T12:00:00.000Z",
  "ownerUserId": "optional_user_id"
}
```

Owner behavior:
- Manager can set `ownerUserId`
- Rep owner is forced to self

### 5.5 Update lead
`PATCH /leads/:id`

Permission:
- `leads.write`

Body: partial of create body

Constraints:
- Rep cannot update `ownerUserId` (403 `FORBIDDEN_ASSIGN`)

### 5.6 Move lead (Kanban DnD)
`PATCH /leads/:id/move`

Permission:
- `leads.write`

Body:
```json
{
  "status": "QUALIFIED",
  "position": 1
}
```

Notes:
- Current backend uses `status`; `position` is accepted but ignored.

### 5.7 Convert lead
`PATCH /leads/:id/convert`

Permission:
- `leads.write`

Behavior:
- sets status to `CONVERTED`
- appends auto-note: `[AUTO] lead converted`

### 5.8 Assign lead (manager action)
`PATCH /leads/:id/assign`

Permission:
- `leads.manage`

Body:
```json
{ "ownerUserId": "target_user_id_or_null" }
```

### 5.9 Bulk update (manager action)
`PATCH /leads/bulk`

Permission:
- `leads.manage`

Body:
```json
{
  "ids": ["lead_1", "lead_2"],
  "status": "CONTACTED",
  "ownerUserId": "optional_user_id_or_null"
}
```

### 5.10 Delete lead (manager action)
`DELETE /leads/:id`

Permission:
- `leads.manage`

Response:
```json
{ "ok": true }
```

## 6) Timeline Integration (Lead Drawer tab)

### 6.1 Lead timeline feed
`GET /timeline/lead/:leadId`

Permission:
- `timeline.read`

Query:
- `from` ISO/date
- `to` ISO/date
- `type` csv in:
  - `TASK,CALL,SMS,QUOTE,NOTE,STAGE,ASSIGN,LEAD_FOLLOWUP`
- `limit` (default `30`, max `100`)
- `cursor` (base64 cursor)

Response:
```json
{
  "lead": { "id": "lead_id", "fullName": "Ali Rezaei", "status": "NEW" },
  "summary": {
    "totalItems": 32,
    "overdueTasks": 3,
    "waitingQuotes": 2,
    "lastTouchAt": "2026-02-23T11:00:00.000Z",
    "lastTouchType": "CALL"
  },
  "items": [
    {
      "id": "call:abc",
      "type": "CALL",
      "ts": "2026-02-23T10:00:00.000Z",
      "title": "Inbound call",
      "subtitle": "Agent Name • ANSWERED • 120s",
      "status": "ANSWERED",
      "preview": "09.. -> 09..",
      "ref": { "callId": "abc" },
      "meta": {}
    }
  ],
  "nextCursor": "base64_or_null"
}
```

Scope behavior:
- Rep sees only timeline artifacts within their effective scope (calls/sms/tasks/quotes team permissions are checked).

## 7) Quote Integration (Convert to quote/contract flow)

Current quote controller alias:
- `/deals` and `/quotes` point to same controller

Used endpoints:
- `GET /quotes` (`quotes.read`)
- `GET /quotes/:id` (`quotes.read`)
- `POST /quotes` (`quotes.write`)
- `POST /quotes/:id/send` (`quotes.write`)
- `PATCH /quotes/:id` (`quotes.write`)
- `POST /quotes/:id/convert-to-invoice` (`invoices.write`)
- `DELETE /quotes/:id` (`quotes.manage`)

Important gap:
- Quotes service currently has no actor-based owner scope filtering.
- For strict Rep isolation, add actor scope to quotes endpoints (same pattern as leads/tasks).

## 8) Reminders Integration (Overdue widgets)

`GET /reminders/summary?scope=me|team`

Permission:
- `dashboard.read`

Scope:
- Manager can request `team`
- Rep forced to `me`

Includes:
- overdue tasks
- overdue leads (`followUpAt < now` and open lead statuses)
- waiting quotes

## 9) Manager vs Rep Capability Matrix

| Capability | Manager | Rep |
|---|---:|---:|
| Read all tenant leads | Yes | No |
| Read own leads | Yes | Yes |
| Read unassigned leads | Yes | Yes (current behavior) |
| Create lead | Yes | Yes |
| Edit own lead | Yes | Yes |
| Move stage | Yes | Yes |
| Convert lead | Yes | Yes |
| Assign/Reassign | Yes | No |
| Bulk update | Yes | No |
| Delete lead | Yes | No |
| Export all leads | Yes (UI/API extension) | No |

## 10) Error Contract
- `401` unauthenticated
- `403` forbidden (`FORBIDDEN`, `FORBIDDEN_ASSIGN`)
- `404` not found (`LEAD_NOT_FOUND` or masked not-found on unauthorized detail access)
- `400` bad request (`MISSING_NAME`, `EMPTY_IDS`, `NO_CHANGES`, etc.)

## 11) Recommended Extensions (to match target UX)

1. `POST /leads/:id/convert-to-quote`
- Creates a quote/deal directly from lead and links lead->quote.

2. Stage analytics payload in `GET /leads`:
- `sumAmount`, `avgDaysInStage`, `conversionFromPrevPct` per stage.

3. Strict rep scope toggle:
- option to exclude unassigned leads for reps (`ownerUserId = me` only).

4. DnD policy guard:
- if needed, enforce "rep cannot move to LOST" in backend rule layer.

