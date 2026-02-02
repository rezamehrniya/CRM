# وضعیت کامل محصولی و فنی — Sakhtar CRM

**دامنه محصول:** crm.sakhtar.net  
**تاریخ به‌روزرسانی:** ۱۴۰۴/۱۱/۱۳ (۲۰۲۶-۰۲-۰۲)  
**مرجع:** PROJECT-STATUS، RBAC-PANELS، OPERATIONAL-SPEC، DEMO-ADMIN، SPRINT-SALES-PREP

---

## بخش ۱ — اطلاعات محصولی

### ۱.۱ هدف محصول

- **Sakhtar CRM** یک سیستم مدیریت ارتباط با مشتری (CRM) **چندمستاجری** با برند ساختار است.
- هدف: ارائهٔ پنل فروش و مدیریت مشتری برای سازمان‌ها (Tenantها) با نقش **مدیر فروش (Admin)** و **فروشنده (User)**.
- دامنهٔ هدف: کسب‌وکارهای B2B که نیاز به مدیریت لید، مخاطب، شرکت، معامله، کار و فعالیت دارند.

### ۱.۲ کاربران هدف

| کاربر | نقش در سیستم | نیاز اصلی |
|--------|----------------|-----------|
| **مدیر فروش (Admin)** | OWNER | دسترسی کامل به داده‌ها و تنظیمات Tenant؛ مدیریت اعضا؛ اشتراک و Billing؛ Pipeline و منابع لید |
| **فروشنده** | MEMBER | مشاهده و مدیریت دادهٔ خود؛ کارهای امروز؛ لیدها و معاملات تخصیص‌یافته؛ Customer 360° (وضعیت مشتری) |

### ۱.۳ ارزش و ویژگی‌های محصول

- **چندمستاجری (Multi-tenant):** هر سازمان با یک Tenant و slug جدا؛ ایزولهٔ داده.
- **RBAC:** دو نقش OWNER و MEMBER با ماتریس دسترسی مشخص؛ Settings/Billing فقط OWNER.
- **ماژول‌های فروش:** لید، مخاطب، شرکت، معامله، کار، فعالیت؛ ورود داده (CSV).
- **Customer 360°:** نمای وضعیت مشتری (شرکت) شامل مخاطبین و معاملات مرتبط.
- **تنظیمات:** کاربران و نقش‌ها، Pipeline و مراحل، منابع لید، اشتراک و صورتحساب.
- **رابط فارسی:** تاریخ شمسی (جلالی) در نمایش و ورودی؛ اعداد فارسی (formatFaNum + فونت FaNum).

### ۱.۴ فازهای محصول (از دمو تا محصول نهایی)

| فاز | نام | هدف | وضعیت |
|-----|------|------|--------|
| **فاز ۱** | دمو عملیاتی | پنل قابل‌فروش برای دمو؛ مدیر فروش و فروشنده بتوانند سناریوی کامل را طی کنند | ✅ انجام‌شده (صفحات، لید، مدیریت اعضا، تاریخ شمسی، Customer 360، Billing، Pipeline، Users) |
| **فاز ۲** | پایلوت / فروش واقعی | Tenant Setup، قفل Write پس از انقضای اشتراک، Invoices، اعلان انقضا | 🔸 بخشی (SubscriptionActiveGuard و Billing موجود؛ Tenant Setup و اعلان انقضا در بکلاگ) |
| **فاز ۳** | محصول نهایی | نمای کانبان معاملات، منابع لید قابل تعریف، گزارش‌ها، تست و QA کامل، استقرار Production | ⏳ بعد از بکلاگ |

---

## بخش ۲ — اطلاعات فنی

### ۲.۱ استک فنی

| لایه | تکنولوژی |
|------|-----------|
| **Frontend** | React 18، Vite 7، Tailwind CSS، React Router 6، Lucide Icons، date-fns-jalali |
| **Backend** | NestJS، Prisma، PostgreSQL |
| **Auth** | JWT (۱۵ دقیقه) + Refresh Token در Cookie با Path محدود |
| **دواپس** | GitHub Actions (CI: typecheck + build)، Docker Compose (اختیاری)، اسکریپت‌های npm در روت |

