# DASHBOARD V2

## Goals
- Manager-first dashboard for sales big picture, bottlenecks, team performance, and targets.
- Rep-first dashboard for daily execution and reminders.
- Phase 0 revenue model without SalesInvoice.

## Roles
- `ADMIN`, `SALES_MANAGER`: manager dashboard.
- `SALES_REP`: rep dashboard.
- Fallback by permission:
  - Manager view: `dashboard.manage`.
  - Rep view: `dashboard.read`.

## Revenue Mode
- Phase 0: `PROXY_QUOTE_SIGNED`.
- Definition: Revenue proxy is sum of quotes mapped to `SIGNED_CONTRACT` within range.
- UI must show this is proxy revenue.
- Phase 1 (future): `REAL_SALES_INVOICE` from paid sales invoices.

## Endpoints
- `GET /t/:tenantSlug/dashboard/manager/overview?from&to`
- `GET /t/:tenantSlug/dashboard/manager/team?from&to&sortBy`
- `GET /t/:tenantSlug/dashboard/rep?from&to`

## Canonical Funnel Stages
1. `COLD`
2. `WARM`
3. `QUALIFIED`
4. `QUOTE_SENT`
5. `NEGOTIATION`
6. `SIGNED_CONTRACT`

## KPI Rules (Phase 0)
- Revenue proxy: signed-contract quotes in range.
- Pipeline value: open quotes (`SENT`, `APPROVED`) not canceled.
- Overdue follow-ups:
  - tasks: `dueAt < now && status != DONE`
  - leads: `followUpAt < now && stage not in (SIGNED_CONTRACT, CLOSED_LOST)`
- Quote conversion proxy:
  - `SIGNED_CONTRACT / (SENT + APPROVED)`

## Manager Layout (12 columns)
- Row 1: 4 hero cards.
- Row 2: KPI compact cards.
- Row 3: funnel (7) + revenue trend (5).
- Row 4: team performance (7) + quote donut (5).
- Row 5: action center 3 columns.

## Rep Layout (12 columns)
- Row 1: today strip.
- Row 2: reminders (7) + my target (5).
- Row 3: my funnel snapshot (7).

## Navigation
- Stage click: `/leads?stage={stageKey}`
- Rep click: `/leads?owner={userId}`
- Action item click routes to lead/task/quote detail.

## Definition of Done
- Role-aware render works.
- Tenant scope works.
- No permission flash.
- Skeleton loading and empty states exist.
- Revenue mode is visible (`Proxy` vs `Real`).
