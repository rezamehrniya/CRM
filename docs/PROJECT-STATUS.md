# وضعیت پروژه Sakhtar CRM

**تاریخ به‌روزرسانی:** ۱۴۰۴/۱۱/۰۹ (۲۰۲۶-۰۱-۲۹) — دمو Admin: Spec + Seed + صفحات جزئیات + Customer 360

---

## خلاصه

- **Backend:** NestJS + Prisma + PostgreSQL؛ API چندمستاجری با مسیر `/api/t/:tenantSlug/...`؛ Auth (JWT + cookie)، Tenant Middleware، Billing Guard، CRUD مخاطبین/شرکت‌ها، داشبورد.
- **Frontend:** React + Vite + Tailwind؛ مسیر `/t/:tenantSlug/app`؛ لاگین، داشبورد، مخاطبین/شرکت‌ها/معاملات/کارها (لیست + **صفحات جزئیات**)، فعالیت، **ورود داده** (CSV)، **تنظیمات** (Billing، Pipeline، Users، Lead Sources)؛ **Customer 360** در جزئیات شرکت؛ RBAC؛ Breadcrumb و اعداد فارسی (formatFaNum + فونت FaNum).
- **Docs:** اسناد ستون‌فقرات (Specها، UI-STANDARDS، CURSOR-WORKFLOW) و قالب‌های OpenSpec موجود است. CI برای backend و frontend (typecheck + build) فعال است.

---

## Backend

| بخش | وضعیت | توضیح |
|-----|--------|--------|
| Tenant | ✅ | Middleware با مسیر `t*`، رزولوشن slug → tenant، `req.tenant` |
| Auth | ✅ | Login، Refresh، Logout، Me؛ JWT ۱۵دق + cookie با Path محدود؛ JwtAuthGuard با چک TENANT_MISMATCH |
| Contacts | ✅ | CRUD با tenantId در همه queryها؛ pagination، search؛ **POST /import** (bulk تا ۲۰۰ ردیف) |
| Companies | ✅ | CRUD tenant-scoped؛ pagination، search؛ **GET /:id** با contacts و deals برای جزئیات؛ **POST /import** (bulk تا ۲۰۰ ردیف) |
| Dashboard | ✅ | KPIها (contactsCount، dealsCount، tasksDueToday، pipelineValue)؛ برای کاربر لاگین‌شده: myTasksDueToday، myDealsCount (فیلتر assignedToUserId / ownerUserId) |
| Billing | ✅ | Subscription، Usage، Invoices؛ فقط OWNER (RolesGuard + @Roles('OWNER'))؛ SubscriptionActiveGuard برای writeها (۴۰۳ SUBSCRIPTION_EXPIRED) |
| Settings | ✅ | GET /settings فقط OWNER؛ **GET /settings/members** لیست اعضای tenant (user + role + status) | 
| Prisma | ✅ | مدل‌های Tenant، User، Session، Membership، Contact، Company، Pipeline، Deal، Activity، Task، AuditLog، Subscription، Invoice |

**خطاهای رفع‌شده در session اخیر:** TypeScript در auth.controller (logout/me)، subscription.guard (FORBIDDEN به‌جای LOCKED)، tenant.middleware (نوع slug)، tenant.module (path رشته به‌جای RegExp).

---

## Frontend