### ۲.۲ معماری کلی

- **مسیر اپ:** `/t/:tenantSlug/app` (مثلاً `/t/demo/app`).
- **پایهٔ API:** `/api/t/:tenantSlug/...`؛ Tenant Middleware روی مسیرهای `t*`؛ رزولوشن slug → tenant و ست کردن `req.tenant`.
- **احراز هویت:** همهٔ درخواست‌های API (غیر از login/refresh) با `Authorization: Bearer <accessToken>`؛ تطابق `token.tid` با `req.tenant.id` (در غیر این صورت 403 TENANT_MISMATCH).

### ۲.۳ مدل داده (Prisma)

| مدل | توضیح |
|-----|--------|
| **Tenant** | slug، name، status؛ ارتباط با memberships، contacts، companies، pipelines، deals، leads، activities، tasks، subscriptions، invoices |
| **User** | email، phone، passwordHash، status |
| **Membership** | tenantId، userId، role (OWNER/MEMBER)، status (INVITED/ACTIVE/DISABLED) |
| **Session** | refresh token؛ userId، tenantId |
| **Contact** | fullName، phone، email، companyId، ownerUserId |
| **Company** | name، phone، website |
| **Pipeline / PipelineStage** | نام Pipeline؛ Stageها با order |
| **Deal** | title، amount، stageId، pipelineId، contactId، companyId، ownerUserId، expectedCloseDate |
| **Lead** | fullName، phone، email، companyName، source، status (NEW/CONTACTED/QUALIFIED/CONVERTED/LOST)، notes، **followUpAt**، ownerUserId، createdAt، updatedAt |
| **Activity** | type (CALL/MEETING/NOTE)، body، contactId، dealId، happenedAt، createdByUserId |
| **Task** | title، dueAt، status (OPEN/DONE)، assignedToUserId، contactId، dealId |
| **Subscription** | planCode، status، startsAt، endsAt، baseSeatLimit، addonSeatCount |
| **Invoice / InvoiceItem** | وضعیت، تاریخ‌ها، مبلغ؛ نوع (RENEWAL، ADDON_SEATS) |
| **AuditLog** | action، entityType، entityId، metaJson |

### ۲.۴ APIهای Backend (خلاصه)

| ماژول | مسیر | متدها | نقش |
|--------|------|--------|------|
| Auth | `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me` | POST, GET | — / JWT |
| Contacts | `/contacts`, `/contacts/:id`, `/contacts/import` | GET, POST, PATCH, DELETE, POST | JWT؛ import با SubscriptionActiveGuard |
| Companies | `/companies`, `/companies/:id`, `/companies/import` | GET, POST, PATCH, DELETE, POST | JWT |
| Deals | `/deals`, `/deals/:id` | GET, POST, PATCH, DELETE | JWT + SubscriptionActiveGuard |
| **Leads** | **`/leads`**, **`/leads/:id`** | **GET, POST, PATCH, DELETE** | **JWT + SubscriptionActiveGuard** |
| Tasks | `/tasks`, `/tasks/:id` | GET, POST, PATCH, DELETE | JWT + SubscriptionActiveGuard |
| Activities | `/activities`, `/activities/:id` | GET, POST | JWT |
| Dashboard | `/dashboard` | GET | JWT |
| Pipelines | `/pipelines` | GET | JWT |
| Billing | `/billing/subscription`, `/billing/usage`, `/billing/invoices` | GET | **فقط OWNER** |
| Settings | `/settings`, `/settings/members` | GET | **فقط OWNER** |

### ۲.۵ امنیت و دسترسی

