# Spec: Billing & Seats

**وضعیت:** قفل‌شده (ستون‌فقرات محصول)  
**مرجع:** PRD / تصمیم «بدون Freemium»

---

## Scope / Non-goals

- **در scope:** پلن سالانه، محدودیت صندلی (Seat)، انقضا → read-only، Seat Pack.
- **خارج از scope:** پرداخت آنلاین در MVP (فاکتور دستی)، استفاده‌سنجی جزئی (در فاز بعد).

---

## Plan: CRM_ANNUAL

| مورد | مقدار |
|------|--------|
| نام | CRM_ANNUAL |
| دوره | سالانه |
| مبلغ | ۶۰٬۰۰۰٬۰۰۰ ریال/سال |
| تعداد صندلی پایه | ۲۰ |

---

## Seat Pack

- هر **Seat Pack** = +۵ صندلی.
- قابل خرید/تمدید همراه تمدید سالانه.
- قیمت و سیاست فروش جدا (در قرارداد/فاکتور).

---

## انقضا و حالت Read-only

- با **انقضای subscription**:
  - همهٔ endpointهای **نوشتنی** (POST/PATCH/DELETE) → **403** با `code: SUBSCRIPTION_EXPIRED`.
  - خواندن (GET) مجاز است (read-only).
- **SubscriptionActiveGuard** روی routeهای write؛ در غیر این صورت پاسخ استاندارد خطا.

---

## Payload و کدهای خطا

### پاسخ خطای انقضا

```json
{
  "statusCode": 403,
  "code": "SUBSCRIPTION_EXPIRED",
  "message": "Subscription has expired. Renew to enable write access."
}
```

### پاسخ استاندارد خطا (۴xx)

- `statusCode`: عدد HTTP
- `code`: رشتهٔ ثابت (مثلاً `SUBSCRIPTION_EXPIRED`, `SEAT_LIMIT_EXCEEDED`)
- `message`: متن قابل نمایش

---

## مدل داده (خلاصه)

- **Subscription:** tenantId، planId، startsAt، expiresAt، status.
- **Seat:** از تعداد `Membership` با status ACTIVE در آن tenant محاسبه می‌شود؛ نباید از سقف subscription بیشتر شود (در invite/add user چک شود).

---

## Acceptance Criteria

- [ ] پس از انقضا، writeها 403 با code SUBSCRIPTION_EXPIRED برمی‌گردانند.
- [ ] خواندن پس از انقضا مجاز است.
- [ ] Seat Pack و سقف در اضافه کردن کاربر اعمال می‌شود.
