# Sakhtar CRM — Backend (NestJS)

API چندمستاجری با مسیر `/api/t/:tenantSlug/...`.

## مستندات و رفرنس

- **Auth و tenant:** [../docs/AUTH-ARCHITECTURE.md](../docs/AUTH-ARCHITECTURE.md)
- **Spec و تغییرات (مرجع):** پوشه [../OpenSpec-main/](../OpenSpec-main/) — برای نگارش spec و workflow به [concepts](../OpenSpec-main/docs/concepts.md) و [getting-started](../OpenSpec-main/docs/getting-started.md) رجوع شود.

## راه‌اندازی

```bash
copy .env.example .env
# DATABASE_URL و JWT_SECRET را تنظیم کنید
npm install
npx prisma generate
npx prisma migrate dev
npm run start:dev
```

## ساختار کلی

- **Tenant:** middleware از مسیر `t/:tenantSlug`؛ `req.tenant`
- **Auth:** JWT (Bearer) + refresh در HttpOnly cookie با Path tenant-scoped؛ Guardها در [AUTH-ARCHITECTURE](../docs/AUTH-ARCHITECTURE.md)
- **مدل‌ها:** Prisma در `prisma/schema.prisma`؛ همه جداول عملیاتی با `tenantId`

## Import Demo Data

Use the bundled export file `prisma/my-hardcode.json` to reset and import the `demo` tenant data.

```bash
cd backend
ALLOW_PROD_IMPORT=true npm run import:demo
```

You can also pass a custom file:

```bash
cd backend
ALLOW_PROD_IMPORT=true ts-node scripts/import-demo-export.ts /absolute/path/to/file.json
```
