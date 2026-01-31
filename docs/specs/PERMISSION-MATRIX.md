# ماتریس دسترسی (Permission Matrix) — قابل تحویل به تیم

**آخرین به‌روزرسانی:** 2026-01-28  
**مرجع:** [RBAC-PANELS.md](RBAC-PANELS.md) · [PRD-PANELS-USER-STORIES.md](PRD-PANELS-USER-STORIES.md)

---

## نقش‌ها

| نقش در UI | نقش در API/DB | توضیح |
|-----------|----------------|--------|
| **Admin (مدیر)** | `OWNER` | مدیر Tenant؛ دسترسی کامل به داده و تنظیمات داخل Tenant |
| **User (فروشنده)** | `MEMBER` | فروشنده؛ دسترسی به دادهٔ خود + مشاهدهٔ وضعیت مشتری؛ بدون Settings/Billing/Users |

---

## جدول دسترسی به بخش‌ها

| بخش | OWNER (Admin) | MEMBER (User) | توضیح |
|-----|----------------|----------------|--------|
| **Dashboard** | ✅ همه KPIها | ✅ شخصی (My) | |
| **Contacts / مخاطبین** | ✅ Full | ✅ Read-only (own) | MEMBER فقط مشتری‌های مرتبط |
| **Companies / شرکت‌ها** | ✅ Full | ✅ Read-only (own) | |
| **Leads** | ✅ Full | ✅ Own only؛ ثبت فعالیت؛ Convert طبق policy | |
| **Deals / معاملات** | ✅ Full | ✅ Own only؛ Kanban | |
| **Tasks** | ✅ Full؛ Assign | ✅ Own؛ ایجاد/بستن | |
| **Activities** | ✅ Full | ✅ Own | |
| **Payments & Invoices** | ✅ Full | ❌ Read-only (در آینده) | فعلاً Billing فقط OWNER |
| **Contracts** | ✅ Full | ❌ Read-only (در آینده) | |
| **Reports** | ✅ Full | محدود (طبق policy) | |
| **Settings** | ✅ Full | ❌ | منو مخفی + Route Guard + Backend 403 |
| **Billing (اشتراک/فاکتور)** | ✅ Full | ❌ | Backend @Roles('OWNER')؛ صفحه فقط OWNER |
| **Users & Roles** | ✅ Full (در آینده) | ❌ | |
| **Pipeline config** | ✅ Full (در آینده) | ❌ | |
| **Lead Sources** | ✅ Full (در آینده) | ❌ | |

---

## Routeهای Backend با محدودیت OWNER

| مسیر | محدودیت |
|------|---------|
| `GET/POST /api/t/:slug/billing/*` | `@Roles('OWNER')` |
| `GET /api/t/:slug/settings` | `@Roles('OWNER')` |
| (آینده) `/api/t/:slug/users/*` | `@Roles('OWNER')` |
| (آینده) `/api/t/:slug/settings/pipeline/*` | `@Roles('OWNER')` |
| (آینده) `/api/t/:slug/settings/lead-sources/*` | `@Roles('OWNER')` |

---

## Routeهای Frontend با محافظت OWNER

| مسیر | محافظت |
|------|---------|
| `/t/:slug/app/settings` | `<ProtectedRoute requireOwner>` + چک نقش در صفحه |
| `/t/:slug/app/settings/billing` | `<ProtectedRoute requireOwner>` + چک نقش در صفحه |
| (آینده) `/t/:slug/app/settings/users` | همان الگو |

- منوی سایدبار: آیتم «تنظیمات» فقط برای `role === 'OWNER'` نمایش داده می‌شود.
- دسترسی مستقیم با URL توسط `ProtectedRoute` به `/app/error?code=403` ریدایرکت می‌شود.

---

## معیار موفقیت (خلاصه)

- MEMBER تنظیمات و Billing را در منو نمی‌بیند و با URL مستقیم به 403 می‌رسد.
- OWNER می‌تواند به Settings و Billing دسترسی داشته باشد و logout/login بدون باگ کار کند.
- تمام routeهای تنظیماتی و Billing در Backend با `@Roles('OWNER')` محدود شده‌اند.
