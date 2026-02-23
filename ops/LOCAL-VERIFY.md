# Local Verify (Hard Reset Demo Overwrite)

Timestamp: 2026-02-23 15:16:44 +03:30
Commit: `fdbe29a7ba64245ef36ffbabd84c3cdf572a6914`

## 1) Clean boot commands executed

```bash
docker compose down -v
docker compose build --no-cache
docker compose up -d
```

## 2) Runtime status

```bash
docker compose ps
# backend: healthy (3001->3000)
# frontend: healthy (8080->80)
# postgres: healthy (15432->5432)
```

## 3) Seed execution proof

Auto-seed was disabled in current runtime env (`DEMO_SEED=0`), so seed was executed explicitly:

```bash
docker compose exec -T backend sh -lc 'npm run seed:demo'
```

Observed output:

```text
Seed OK: tenant=demo, manager=owner@demo.com, seller=seller@demo.com, dashboard demo data created (leads/deals/tasks/activities/todos/calls/sms)
```

## 4) Auth verification (programmatic)

- `POST /api/t/demo/auth/login` with `owner@demo.com / 12345678` => success, role `SALES_MANAGER`
- `POST /api/t/demo/auth/login` with `seller@demo.com / 12345678` => success, role `SALES_REP`

## 5) Demo data verification (programmatic via API)

Using owner token and `pageSize=1`:

- contacts: 21
- companies: 11
- leads: 30
- deals: 25
- tasks: 21
- activities: 26

## 6) Backend logs (tail)

Recent logs show:

- migrations applied
- routes mapped
- `Nest application successfully started`
- `Sakhtar CRM API listening on http://localhost:3000`

