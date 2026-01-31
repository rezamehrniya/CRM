# وضعیت پنل‌ها — فرانت، بک، دواپس

**تاریخ به‌روزرسانی:** ۱۴۰۴/۱۱/۰۹ (۲۰۲۶-۰۱-۲۹)  
**مرجع نقش‌ها و پنل‌ها:** [specs/RBAC-PANELS.md](specs/RBAC-PANELS.md) · [specs/PERMISSION-MATRIX.md](specs/PERMISSION-MATRIX.md)

---

## خلاصهٔ پنل‌ها

| پنل (منو) | فرانت (صفحه / مسیر) | بک (API) | نقش | وضعیت کلی |
|-----------|----------------------|----------|------|-----------|
| داشبورد | ✅ واقعی `/dashboard` | ✅ `GET /dashboard` | هر دو | ✅ آماده |
| مخاطبین | ✅ واقعی `/contacts` | ✅ CRUD `/contacts` | هر دو | ✅ آماده |
| شرکت‌ها | ✅ واقعی `/companies` | ✅ CRUD `/companies` | هر دو | ✅ آماده |
| معاملات | ⏳ Placeholder `/deals` | ❌ — | هر دو | ⏳ بعد از بکلاگ |
| کارها | ⏳ Placeholder `/tasks` | ❌ — | هر دو | ⏳ بعد از بکلاگ |
| فعالیت | ⏳ Placeholder `/activity` | ❌ — | هر دو | ⏳ بعد از بکلاگ |
| ورود داده | ⏳ Placeholder `/import` | ❌ — | هر دو | ⏳ بعد از بکلاگ |
| تنظیمات | ✅ واقعی `/settings` | ✅ `GET /settings` | فقط OWNER | ✅ آماده |
| تنظیمات → اشتراک | ✅ واقعی `/settings/billing` | ✅ `GET /billing/*` | فقط OWNER | ✅ آماده |

---

## ۱. فرانت (Frontend)

### مسیرها و صفحات

| مسیر | کامپوننت | نوع | دسترسی (RBAC) | توضیح |
|------|-----------|------|----------------|--------|
| `/` | Navigate | — | — | ریدایرکت به `/t/demo/app` |
| `/maintenance` | MaintenancePage | ErrorPage | — | صفحهٔ Maintenance |
| `/t/:slug/app/login` | LoginPage | صفحه | — | لاگین؛ ذخیره توکن |
| `/t/:slug/app` | AppLayout + Outlet | Layout | بعد از Auth | سایدبار + هدر (جستجو، تم، کاربر، خروج) |
| `/t/:slug/app/dashboard` | Dashboard | صفحه | هر دو | KPIها؛ اسکلتون؛ Alert |
| `/t/:slug/app/contacts` | Contacts | صفحه | هر دو | لیست، جستجو، صفحه‌بندی، CRUD مودال |
| `/t/:slug/app/companies` | Companies | صفحه | هر دو | همان الگو |
| `/t/:slug/app/deals` | Placeholder | Placeholder | هر دو | «معاملات — به زودی» |
| `/t/:slug/app/tasks` | Placeholder | Placeholder | هر دو | «کارها — به زودی» |
| `/t/:slug/app/activity` | Placeholder | Placeholder | هر دو | «فعالیت — به زودی» |
| `/t/:slug/app/import` | Placeholder | Placeholder | هر دو | «ورود داده — به زودی» |
| `/t/:slug/app/settings` | Settings | صفحه | **فقط OWNER** (ProtectedRoute + چک در صفحه) | ۴ دسته (کاربران، Pipeline، منابع لید، اشتراک) + لینک Billing |
| `/t/:slug/app/settings/billing` | SettingsBilling | صفحه | **فقط OWNER** (ProtectedRoute + چک در صفحه) | اشتراک + استفاده صندلی؛ فراخوانی `/billing/subscription` و `/billing/usage` |
| `/t/:slug/app/error` | AppErrorPage | ErrorPage | — | `?code=401|403|404|500` |
| `*` | NotFoundPage | ErrorPage | — | ۴۰۴ |

### منوی سایدبار (RBAC)

- **آیتم‌ها:** داشبورد، مخاطبین، شرکت‌ها، معاملات، کارها، فعالیت، ورود داده، **تنظیمات** (با `adminOnly: true`).
- **فیلتر:** برای `role === 'MEMBER'` آیتم «تنظیمات» نمایش داده **نمی‌شود**.
- **دسترسی مستقیم:** ورود MEMBER به `/settings` یا `/settings/billing` → ریدایرکت به `/app/error?code=403`.

### وابستگی‌های فرانت

- **Auth:** AuthProvider، useAuth (user, tenant, role, logout)؛ توکن در sessionStorage؛ درخواست‌ها با `Authorization: Bearer`.
- **API پایه:** `lib/api.ts` — getBase از pathname؛ apiGet/apiPost/apiPatch/apiDelete با credentials: 'include'.

---

## ۲. بک (Backend)

### کنترلرها و endpointها

