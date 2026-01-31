# Spec: RBAC — نقش‌ها، پنل‌ها و دسترسی

**وضعیت:** پیشنویس  
**آخرین به‌روزرسانی:** 2026-01-28  
**مرجع محصول:** [proposals/ROLES-AND-PANELS.md](../proposals/ROLES-AND-PANELS.md)  
**مرجع Auth:** [AUTH.md](AUTH.md)

---

## Scope / Non-goals

- **در scope:** تعریف دو نقش (Admin / User)، دو پنل ناوبری، ماتریس دسترسی per resource، قواعد Guard در API و فیلتر منوی فرانت، تعریف «دادهٔ مرتبط با خود» برای User.
- **خارج از scope:** نقش سوم (مثلاً Manager)، permissionهای گرانولارتر (per-action)، SSO/OAuth در این سند.

---

## نقش‌ها — نگاشت به سیستم

| نقش محصولی (PRD/UI) | نقش در API و DB (JWT, Membership.role) | توضیح |
|----------------------|----------------------------------------|--------|
| **ADMIN**            | `OWNER`                                | مدیر Tenant؛ دسترسی کامل داخل tenant |
| **USER**             | `MEMBER`                               | فروشنده؛ دسترسی محدود به دادهٔ خود و مشاهدهٔ وضعیت مشتری |

- JWT ادعا: `role: "OWNER" | "MEMBER"` (مطابق [AUTH.md](AUTH.md)).
- هر endpoint بعد از `JwtAuthGuard` و تطابق `tid` می‌تواند با `RolesGuard` و `@Roles('OWNER')` محدود به Admin شود؛ در غیر این صورت هر دو نقش دسترسی دارند (با فیلتر داده برای MEMBER).

---

## پنل‌ها (Sidebar / Navigation)

### پنل ADMIN (role === OWNER)

| # | آیتم منو      | مسیر (پیشنهادی)     | توضیح |
|---|----------------|----------------------|--------|
| 1 | Dashboard      | `/dashboard`         | KPI کل فروش، مقایسه فروشنده‌ها، مشتری در خطر |
| 2 | Leads          | `/leads`             | ساخت/ویرایش/تخصیص، Convert به مشتری |
| 3 | Customers      | `/customers`         | مشاهده/ویرایش همه، لینک به 360° |
| 4 | Deals          | `/deals`             | همه Dealها، Pipeline config |
| 5 | Activities & Tasks | `/tasks`, `/activities` | همه Task/Activity |
| 6 | Projects       | `/projects`          | بعد از فروش (فاز بعد) |
| 7 | Payments & Invoices | `/payments`, `/invoices` | ایجاد/ویرایش پرداخت و فاکتور |
| 8 | Contracts      | `/contracts`         | ایجاد/ویرایش قرارداد |
| 9 | Reports        | `/reports`           | گزارش پایه |
| 10| **Settings**   | `/settings`          | Users & Roles، Pipelines، Lead Sources، Billing |

### پنل USER (role === MEMBER)

| # | آیتم منو           | مسیر (پیشنهادی)     | توضیح |
|---|---------------------|----------------------|--------|
| 1 | My Dashboard        | `/dashboard`         | کارهای امروز، لیدهای داغ، مشتری نیاز به پیگیری |
| 2 | My Leads            | `/leads`             | فقط لیدهای تخصیص‌یافته به خود |
| 3 | My Customers        | `/customers`         | فقط مشتری‌های مرتبط (مثلاً owner یا دارای deal) |
| 4 | Deals               | `/deals`             | فقط Dealهای خود؛ Kanban مجاز |
| 5 | Tasks               | `/tasks`             | فقط Taskهای خود |
| 6 | Activities          | `/activities`        | ثبت/مشاهده فعالیت خود |
| 7 | **Customer 360°**   | `/customers/:id/360` | نمای read-only وضعیت مشتری |

**بدون دسترسی (مخفی در منو و ممنوع در API):** Settings، Billing، Users، Pipelines config؛ و عملیات حساس مثل Delete روی منابع حساس (طبق ماتریس).

---

## ماتریس دسترسی (خلاصهٔ اجرایی)

