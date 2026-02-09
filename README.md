# Sakhtar CRM

CRM چندمستاجری با برند Sakhtar — دامنه: **crm.sakhtar.net**

## ساختار پروژه

- **backend/** — API با NestJS، Prisma، PostgreSQL
- **frontend/** — SPA با React، Vite، Tailwind
- **docs/** — اسناد محصول، معماری و چک‌لیست‌ها
- **OpenSpec-main/** — فریم‌ورک Spec و مرجع داکیومنت و workflowهای AI-assisted (رجوع به [OpenSpec-main/README.md](OpenSpec-main/README.md))

## مستندات و رفرنس

- **اسناد داخلی پروژه:** [docs/](docs/) — شامل AUTH-ARCHITECTURE و سایر specها
- **OpenSpec (Spec و workflow):**
  - **[راهنمای OpenSpec — فارسی](docs/OPENSPEC-GUIDE.md)** — مفاهیم، workflow در این پروژه، لینک به مرجع کامل
  - **ایندکس داکیومنت OpenSpec:** [docs/openspec/](docs/openspec/README.md)
  - **مرجع کامل (انگلیسی)** در پوشه [OpenSpec-main](OpenSpec-main/):
    - [مفاهیم و فلسفه](OpenSpec-main/docs/concepts.md)
    - [شروع کار و ساختار](OpenSpec-main/docs/getting-started.md)
    - [Workflowها و الگوها](OpenSpec-main/docs/workflows.md)
    - [دستورات و CLI](OpenSpec-main/docs/commands.md) و [CLI مرجع](OpenSpec-main/docs/cli.md)

برای تعریف تغییرات و specهای جدید از اصول OpenSpec (proposal → specs → design → tasks) استفاده کنید؛ در صورت نصب CLI از دستورات `/opsx:new`, `/opsx:ff`, `/opsx:apply` می‌توان استفاده کرد.

## پیش‌نیازها

- **Node.js 18+** (ترجیحاً 20)
- **PostgreSQL** (برای راه‌اندازی بدون داکر)
- یا **Docker / Docker Compose** (برای راه‌اندازی همه‌چیز با داکر)

---

## راه‌اندازی لوکال (بدون داکر)

### ۱. دیتابیس

PostgreSQL را روشن کنید و یک دیتابیس بسازید:

```bash
# مثال با psql
psql -U postgres -c "CREATE DATABASE sakhtar_crm;"
```

### ۲. Backend

```bash
cd backend
copy .env.example .env   # در ویندوز
# یا: cp .env.example .env   # در لینوکس/مک
```

فایل **`.env`** را باز کنید و مقدارها را تنظیم کنید:

- `DATABASE_URL` — مثلاً: `postgresql://postgres:YOUR_PASSWORD@localhost:5432/sakhtar_crm`
- `JWT_SECRET` — حداقل ۳۲ کاراکتر (برای production حتماً عوض کنید)
- `PORT` — پیش‌فرض 3000

سپس:

```bash
npm install
npx prisma generate
npx prisma migrate dev    # ساخت/اعمال migrationها
npm run start:dev
```

API روی **http://localhost:3000** با prefix **/api** در دسترس است.

### ۳. Frontend

در یک ترمینال دیگر:

```bash
cd frontend
npm install
npm run dev
```

اپ روی **http://localhost:5173** بالا می‌آید. مسیر پیش‌فرض اپ: **http://localhost:5173/t/demo/app** (صفحهٔ لاگین/داشبورد).

### ۴. (اختیاری) ساخت tenant و کاربر دمو

اگر دیتابیس خالی است، برای تست لاگین باید یک tenant (مثلاً با slug `demo`) و یک کاربر با پسورد بسازید. می‌توانید از Prisma Studio استفاده کنید:

```bash
cd backend
npx prisma studio
```

در Prisma Studio جداول `Tenant`, `User`, `Membership` را پر کنید؛ پسورد کاربر را با bcrypt/bcryptjs هش کنید و در `User.passwordHash` ذخیره کنید.

**یا با اسکریپت seed (سریع):**

```bash
cd backend
npx prisma db seed
```

این دستور tenant با slug `demo`، کاربر `owner@demo.com` با رمز `12345678` و Membership با نقش OWNER می‌سازد. بعد از آن می‌توانی با این کاربر در `/t/demo/app` لاگین کنی.

---

## راه‌اندازی با Docker

همه‌چیز (PostgreSQL + Backend + Frontend) در کانتینر. بعد از پاک شدن کانتینر/ولوم‌ها همین دستورات کافی است:

```bash
# از روت پروژه
docker compose build
docker compose up -d
```

- **اپ:** http://localhost:8080 (مثلاً http://localhost:8080/t/demo/app)
- **API:** http://localhost:3001/api (پورت روی host = 3001)

Backend به‌صورت خودکار هنگام استارت اجرا می‌کند: `prisma migrate deploy` و `prisma db seed`. یعنی با اولین بالا آمدن، دیتابیس migrate و tenant دمو به‌همراه کاربران و داده‌های ماک ساخته می‌شود و نیازی به اجرای دستی seed نیست.

(اختیاری) برای override کردن `JWT_SECRET` در داکر، در روت پروژه فایل `.env` بسازید و مقدار `JWT_SECRET=...` بگذارید.

اسکریپت‌های روت برای داکر: `npm run docker:build`, `npm run docker:up`, `npm run docker:down`, `npm run docker:logs`.

**اگر بیلد روی «resolving provenance» گیر کرد (ویندوز/WSL):** BuildKit گاهی روی ویندوز در این مرحله طول می‌کشد یا گیر می‌کند. می‌توانی بیلد را با بیلدر قدیمی بدون attestation انجام بدهی:

```bash
# لینوکس/مک/WSL
DOCKER_BUILDKIT=0 docker compose build
```

در **PowerShell (ویندوز)**:

```powershell
$env:DOCKER_BUILDKIT=0; docker compose build
```

بعد از بیلد، `docker compose up -d` را مثل قبل اجرا کن.

### دیدن تغییرات کد با داکر (حالت توسعه)

اگر با داکر کار می‌کنی و می‌خواهی **هر تغییری که در کد می‌دهی بلافاصله دیده شود** (بدون ری‌بیلد)، از compose مخصوص توسعه استفاده کن:

```bash
# از روت پروژه — اولین بار یا بعد از تغییر schema.prisma حتماً با --no-cache بکند را بیلد کن
docker compose -f docker-compose.yml -f docker-compose.dev.yml build backend --no-cache
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

اگر بکند با خطای Prisma (`libssl.so.1.1` یا `libquery_engine-...`) کرش کرد، همان دو خط بالا را بزن تا باینری درست (OpenSSL 3) داخل ایمیج برود.

- **Backend:** پوشه‌های `backend/src` و `backend/prisma` روی کانتینر mount شده‌اند؛ Nest با `--watch` هر تغییر را می‌گیرد.
- **Frontend:** کل پوشه‌ی `frontend` mount است؛ Vite با HMR هر تغییر را در مرورگر نشان می‌دهد.

آدرس‌ها:

- **اپ:** http://localhost:5173 (مثلاً http://localhost:5173/t/demo/app)
- **API:** http://localhost:3001

برای متوقف کردن: `docker compose -f docker-compose.yml -f docker-compose.dev.yml down`.

---

## مسیرها

- **اپ:** `/t/:tenantSlug/app`
- **API:** `/api/t/:tenantSlug/...`
