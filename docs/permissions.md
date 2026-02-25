# Permissions Canonical Reference

This file is the lightweight canonical reference for current RBAC keys and critical route mapping.

Authoritative source in code:
- `backend/src/auth/permissions.constants.ts`

## Permission Keys

- `dashboard.read`
- `contacts.read`
- `contacts.write`
- `contacts.manage`
- `companies.read`
- `companies.write`
- `companies.manage`
- `leads.read`
- `leads.write`
- `leads.manage`
- `tasks.read`
- `tasks.write`
- `tasks.manage`
- `activities.read`
- `activities.write`
- `activities.manage`
- `quotes.read`
- `quotes.write`
- `quotes.manage`
- `invoices.read`
- `invoices.write`
- `invoices.manage`
- `products.read`
- `products.write`
- `products.manage`
- `imports.read`
- `imports.write`
- `imports.manage`
- `users.read`
- `users.write`
- `users.manage`
- `settings.read`
- `settings.write`
- `settings.manage`

## Default Roles

- `ADMIN`
- `SALES_MANAGER`
- `SALES_REP`
- `VIEWER`

## Critical Route Enforcement (Backend)

- `GET /t/:tenantSlug/quotes` -> `quotes.read`
- `POST /t/:tenantSlug/quotes` -> `quotes.write`
- `DELETE /t/:tenantSlug/quotes/:id` -> `quotes.manage`
- `POST /t/:tenantSlug/quotes/:id/send` -> `quotes.write`
- `POST /t/:tenantSlug/quotes/:id/convert-to-invoice` -> `invoices.write`
- `PATCH /t/:tenantSlug/leads/:id/assign` -> `leads.manage`
- `POST /t/:tenantSlug/products/import` -> `imports.write`
- `GET /t/:tenantSlug/settings` -> `settings.read`

## Backward Compatibility

- Quotes controller supports both legacy and new paths:
  - `/t/:tenantSlug/deals`
  - `/t/:tenantSlug/quotes`

- Frontend app routes support both:
  - `/t/:tenantSlug/app/deals`
  - `/t/:tenantSlug/app/quotes`
