# Proposal: نقش‌ها و پنل‌ها (Admin vs Sales)

**شناسه:** 0001-roles-and-panels  
**تاریخ:** 2026-01-28  
**وضعیت:** تأیید‌شده  
**دامنه عملیاتی:** `erp.sakhtar.net` (فروش و مانیتورینگ) — هر Tenant = یک سازمان.

---

## Context

- تمرکز محصول: **فروش، پیگیری، وضعیت مشتری** (CRM در بستر ERP).
- نیاز به تفکیک واضح بین **مدیر Tenant** (ساختار فروش، تنظیمات، گزارش کلان) و **فروشنده** (کار روزانه با لید/مشتری، بدون دسترسی به تنظیمات و داده‌های دیگران).
- فروشنده باید بتواند **وضعیت مشتری (Customer 360°)** را ببیند و بداند چه کاری انجام دهد، بدون وابستگی به Admin.
- Admin باید در حداقل زمان (**&lt; 5 دقیقه**) وضعیت کل فروش و گلوگاه‌ها را ببیند.

---

## Decision

- **دو نقش محصولی:**  
  - **ADMIN (Tenant Admin / Owner):** مدیر Tenant؛ مالک داده‌ها و تنظیمات؛ دسترسی کامل داخل Tenant به‌جز تنظیمات سیستمی پلتفرم.  
  - **USER (Sales / Seller):** فروشنده؛ کار با لید و مشتری؛ دسترسی عملیاتی محدود و بدون تنظیمات حساس.

- **دو پنل ناوبری (Sidebar):**  
  - **پنل Admin:** Dashboard، Leads، Customers، Deals، Activities & Tasks، Projects، Payments & Invoices، Contracts، Reports، **Settings** (Users & Roles، Pipelines، Lead Sources، Billing).  
  - **پنل Sales:** My Dashboard، My Leads، My Customers، Deals، Tasks، Activities، **Customer 360° (Read-only)** — بدون Billing، Users، Pipelines config، Settings و بدون Delete عملیات حساس.

- **نقش‌ها در کد/API:** نگاشت به نقش‌های موجود JWT و Prisma:  
  - **ADMIN** ↔ `OWNER` (Membership.role)  
  - **USER** ↔ `MEMBER` (Membership.role)  
  تا زمانی که مدل نقش گسترش نیافته، از همین نگاشت استفاده می‌شود.

- **Customer 360° View** به‌عنوان صفحهٔ اصلی مانیتورینگ فروشنده برای هر مشتری تعریف می‌شود (اطلاعات پایه، فروش، مالی، فعالیت، پروژه، هشدارها) — Read-only برای USER.

---

## Alternatives Considered

| گزینه | مزایا | معایب | چرا رد شد؟ |
|--------|--------|--------|-------------|
| یک پنل برای همه با مخفی‌سازی منو | ساده در UI | سردرگمی، ریسک افشای مسیرها | نیاز به تفکیک واضح برای فروش و پشتیبانی |
| سه نقش (Admin / Manager / User) | جزئی‌تر | پیچیدگی در MVP، نیاز به ماتریس بزرگ‌تر | در فاز بعد قابل اضافه است |
| فقط Owner/Member بدون نام محصولی | هماهنگ با کد | برای PRD و فروش نامأنوس | نام‌های Admin/User در اسناد محصول و UI استفاده می‌شود؛ در API همان OWNER/MEMBER |

---

## Risks

- **نقش جدید در آینده:** در صورت اضافه شدن نقش (مثلاً Manager)، ماتریس دسترسی و پنل‌ها باید بازبینی شود. mitigations: اسناد RBAC و Permission matrix به‌صورت جدا نگهداری شود.
- **داده‌ی «مرتبط با خود» برای USER:** تعریف دقیق (ownerUserId، تخصیص لید و غیره) باید در Spec و مدل داده ثابت شود تا نشت داده رخ ندهد.

---

## Success Metrics

- فروشنده **بدون تماس با Admin** بتواند وضعیت مشتری را بفهمد و بداند چه کاری انجام دهد.
- Admin در **&lt; 5 دقیقه** وضعیت کل فروش و گلوگاه‌ها را ببیند.
- **هیچ داده‌ای** خارج از Tenant یا خارج از محدودهٔ نقش (Server-enforced) قابل مشاهده نباشد.

---

## Rollback

- در صورت بازگشت: نمایش یک پنل برای همه (مخفی‌سازی آیتم‌های منو بر اساس نقش، بدون تغییر backend).  
- تغییر نقش‌ها فقط از طریق تنظیمات و پس از به‌روزرسانی Spec و تست RBAC.

---

## ارجاع به اسناد بعدی

- **Spec اجرایی (RBAC، دسترسی، Guard):** [../specs/RBAC-PANELS.md](../specs/RBAC-PANELS.md)  
- **User Stories و معیار پذیرش هر پنل:** [../specs/PRD-PANELS-USER-STORIES.md](../specs/PRD-PANELS-USER-STORIES.md)