| بخش | وضعیت | توضیح |
|-----|--------|--------|
| مسیرها | ✅ | داشبورد، **مخاطبین** (لیست + **جزئیات /contacts/:id**)، **شرکت‌ها** (لیست + **جزئیات /companies/:id**)، **معاملات** (لیست + **جزئیات /deals/:id**)، **کارها** (لیست + **جزئیات /tasks/:id**)، فعالیت، ورود داده، تنظیمات (Billing، Pipeline، Users، Lead Sources)؛ ProtectedRoute (OWNER) برای Settings |
| Layout | ✅ | سایدبار چپ (RTL)؛ ۲۸۰/۸۰ collapsed؛ آیکون Lucide؛ توگل تم و جستجو در هدر؛ فیلتر منو بر اساس نقش (RBAC) — Settings فقط OWNER؛ **موبایل:** سایدبار off-canvas (Sheet)، دکمه منو، backdrop، بستن با تغییر مسیر |
| Dashboard | ✅ | KPI کارت‌ها با KPICard؛ اسکلتون هنگام بارگذاری؛ Alert برای خطا؛ **فروشنده (MEMBER):** کارهای امروز من، معاملات من (SAK-016) |
| Contacts | ✅ | لیست (لینک نام + «مشاهده» به جزئیات)، جستجو، صفحه‌بندی، مودال ایجاد/ویرایش/حذف؛ **صفحه جزئیات** (مشخصات + لینک شرکت) |
| Companies | ✅ | لیست (لینک نام + «مشاهده» به جزئیات)، جستجو، مودال؛ **صفحه جزئیات** (مشخصات + **Customer 360** خلاصه + لیست مخاطبین و معاملات) |
| Deals | ✅ | لیست (لینک عنوان + «مشاهده» به جزئیات)، جستجو، مودال؛ **صفحه جزئیات** (مبلغ، مرحله، لینک مخاطب/شرکت) |
| Tasks | ✅ | لیست (لینک عنوان + «مشاهده» به جزئیات)، فیلتر وضعیت، مودال؛ **صفحه جزئیات** (وضعیت، موعد، لینک مخاطب/معامله) |
| Login | ✅ | صفحه لاگین با tenant در URL؛ پنل مدیر فروش (دمو) |
| Billing | ✅ | اشتراک + استفاده + **لیست صورتحساب‌ها** (GET /billing/invoices) |
| Settings Pipeline | ✅ | **مراحل Pipeline** — GET /pipelines، نمایش Pipelineها و Stageها (read-only) |
| Settings Users | ✅ | **مدیریت کاربران** — GET /settings/members، جدول اعضا (ایمیل/تلفن، نقش، وضعیت) |
| Settings Lead Sources | 🔸 | **منابع لید** — صفحهٔ placeholder «به زودی»؛ تعریف منابع در نسخهٔ بعد |
| UI System | ✅ | theme.css، aurora.css؛ glass-card؛ Sidebar active pill؛ Skeleton؛ Button، Input، Alert؛ **JalaliDate**؛ **PageBreadcrumb**؛ **formatFaNum + کلاس fa-num** (اعداد فارسی با فونت Vazirmatn FaNum) |

**استایل:** سایدبار با آیکون Lucide؛ PanelLeft/PanelLeftClose؛ Input، Button، Alert، Skeleton؛ pagination با Button؛ اسکلتون جداول و داشبورد. **RBAC:** توکن پس از لاگین؛ AuthContext با /auth/me و role؛ فیلتر منو (تنظیمات فقط OWNER)؛ ProtectedRoute برای /settings و /settings/billing؛ صفحه Settings با ۴ دسته (کاربران، Pipeline، منابع لید، اشتراک) + زیرصفحه‌های Billing، Pipeline، Users؛ خروج و نمایش کاربر/نقش در هدر. **خطا و Maintenance:** ErrorPage (maintenance، 404، 403، 401، 500، offline)؛ Error Boundary؛ مسیر /maintenance و /app/error?code=...

---

## مستندات و Spec