- **JwtAuthGuard:** روی همهٔ routeهای محافظت‌شده؛ چک TENANT_MISMATCH.
- **RolesGuard + @Roles('OWNER'):** برای Billing، Settings، Members.
- **SubscriptionActiveGuard:** برای عملیات نوشتنی (ایجاد/ویرایش/حذف) در Contacts، Companies، Deals، Leads، Tasks؛ در صورت انقضای اشتراک → 403 SUBSCRIPTION_EXPIRED.
- **Tenant isolation:** همهٔ queryها با `tenantId` از `req.tenant`.

### ۲.۶ فرانت‌اند — مسیرها و صفحات

| مسیر | صفحه | دسترسی | توضیح |
|------|------|--------|--------|
| `/t/:slug/app/login` | Login | — | لاگین؛ پنل مدیر فروش (دمو) |
| `/t/:slug/app` | Dashboard | هر دو | KPIها؛ برای MEMBER: کارهای امروز من، معاملات من |
| `/t/:slug/app/contacts` | Contacts | هر دو | لیست + جستجو + صفحه‌بندی + مودال CRUD |
| `/t/:slug/app/contacts/:id` | ContactDetail | هر دو | مشخصات + لینک شرکت |
| `/t/:slug/app/companies` | Companies | هر دو | لیست + مودال |
| `/t/:slug/app/companies/:id` | CompanyDetail | هر دو | مشخصات + Customer 360 (مخاطبین + معاملات) |
| `/t/:slug/app/deals` | Deals | هر دو | لیست + مودال |
| `/t/:slug/app/deals/:id` | DealDetail | هر دو | مبلغ، مرحله، لینک مخاطب/شرکت |
| **`/t/:slug/app/leads`** | **Leads** | **هر دو** | **لیست لید + جستجو/فیلتر وضعیت + مودال CRUD؛ تاریخ پیگیری (شمسی)** |
| `/t/:slug/app/tasks` | Tasks | هر دو | لیست + فیلتر وضعیت + مودال؛ موعد شمسی |
| `/t/:slug/app/tasks/:id` | TaskDetail | هر دو | جزئیات کار |
| `/t/:slug/app/activity` | Activity | هر دو | لیست فعالیت + مودال ثبت؛ زمان شمسی |
| `/t/:slug/app/import` | Import | هر دو | ورود CSV (مخاطب/شرکت) |
| **`/t/:slug/app/members`** | **Members** | **فقط OWNER** | **مدیریت اعضا — فروشنده‌ها و دسترسی‌ها (نقش و وضعیت)** |
| `/t/:slug/app/settings` | Settings | فقط OWNER | ۴ دسته: کاربران، Pipeline، منابع لید، اشتراک |
| `/t/:slug/app/settings/users` | SettingsUsers | فقط OWNER | جدول اعضا (ایمیل/تلفن، نقش، وضعیت) |
| `/t/:slug/app/settings/pipeline` | SettingsPipeline | فقط OWNER | مراحل Pipeline (read-only) |
| `/t/:slug/app/settings/lead-sources` | SettingsLeadSources | فقط OWNER | منابع لید — placeholder «به زودی» |
| `/t/:slug/app/settings/billing` | SettingsBilling | فقط OWNER | اشتراک، استفاده صندلی، لیست صورتحساب‌ها |
| `/t/:slug/app/error` | AppErrorPage | — | `?code=401|403|404|500` |

### ۲.۷ منوی سایدبار (ناوبری)

- **برای همه:** داشبورد، مخاطبین، شرکت‌ها، معاملات، **لیدها**، کارها، فعالیت، ورود داده.
- **فقط OWNER:** **مدیریت اعضا**، تنظیمات.
- سایدبار چپ RTL؛ حالت جمع‌شده (collapsed)؛ موبایل: off-canvas با backdrop.

### ۲.۸ UI و استانداردها

- **تم:** theme.css، aurora.css؛ glass-card؛ دکمه تم (ThemeToggle).
- **تاریخ:** **شمسی (جلالی)** در همهٔ نمایش‌ها و ورودی‌ها؛ `JalaliDate` برای نمایش؛ `JalaliDateInput` و `JalaliDateTimeInput` برای فرم‌ها (لید، کار، فعالیت).
- **اعداد:** formatFaNum + کلاس `fa-num` و فونت Vazirmatn FaNum.
- **کامپوننت‌ها:** Button، Input، Alert، Skeleton، PageBreadcrumb؛ اسکلتون برای بارگذاری.