| مسیر API | متد | نقش | توضیح |
|----------|-----|------|--------|
| `/api/t/:slug/auth/login` | POST | — | لاگین؛ برگرداندن accessToken + Set-Cookie (refresh) |
| `/api/t/:slug/auth/refresh` | POST | — | رفرش با cookie |
| `/api/t/:slug/auth/logout` | POST | — | باطل‌سازی session؛ پاک کردن cookie |
| `/api/t/:slug/auth/me` | GET | JWT | user، tenant، **role** |
| `/api/t/:slug/auth/demo-session` | POST | — | فقط tenant دمو |
| `/api/t/:slug/contacts` | GET, POST | JWT | لیست (page, pageSize, search)، ایجاد |
| `/api/t/:slug/contacts/:id` | GET, PATCH, DELETE | JWT | یک مخاطب؛ همه tenant-scoped |
| `/api/t/:slug/companies` | GET, POST | JWT | لیست، ایجاد |
| `/api/t/:slug/companies/:id` | GET, PATCH, DELETE | JWT | یک شرکت؛ tenant-scoped |
| `/api/t/:slug/dashboard` | GET | JWT | KPIها (contactsCount، dealsCount، tasksDueToday، pipelineValue) |
| `/api/t/:slug/billing/subscription` | GET | **فقط OWNER** | وضعیت اشتراک |
| `/api/t/:slug/billing/usage` | GET | **فقط OWNER** | صندلی‌های فعال و سقف |
| `/api/t/:slug/billing/invoices` | GET | **فقط OWNER** | لیست فاکتورها |
| `/api/t/:slug/settings` | GET | **فقط OWNER** | تأیید دسترسی تنظیمات؛ پاسخ `{ ok, tenantId }` |

### Guardها و محدودیت نقش

- **همهٔ routeهای بالا (غیر از auth/login و auth/refresh):** JwtAuthGuard؛ تطابق `token.tid` با `req.tenant.id` (در غیر این صورت 403 TENANT_MISMATCH).
- **Billing و Settings:** `@UseGuards(JwtAuthGuard, RolesGuard)` و `@Roles('OWNER')`؛ MEMBER → 403 FORBIDDEN (Insufficient role).
- **Tenant:** TenantMiddleware روی مسیر `t*`؛ رزولوشن slug و ست کردن `req.tenant`.

### مدل داده (Prisma)

- **موجود و استفاده‌شده در API:** Tenant، User، Session، Membership، Contact، Company، Subscription، Invoice، InvoiceItem؛ Pipeline، PipelineStage، Deal، Activity، Task، AuditLog (در schema؛ endpoint جدا برای همهٔ آن‌ها پیاده نشده).

---

## ۳. دواپس (DevOps)

### CI/CD

| مورد | وضعیت | توضیح |
|------|--------|--------|
| **Workflow** | ✅ | `.github/workflows/ci.yml` — روی push/PR به `main` |
| **Backend job** | ✅ | checkout → Setup Node 20 → Install deps → Prisma generate (با DATABASE_URL تست) → Typecheck → Build |
| **Frontend job** | ✅ | checkout → Setup Node 20 → Install deps → Typecheck → Build |
| **Lint** | ⏳ | مرحله در CI وجود دارد ولی کامنت‌شده (فعلاً غیرفعال) |
| **Test** | ⏳ | مرحله در CI وجود دارد ولی کامنت‌شده (فعلاً غیرفعال) |

### محیط و تنظیمات

| مورد | وضعیت | توضیح |
|------|--------|--------|
| **Backend env** | ✅ | `backend/.env.example`: DATABASE_URL، PORT، JWT_SECRET |
| **Frontend env** | — | وابستگی به backend از طریق proxy یا base URL؛ توکن در sessionStorage |
| **Dockerfile** | ❌ | وجود ندارد؛ بیلد دستی یا سرور Node |
| **docker-compose** | ❌ | وجود ندارد |
| **Deploy pipeline** | ❌ | بعد از CI فقط بیلد؛ مرحلهٔ deploy جدا تعریف نشده |

### اسکریپت‌های روت پروژه

| اسکریپت | کار |
|---------|------|
| `npm run build` | بیلد backend + frontend |
| `npm run install:all` | نصب وابستگی backend و frontend |
| `npm run backend:dev` | `nest start --watch` |
| `npm run frontend:dev` | `vite` |
| `npm run backend:prisma:generate` | Prisma generate |
| `npm run backend:prisma:migrate` | Prisma migrate dev |

---

## ۴. جمع‌بندی وضعیت پنل‌ها

| پنل | فرانت | بک | دواپس (وابسته به پنل) |
|-----|--------|-----|-------------------------|
| **داشبورد** | ✅ صفحه + KPI | ✅ GET /dashboard | CI برای بک/فرانت |
| **مخاطبین** | ✅ لیست + CRUD | ✅ CRUD /contacts | — |
| **شرکت‌ها** | ✅ لیست + CRUD | ✅ CRUD /companies | — |
| **معاملات** | ⏳ Placeholder | ❌ | — |
| **کارها** | ⏳ Placeholder | ❌ | — |
| **فعالیت** | ⏳ Placeholder | ⏳ | — |
| **ورود داده** | ⏳ Placeholder | ❌ | — |
| **تنظیمات** | ✅ صفحه + ۴ دسته | ✅ GET /settings (OWNER) | — |
| **تنظیمات → Billing** | ✅ صفحه اشتراک/صندلی | ✅ GET /billing/* (OWNER) | — |

**دواپس مشترک:** CI برای backend و frontend (typecheck + build)؛ env فقط backend در `.env.example`؛ بدون Docker یا pipeline deploy.

---

## ۵. کارهای بعدی (از بکلاگ فروش)

- **فاز ۱ (Demo):** Customer 360°، Lead Detail + Convert، Activities، Tasks، Dashboard فروشنده؛ Billing در Settings از قبل آماده است.
- **فاز ۲ (فروش واقعی):** Tenant Setup، تکمیل رفتار Read-only پس از انقضا، Invoices، اعلان انقضا.
- **دواپس:** در صورت نیاز: Dockerfile، docker-compose، مرحلهٔ deploy در pipeline یا اسکریپت deploy جدا.
