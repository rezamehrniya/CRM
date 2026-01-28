# معماری احراز هویت (Tenant-Safe) — Sakhtar CRM

> **مرجع spec و داکیومنت:** برای اصول نگارش spec و ساختار تغییرات به [OpenSpec-main](../OpenSpec-main/) و [docs/concepts.md](../OpenSpec-main/docs/concepts.md) رجوع شود.

## ۱. فلوی ورود

1. کاربر از مسیر `/t/:slug/app/login` وارد می‌شود (slug از URL).
2. `POST /api/t/:slug/auth/login` با body: `{ phoneOrEmail, password }`.
3. سرور:
   - `tenantSlug → tenantId` از middleware.
   - کاربر را با `email` یا `phone` پیدا می‌کند.
   - عضویت در همان tenant را چک می‌کند (`membership.status === ACTIVE`).
   - پس از تطبیق پسورد:
     - **Access Token** (JWT، ۱۵ دقیقه) در response body برمی‌گرداند.
     - **Refresh Token** را در **HttpOnly cookie** با `Path=/api/t/{slug}/auth` ست می‌کند.

## ۲. Token و Cookie

| نوع | عمر | محل |
|-----|-----|-----|
| Access | ۱۵ دقیقه | `Authorization: Bearer <token>` |
| Refresh | ۱۴ روز | HttpOnly cookie با `Path=/api/t/{slug}/auth` |

- Cookie با Path محدود به همان tenant ارسال می‌شود؛ توکن tenant A به مسیر tenant B فرستاده نمی‌شود.
- Refresh در DB (جدول `Session`) با hash ذخیره می‌شود تا امکان revoke وجود داشته باشد.

## ۳. ادعاهای JWT

**Access:** `sub` (userId), `tid` (tenantId), `role` (OWNER|MEMBER), `sid` (sessionId), `exp`.

**Refresh:** `sub`, `tid`, `sid`, `exp`.

## ۴. Guardهای ضد نشت

### لایه ۰: Tenant Resolution

- همه APIهای tenant-scope: `/api/t/:slug/...`.
- Middleware: slug → tenantId، `req.tenant = { id, slug, name, status }`.

### لایه ۱: JWT + تطابق Tenant

- **JwtAuthGuard:** توکن معتبر + `token.tid === req.tenant.id`.
- در صورت mismatch → **403** با `code: TENANT_MISMATCH`.

### لایه ۲: Query Guard (Tenant در کوئری)

- همه queryها: `where: { tenantId: req.tenant.id }`.
- در create: `tenantId` فقط از سرور تزریق می‌شود (از client قبول نمی‌شود).
- در update/delete: `findFirst({ where: { id, tenantId } })`؛ در صورت عدم یافتن → **404** (نه 403، برای جلوگیری از enumeration).

### لایه ۳: RBAC

- نقش‌ها: `OWNER`, `MEMBER`.
- **RolesGuard** و دکوراتور `@Roles('OWNER')` برای routeهای مخصوص مالک (مثلاً Billing/Users در فاز بعد).
- در MVP اکثر routeها برای هر دو نقش باز است.

### لایه ۴: RLS (فاز بعد)

- در roadmap: Row Level Security در PostgreSQL با `SET LOCAL app.tenant_id` و policy بر اساس `tenant_id`.

## ۵. قواعد پاسخ خطا

| وضعیت | کد | توضیح |
|--------|-----|--------|
| Token مربوط به tenant دیگر | **403** | `TENANT_MISMATCH` |
| منبع (مثلاً contact) متعلق به tenant دیگر یا موجود نباشد | **404** | بدون افشای وجود منبع در tenant دیگر |
| عدم احراز هویت | **401** | UNAUTHORIZED |

## ۶. چک‌لیست QA ضد نشت

- [ ] با توکن tenant A روی مسیر tenant B درخواست → **403 TENANT_MISMATCH**.
- [ ] `PATCH /contacts/:id` برای id متعلق به tenant دیگر → **404**.
- [ ] ارسال `tenantId` جعلی در body ایجاد contact → سرور ignore و `tenantId` واقعی تزریق شود.
- [ ] Export/Import فقط در scope tenant خود.
- [ ] فایل/دانلود با چک tenant.

## ۷. فایل، Cache، Job

- **Upload/Download:** مسیر ذخیره tenant-scoped؛ endpoint دانلود با چک tenant.
- **Logging:** هر log همراه با `tenantId`.
- **Cache:** کلید با پیشوند `tenant:{tid}:...`.
- **Background Job:** payload شامل `tenantId`؛ worker قبل از اجرا tenant را set کند.