### ۲.۹ دواپس و CI/CD

- **CI:** `.github/workflows/ci.yml` — روی push/PR به `main`؛ Backend: install → Prisma generate → Lint → Typecheck → Test → Build؛ Frontend: install → Lint → Typecheck → Test → Build.
- **Docker:** `docker-compose.yml` (PostgreSQL + Backend + Frontend با nginx)؛ `docker-compose.dev.yml` برای توسعه با mount و HMR.
- **اسکریپت‌های روت:** `npm run build`, `npm run install:all`, `npm run backend:dev`, `npm run frontend:dev`, `npm run backend:prisma:generate`, `npm run backend:prisma:migrate`, `npm run docker:build`, `npm run docker:up`, `npm run docker:down`.

---

## بخش ۳ — استیت فعلی محصول

### ۳.۱ خلاصهٔ وضعیت

- **دمو عملیاتی:** قابل تحویل برای سناریوی مدیر فروش و فروشنده؛ لید، مخاطب، شرکت، معامله، کار، فعالیت، ورود داده، مدیریت اعضا، تنظیمات (کاربران، Pipeline، منابع لید، Billing)؛ تاریخ شمسی در همهٔ جا.
- **بک‌اند:** همهٔ ماژول‌های CRUD (Contacts، Companies، Deals، Leads، Tasks، Activities)، Dashboard، Pipelines، Billing، Settings با Guardهای نقش و اشتراک.
- **فرانت:** همهٔ صفحات لیست و جزئیات؛ فرم‌های ایجاد/ویرایش/حذف؛ RBAC در منو و مسیر؛ Customer 360 در جزئیات شرکت.

### ۳.۲ چک‌لیست ماژول‌ها (فعلی)

| ماژول | Backend | Frontend | RBAC | توضیح |
|--------|---------|----------|------|--------|
| Auth | ✅ | ✅ | — | Login، Refresh، Logout، Me؛ JWT + cookie |
| Tenant | ✅ | ✅ | — | Middleware؛ slug در URL |
| Contacts | ✅ | ✅ لیست+جزئیات+مودال | هر دو | CRUD + Import |
| Companies | ✅ | ✅ لیست+جزئیات+مودال | هر دو | CRUD + Import؛ جزئیات با Customer 360 |
| Deals | ✅ | ✅ لیست+جزئیات+مودال | هر دو | CRUD |
| **Leads** | **✅** | **✅ لیست+مودال** | **هر دو** | **CRUD؛ تاریخ پیگیری شمسی؛ وضعیت و منبع** |
| Tasks | ✅ | ✅ لیست+جزئیات+مودال | هر دو | CRUD؛ موعد شمسی |
| Activities | ✅ | ✅ لیست+مودال | هر دو | ایجاد + لیست؛ زمان شمسی |
| Dashboard | ✅ | ✅ | هر دو | KPI؛ برای MEMBER فیلتر «خود» |
| Pipelines | ✅ | ✅ Settings | OWNER | read-only |
| Billing | ✅ | ✅ Settings | OWNER | اشتراک، استفاده، صورتحساب‌ها |
| Settings / Members | ✅ GET /settings/members | ✅ Settings + **Members** | OWNER | **مدیریت اعضا (صفحه جدا)**؛ Users، Pipeline، Lead Sources |
| تاریخ شمسی | — | ✅ | — | نمایش + ورودی (JalaliDate، JalaliDateInput، JalaliDateTimeInput) |

### ۳.۳ کارهای انجام‌شده در sessionهای اخیر

