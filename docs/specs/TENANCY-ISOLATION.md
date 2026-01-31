# Spec: Tenancy & Data Isolation

**وضعیت:** قفل‌شده (ستون‌فقرات امنیتی)  
**مرجع:** [AUTH.md](AUTH.md) و [AUTH-ARCHITECTURE.md](../AUTH-ARCHITECTURE.md)

---

## قانون طلایی (Policy — اجباری)

هر تغییر در API یا دیتابیس باید این سه گاردریل را رعایت کند. **Cursor و هر توسعه‌دهنده باید این‌ها را اجباری بداند، نه توصیه.**

### ۱. Tenant in URL mandatory

- **هیچ endpoint عملیاتی بدون `/t/:slug` نداریم.**
- تمام APIهای tenant-scoped: `POST/GET/PATCH/DELETE` تحت prefix `/api/t/:slug/...`.
- Frontend همیشه slug را از URL می‌گیرد و در هر درخواست ارسال می‌کند (در path).

### ۲. Tenant match enforced in Auth Guard

- اگر `JWT.tid !== req.tenant.id` → پاسخ **403** با `code: TENANT_MISMATCH`.
- این چک در **JwtAuthGuard** بعد از اعتبارسنجی امضای توکن انجام می‌شود.

### ۳. All DB queries are tenant-scoped

- **Read:** هر query شامل `where: { tenantId: req.tenant.id }` (یا معادل در join).
- **Update/Delete:** الگوی اجباری `findFirst({ where: { id, tenantId: req.tenant.id } })` سپس در صورت عدم یافتن → **404** (نه 403، برای جلوگیری از enumeration).
- **Create:** `tenantId` **فقط از سرور** تزریق می‌شود؛ از client قبول نمی‌شود و هرگز از body/query ست نمی‌شود.

---

## Scope / Non-goals

- **در scope:** مسیر API، middleware tenant resolution، تطابق tid در guard، کوئری‌های tenant-scoped در تمام ماژول‌ها.
- **خارج از scope:** RLS در PostgreSQL (در roadmap).

---

## مسیر و Middleware

- **Path pattern:** `/api/t/:tenantSlug/...`
- **TenantMiddleware:** نقش اول؛ slug را resolve می‌کند و `req.tenant = { id, slug, name, status }` ست می‌کند.
- در صورت tenant نامعتبر یا معلق → **404** یا **403** قبل از رسیدن به controller.

---

## ممنوعیت‌ها

- دریافت `tenantId` از client (header، query، body) برای تعیین tenant **ممنوع** است.
- تنها منبع حقیقت برای tenant فعلی: **مسیر URL** (slug) و بعد تطابق با `token.tid`.

---

## Roadmap: RLS

- در فاز بعد: Row Level Security در PostgreSQL با `SET LOCAL app.tenant_id` و policy بر اساس `tenant_id`.
- تا آن زمان، tenant-scoping در لایهٔ سرویس (Prisma where) اجباری است.

---

## Acceptance Criteria

- [ ] هیچ route عملیاتی بدون `/t/:slug` وجود ندارد.
- [ ] JwtAuthGuard در mismatch بودن tid پاسخ 403 TENANT_MISMATCH می‌دهد.
- [ ] تمام read با tenantId در where؛ تمام create با tenantId از سرور.
- [ ] update/delete با findFirst(id + tenantId) و در صورت عدم یافتن 404.