| بخش        | ADMIN (OWNER) | USER (MEMBER)     |
|------------|----------------|-------------------|
| Dashboard  | ✅ همه KPIها   | ✅ شخصی (My)       |
| Leads      | Full (همه)     | Own only؛ ثبت فعالیت؛ Convert طبق policy |
| Customers  | Full           | Read-only (own)؛ دسترسی به 360° |
| Deals      | Full           | Own only؛ Kanban  |
| Tasks      | Full؛ Assign   | Own؛ ایجاد/بستن   |
| Activities | Full           | Own               |
| Payments   | Full           | Read-only         |
| Contracts  | Full           | Read-only         |
| Reports    | Full           | محدود یا بدون دسترسی (طبق پلیسی) |
| Settings   | Full           | ❌                 |

- **Own:** رکوردهایی که `ownerUserId === currentUser.id` یا مشابه (مثلاً lead.assigneeId).
- **Read-only:** فقط GET؛ هیچ POST/PATCH/DELETE روی آن منبع برای MEMBER.

---

## Security & Guardrails

### Backend (اجباری)

1. **Tenant:** همهٔ endpointها تحت `/api/t/:tenantSlug/...`؛ هر کوئری با `tenantId` (مطابق TENANCY-ISOLATION).
2. **Role برای routeهای حساس:**  
   - routes مربوط به Settings، Users، Billing، Pipelines config، Reports کلان: `@Roles('OWNER')` + `RolesGuard`.  
   - DELETE روی منابع حساس (مثلاً Customer، Contract): فقط OWNER یا طبق ماتریس.
3. **فیلتر داده برای MEMBER:**  
   - Leads: `where: { tenantId, assigneeId: userId }` (یا ownerUserId بسته به مدل).  
   - Deals: `where: { tenantId, ownerUserId: userId }`.  
   - Customers: برای MEMBER فقط آن‌هایی که با خودش مرتبط هستند (مثلاً دارای deal/lead با ownerUserId = userId) + لیست خواندنی.  
   - Tasks/Activities: `where: { tenantId, assignedToUserId: userId }` یا createdBy.
4. **Customer 360°:** یک endpoint مثلاً `GET /api/t/:tenantSlug/customers/:id/overview` که برای MEMBER فقط اگر مشتری «مرتبط با خود» باشد 200 برمی‌گرداند، وگرنه 403.

### Frontend

1. **منوی سایدبار:** بر اساس `role` از `/auth/me` آیتم‌های Settings، Billing، Users، Pipelines را برای MEMBER نمایش نده.
2. **مسیرها:** برای مسیرهای ممنوع (مثلاً `/settings`) در صورت دسترسی مستقیم با MEMBER، redirect به `/app/error?code=403` یا نمایش ErrorPage 403.
3. **دکمه‌های حذف/ویرایش حساس:** برای MEMBER در بخش‌های read-only (Payments، Contracts) اصلاً رندر نشود.

---

## Data Model (خلاصهٔ تأثیر روی موجود)

- **Lead:** در صورت نبودن: اضافه شدن مدل با `tenantId`, `assigneeId` (userId), `status`, …  
- **Contact/Company:** فعلاً مشابه «Customer»؛ ممکن است `ownerUserId` یا assigneeId` برای فیلتر «مرتبط با خود» لازم باشد.  
- **Deal:** در Prisma هست؛ `ownerUserId` برای فیلتر MEMBER استفاده شود.  
- **Task / Activity:** `assignedToUserId` / `createdByUserId` برای فیلتر MEMBER.

(جزییات مدل در API-CONTRACT و Prisma schema به‌روز می‌شود.)

---

## Acceptance Criteria

- [ ] کاربر با نقش MEMBER آیتم‌های Settings، Billing، Users، Pipelines را در منو نمی‌بیند.
- [ ] کاربر MEMBER با URL مستقیم به `/settings` به صفحه 403 یا redirect هدایت می‌شود.
- [ ] APIهای مربوط به لیست Lead/Deal/Customer برای MEMBER فقط رکوردهای «خود» را برمی‌گردانند.
- [ ] APIهای مربوط به Payments/Contracts برای MEMBER فقط GET دارند؛ POST/PATCH/DELETE با 403.
- [ ] Customer 360° (overview) برای MEMBER فقط برای مشتری‌های مرتبط با خود باز است.

---

## Test Plan

- **واحد:** سرویس‌های لیست با نقش MEMBER و فیلتر owner/assignee.
- **یکپارچگی:** درخواست با JWT MEMBER به endpoint مخصوص OWNER → 403؛ درخواست GET به resource دیگران → خالی یا 403.
- **دستی/QA:** ورود با دو کاربر OWNER و MEMBER و مقایسه منو و دسترسی به هر بخش.