- صفحه **لیدها** با لیست، جستجو، فیلتر وضعیت، مودال CRUD و **تاریخ پیگیری شمسی**.
- مدل **Lead** در Prisma و ماژول **Leads** در Backend (CRUD کامل).
- منو و صفحه **مدیریت اعضا** برای OWNER (لیست فروشنده‌ها و دسترسی‌ها؛ لینک به تنظیمات کاربران).
- **تاریخ و دیت‌پیکر شمسی** در همهٔ پنل: نمایش با `date-fns-jalali` و faIR؛ ورودی با `JalaliDateInput` (لید، کار) و `JalaliDateTimeInput` (فعالیت).

### ۳.۴ کارهای باقی‌مانده (بکلاگ)

- **فاز ۲:** Tenant Setup (ایجاد Tenant جدید)، رفتار Read-only پس از انقضای اشتراک، اعلان انقضا (Email/Telegram)، (اختیاری) فرم دمو از لندینگ.
- **فاز ۳:** تعریف و مدیریت منابع لید (غیر از placeholder)، نمای کانبان برای معاملات، گزارش‌ها، تست‌های tenancy و RBAC، استقرار Production و مانیتورینگ.

---

## بخش ۴ — فاز دمو تا محصول نهایی

### ۴.۱ فاز دمو (فعلی — انجام‌شده)

- **هدف:** پنل قابل‌فروش برای دمو با نقش مدیر فروش و فروشنده.
- **خروجی:** Tenant `demo` با seed (`npx prisma db seed`)؛ کاربر OWNER با `owner@demo.com` / `12345678`؛ سناریوی کامل از لید → مخاطب/شرکت → معامله → کار و فعالیت؛ Customer 360 در جزئیات شرکت؛ مدیریت اعضا؛ Billing و Pipeline در تنظیمات؛ تاریخ شمسی در همهٔ فرم‌ها و لیست‌ها.
- **Spec:** [docs/specs/DEMO-ADMIN.md](specs/DEMO-ADMIN.md).

### ۴.۲ فاز پایلوت / فروش واقعی

- **هدف:** امکان ایجاد Tenant جدید و فروش واقعی؛ قفل Write پس از انقضا؛ صورتحساب و اعلان.
- **اقدامات پیشنهادی:** Tenant Setup (API یا فرم)، تکمیل Subscription Guard و رفتار Read-only، لیست Invoices، اعلان انقضا؛ (اختیاری) فرم درخواست دمو از لندینگ.
- **مرجع:** [docs/tasks/SPRINT-SALES-PREP.md](tasks/SPRINT-SALES-PREP.md).

### ۴.۳ محصول نهایی

- **هدف:** نسخهٔ Production با گزارش‌ها، نمای کانبان، منابع لید قابل تعریف، QA و تست خودکار، استقرار و مانیتورینگ.
- **وابستگی‌ها:** تکمیل فاز ۲؛ تعیین استراتژی Tenant Setup و Billing واقعی؛ زیرساخت اعلان و Job.

---

## مراجع سند

| سند | مسیر |
|-----|--------|
| وضعیت پروژه | [PROJECT-STATUS.md](PROJECT-STATUS.md) |
| وضعیت پنل‌ها | [PANELS-STATUS.md](PANELS-STATUS.md) |
| RBAC و پنل‌ها | [specs/RBAC-PANELS.md](specs/RBAC-PANELS.md) |
| **Spec عملیاتی (ارتباط صفحات + RBAC)** | [specs/OPERATIONAL-SPEC.md](specs/OPERATIONAL-SPEC.md) |
| PRD و User Stories | [specs/PRD-PANELS-USER-STORIES.md](specs/PRD-PANELS-USER-STORIES.md) |
| Spec دمو Admin | [specs/DEMO-ADMIN.md](specs/DEMO-ADMIN.md) |
| بکلاگ آماده‌سازی فروش | [tasks/SPRINT-SALES-PREP.md](tasks/SPRINT-SALES-PREP.md) |
| API Contract | [specs/API-CONTRACT.md](specs/API-CONTRACT.md) |
| استانداردهای UI | [design/UI-STANDARDS.md](design/UI-STANDARDS.md) |
