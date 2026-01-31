# Spec: Auth (JWT + Cookie + Session)

**وضعیت:** قفل‌شده (ستون‌فقرات امنیتی)  
**جزئیات روایی:** [AUTH-ARCHITECTURE.md](../AUTH-ARCHITECTURE.md)

---

## قانون طلایی (Policy — اجباری)

- **Tenant in URL mandatory:** همهٔ endpointهای auth تحت `/api/t/:slug/auth/...`.
- **Tenant match in Guard:** `token.tid === req.tenant.id` وگرنه **403 TENANT_MISMATCH**.
- **All DB queries tenant-scoped:** Session و Membership با tenantId.

---

## Scope / Non-goals

- **در scope:** Login، Refresh، Logout، Me؛ access JWT کوتاه‌عمر؛ refresh در HttpOnly cookie با path محدود؛ session در DB؛ rotation/revoke.
- **خارج از scope:** 2FA، OAuth در MVP.

---

## Token و Cookie

| نوع | عمر | محل |
|-----|-----|-----|
| Access | ۱۵ دقیقه | `Authorization: Bearer <token>` |
| Refresh | ۱۴ روز | HttpOnly cookie با `Path=/api/t/{slug}/auth` |

- Cookie با Path محدود به همان tenant ارسال می‌شود.
- Refresh در DB (جدول `Session`) با hash ذخیره می‌شود تا امکان revoke وجود داشته باشد.

---

## ادعاهای JWT

**Access:** `sub` (userId), `tid` (tenantId), `role` (OWNER|MEMBER), `sid` (sessionId), `exp`.

**Refresh:** `sub`, `tid`, `sid`, `exp`.

---

## Endpointها

- `POST /api/t/:slug/auth/login` — بدنه: `{ phoneOrEmail, password }`؛ برمی‌گرداند: access در body؛ refresh در cookie.
- `POST /api/t/:slug/auth/refresh` — cookie ارسال می‌شود؛ برمی‌گرداند: access جدید؛ cookie جدید (rotation اختیاری).
- `POST /api/t/:slug/auth/logout` — باطل‌سازی session در DB؛ پاک‌کردن cookie.
- `GET /api/t/:slug/auth/me` — پروفایل کاربر و tenant (بعد از JWT).

---

## Refresh rotation / revoke

- در هر refresh می‌توان session قبلی را invalid کرد و session جدید صادر کرد (rotation).
- Logout → رکورد Session حذف یا marked invalid؛ cookie پاک.

---

## SessionId / Token versioning

- هر JWT حاوی `sid` (sessionId) است.
- در revoke، آن session در DB غیرفعال می‌شود؛ اعتبار سنجی بعدی (با همان refresh یا استفاده از access قدیمی) باید 401 برگرداند اگر session دیگر معتبر نباشد.

---

## قواعد پاسخ خطا

| وضعیت | کد HTTP | code | توضیح |
|--------|---------|------|--------|
| توکن مربوط به tenant دیگر | 403 | TENANT_MISMATCH | در Guard |
| منبع متعلق به tenant دیگر / وجود نداشته | 404 | — | بدون افشای وجود در tenant دیگر |
| عدم احراز هویت | 401 | UNAUTHORIZED | |

---

## Acceptance Criteria

- [ ] Login فقط با slug در URL؛ access در body، refresh در cookie با Path صحیح.
- [ ] Guard در عدم تطابق tid پاسخ 403 TENANT_MISMATCH می‌دهد.
- [ ] Logout باعث حذف/ابطال session و پاک شدن cookie می‌شود.