| سند | وضعیت |
|-----|--------|
| docs/proposals/ROLES-AND-PANELS.md | تأیید‌شده — نقش‌ها و پنل‌ها (Admin/Sales)، Customer 360° |
| docs/specs/RBAC-PANELS.md | پیشنویس — ماتریس دسترسی، Guard، فیلتر MEMBER؛ فرانت: AuthContext، فیلتر منو، محافظت Settings |
| docs/specs/PRD-PANELS-USER-STORIES.md | پیشنویس — User Stories + AC per panel |
| docs/specs/PERMISSION-MATRIX.md | ماتریس دسترسی (جدول نقش‌ها و بخش‌ها، routeهای Backend/Frontend) |
| docs/tasks/QA-RBAC.md | چک‌لیست QA برای نقش‌ها و دسترسی |
| docs/specs/API-CONTRACT.md | قفل‌شده |
| docs/specs/AUTH.md | قفل‌شده |
| docs/specs/TENANCY-ISOLATION.md | قفل‌شده |
| docs/specs/BILLING-SEATS.md | قفل‌شده |
| docs/specs/ENGINEERING-STANDARDS.md | قفل‌شده |
| docs/design/UI-STANDARDS.md | قفل‌شده |
| docs/tasks/SPRINT-0.md | تیکت‌های SAK-001 تا SAK-009 تعریف شده |
| docs/tasks/SPRINT-SALES-PREP.md | بکلاگ ۱۴ روزه آماده‌سازی فروش (فاز ۱ Demo، فاز ۲ Pilot؛ SAK-010–SAK-024) |
| docs/specs/DEMO-ADMIN.md | Spec دمو پنل مدیر فروش — صفحات، دادهٔ دمو، User Stories؛ دیتا با `npx prisma db seed` در seed.ts |
| docs/CURSOR-WORKFLOW.md | proposal → spec → design → tasks → implementation |
| DOCUMENTATION.md | راهنمای داکیومنت و Source of Truth |
| .cursorrules | منبع حقیقت + سه گاردریل ضد نشت |

---

## اسکریپت‌ها (روت)

- `npm run build` — بیلد backend + frontend
- `npm run install:all` — نصب وابستگی هر دو
- `npm run backend:dev` / `npm run frontend:dev` — اجرای توسعه
- `npm run backend:prisma:generate` / `npm run backend:prisma:migrate` — Prisma
- `npm run docker:build` / `docker:up` / `docker:down` / `docker:logs` — Docker Compose (PostgreSQL + Backend + Frontend با nginx)

---

## CI/CD

- **Workflow:** `.github/workflows/ci.yml` روی push/PR به `main`
- **Backend:** Install → Prisma generate → Lint → Typecheck → Test → Build
- **Frontend:** Install → Lint → Typecheck → Test → Build

---

## کارهای بعدی (پیشنهادی)

- **بکلاگ آماده‌سازی فروش:** [docs/tasks/SPRINT-SALES-PREP.md](docs/tasks/SPRINT-SALES-PREP.md) — فاز ۱ (Demo)، فاز ۲ (Tenant Setup، Subscription Guard، اعلان انقضا).
- ~~صفحات جزئیات (مخاطب، شرکت، معامله، کار)~~ ✅ انجام شد؛ ~~Customer 360 در جزئیات شرکت~~ ✅ انجام شد (خلاصه + لیست مخاطبین/معاملات)
- ~~Spec دمو + دیتای دمو در seed~~ ✅ انجام شد ([DEMO-ADMIN.md](docs/specs/DEMO-ADMIN.md)، `npx prisma db seed` — آلفا دیزاین، علی رضایی، معامله، کار، فعالیت)
- ~~فعال‌سازی Lint و Test در backend/frontend و در CI~~ ✅ انجام شد
- ~~پیاده‌سازی صفحات معاملات، کارها، فعالیت~~ ✅ انجام شد
- ~~تاریخ شمسی (Jalali)~~ ✅ انجام شد (JalaliDate + formatFaNum برای اعداد فارسی)
- تست‌های tenancy isolation و auth (طبق ENGINEERING-STANDARDS و QA-RBAC)
- نمای کانبان برای معاملات (طبق DEMO-ADMIN: «لیست کانبان + لیست معمولی») — اختیاری
- ~~بهبود موبایل: سایدبار off-canvas~~ ✅ انجام شد
