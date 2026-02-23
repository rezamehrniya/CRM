# Changelog (Hard Reset Demo Overwrite)

## Included

- Hardened demo seed env handling and production override logic (`ALLOW_DEMO_SEED`).
- Enforced demo users in seed flow:
  - owner@demo.com / 12345678
  - seller@demo.com / 12345678
- Seed script made Docker runtime compatible via CommonJS ts-node options.
- Added backend script `seed:demo`.
- Wired demo env pass-through in compose files:
  - `docker-compose.yml`
  - `docker-compose.dev.yml`
- Added ops docs:
  - `ops/LOCAL-VERIFY.md`
  - `ops/SEED.md`
  - `ops/SERVER-HARD-RESET-RUNBOOK.md`
- Added release metadata:
  - `release/VERSION.txt`
  - `release/ENV.example`

## Verification

- Docker stack healthy after clean boot.
- Demo seed completed with success log.
- Owner and seller API login both successful.
- API totals confirmed demo data exists.
