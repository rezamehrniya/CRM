#!/bin/sh
set -eu

echo "[entrypoint] applying prisma migrations..."
npx prisma migrate deploy

if [ "${DEMO_SEED:-0}" = "1" ]; then
  echo "[entrypoint] DEMO_SEED=1 -> running demo seed"
  ALLOW_DEMO_SEED=true npm run seed
fi

echo "[entrypoint] starting API"
exec node dist/main.js
