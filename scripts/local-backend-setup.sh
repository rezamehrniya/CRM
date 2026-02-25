#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root/backend"

npx prisma generate
npx prisma migrate dev
npx prisma migrate deploy
npm run start:dev
