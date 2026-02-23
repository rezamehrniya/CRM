# Seed Guide

Seed file: `backend/prisma/seed.ts`

## Behavior

- Idempotent creation/update for demo tenant/users and demo entities.
- Production safety guard:
  - refuses in `NODE_ENV=production` unless `ALLOW_DEMO_SEED` is truthy (`true|1|yes|on`).
- Demo credentials enforced each run:
  - `owner@demo.com / 12345678`
  - `seller@demo.com / 12345678`

## Env vars

- `DEMO_SEED` (used by container startup logic)
- `ALLOW_DEMO_SEED` (required in production-like env)
- `DEMO_TENANT_SLUG` (default: `demo`)
- `DEMO_OWNER_EMAIL` (default: `owner@demo.com`)
- `DEMO_SELLER_EMAIL` (default: `seller@demo.com`)
- `DEMO_DEFAULT_PASSWORD` (default: `12345678`)

## Commands

From backend container:

```bash
npm run seed:demo
```

From backend host dir:

```bash
npm run seed:demo
# or
npx prisma db seed
```

## Docker startup

`backend/docker-entrypoint.sh` behavior:

- runs migrations (`prisma migrate deploy`)
- if `DEMO_SEED=1`, runs seed command
- starts API

