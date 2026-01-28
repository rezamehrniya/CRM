# Sakhtar CRM

CRM چندمستاجری با برند Sakhtar — دامنه: **crm.sakhtar.net**

## ساختار پروژه

- **backend/** — API با NestJS، Prisma، PostgreSQL
- **frontend/** — SPA با React، Vite، Tailwind
- **docs/** — اسناد محصول، معماری و چک‌لیست‌ها
- **OpenSpec-main/** — فریم‌ورک Spec و مرجع داکیومنت و workflowهای AI-assisted (رجوع به [OpenSpec-main/README.md](OpenSpec-main/README.md))

## مستندات و رفرنس

- **اسناد داخلی پروژه:** [docs/](docs/) — شامل AUTH-ARCHITECTURE و سایر specها
- **Spec و داکیومنت (مرجع):** پوشه **[OpenSpec-main](OpenSpec-main/)** به‌عنوان مرجع نگارش spec و workflow استفاده می‌شود:
  - [مفاهیم و فلسفه](OpenSpec-main/docs/concepts.md)
  - [شروع کار و ساختار](OpenSpec-main/docs/getting-started.md)
  - [Workflowها و الگوها](OpenSpec-main/docs/workflows.md)
  - [دستورات و CLI](OpenSpec-main/docs/commands.md) و [CLI مرجع](OpenSpec-main/docs/cli.md)

برای تعریف تغییرات و specهای جدید می‌توان از همان اصول OpenSpec (proposal → specs → design → tasks) و در صورت نصب CLI از دستورات `/opsx:new`, `/opsx:ff`, `/opsx:apply` استفاده کرد.

## پیش‌نیازها

- Node.js 18+
- PostgreSQL

## راه‌اندازی

### Backend

```bash
cd backend
copy .env.example .env
# تنظیم DATABASE_URL و JWT_SECRET در .env
npm install
npx prisma generate
npx prisma migrate dev
npm run start:dev
```

API روی `http://localhost:3000` با prefix `/api`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

اپ روی `http://localhost:5173`. مسیر دمو: `http://localhost:5173/t/demo/app`

## مسیرها

- **اپ:** `/t/:tenantSlug/app`
- **API:** `/api/t/:tenantSlug/...`
