# SERVER HARD RESET RUNBOOK (sakhtar-crm-backend)

Target

- Service: `sakhtar-crm-backend`
- Working dir: `/home/arma/Crm/CRM/CRM-main/backend`
- Env file: `/home/arma/Crm/CRM/CRM-main/backend/.env`
- Port: `10808`

## 1) Backup (mandatory)

```bash
set -euo pipefail
TS="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="/root/backups/crm_${TS}"
mkdir -p "$BACKUP_DIR"

cp -a /home/arma/Crm/CRM/CRM-main/backend/.env "$BACKUP_DIR/backend.env.bak" || true

# Optional code backup
cd /home/arma/Crm/CRM/CRM-main
tar -czf "$BACKUP_DIR/backend_current_code.tgz" backend --warning=no-file-changed || true

# Optional DB backup if postgres is dockerized
PG_CID="$(docker ps --format '{{.ID}} {{.Image}} {{.Names}}' | awk 'tolower($0) ~ /postgres/ {print $1; exit}')"
if [ -n "${PG_CID:-}" ]; then
  docker exec -t "$PG_CID" sh -lc "pg_dumpall -U postgres" > "$BACKUP_DIR/pg_dumpall.sql" 2>&1 || true
fi
```

## 2) Stop service

```bash
sudo systemctl stop sakhtar-crm-backend
sudo systemctl status sakhtar-crm-backend --no-pager || true
```

## 3) Deploy exact tagged release

```bash
cd /home/arma/Crm/CRM/CRM-main
git fetch --all --prune
git checkout <TAG>
git reset --hard <TAG>
```

## 4) Install/build backend

```bash
cd /home/arma/Crm/CRM/CRM-main/backend
rm -rf node_modules
npm ci
npm run build
```

## 5) Apply DB schema

```bash
cd /home/arma/Crm/CRM/CRM-main/backend
if [ -d prisma/migrations ]; then
  npx prisma migrate deploy
else
  npx prisma db push
fi
```

## 6) Force demo seed

```bash
cd /home/arma/Crm/CRM/CRM-main/backend
ALLOW_DEMO_SEED=1 DEMO_SEED=1 DEMO_DEFAULT_PASSWORD=12345678 npm run seed:demo
# fallback:
# ALLOW_DEMO_SEED=1 DEMO_SEED=1 npx prisma db seed
```

Expected users:

- `owner@demo.com / 12345678`
- `seller@demo.com / 12345678`

## 7) Start and health-check

```bash
sudo systemctl start sakhtar-crm-backend
sudo systemctl status sakhtar-crm-backend --no-pager
sudo journalctl -u sakhtar-crm-backend -n 200 --no-pager

curl -I http://127.0.0.1:10808
curl -I https://crm.sakhtar.net || true
```

## 8) Smoke login checklist

- Login owner: `owner@demo.com / 12345678`
- Login seller: `seller@demo.com / 12345678`
- Dashboard/Contacts/Companies/Leads/Deals/Tasks/Activities must show demo data.

## 9) Rollback

```bash
cd /home/arma/Crm/CRM/CRM-main
git fetch --all --prune
git checkout <PREVIOUS_TAG>
git reset --hard <PREVIOUS_TAG>

cd backend
npm ci
npm run build
sudo systemctl restart sakhtar-crm-backend
```

If DB rollback needed, restore backup SQL from `$BACKUP_DIR/pg_dumpall.sql`.
