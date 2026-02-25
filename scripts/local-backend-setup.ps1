Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Join-Path $PSScriptRoot ".."
Push-Location $repoRoot
try {
  Set-Location (Join-Path $repoRoot "backend")
  npx prisma generate
  npx prisma migrate dev
  npx prisma migrate deploy
  npm run start:dev
} finally {
  Pop-Location
}
