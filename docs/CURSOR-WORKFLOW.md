# راهنمای Cursor: چرخه تغییر با OpenSpec

این سند دستورالعمل عملیاتی برای Cursor (و هر توسعه‌دهنده) است تا هر تغییر طبق **proposal → specs → design → tasks → implementation → QA** پیش برود.

---

## قانون طلایی

**هر تغییر باید این چرخه را طی کند:**  
**proposal → specs → design → tasks → implementation → QA**

پیاده‌سازی را **فقط بعد از «Apply» کردن** (ثبت در specs/design/tasks) شروع کنید.

---

## منبع حقیقت (ترتیب اولویت)

1. **docs/specs/** — قرارداد فنی؛ API؛ مدل داده؛ گاردریلت‌های امنیتی (**اجباری**).
2. **docs/design/** — استانداردهای UI، توکن‌ها، الگوهای تعامل.
3. **docs/tasks/** — بک‌لاگ، DoD، acceptance criteria.
4. **READMEها** — فقط راه‌اندازی و آشنایی؛ برای «چه چیزی درست است» به specs و design مراجعه کنید.

---

## قواعد اجباری ضد نشت (هیچ استثنایی نداشته باشند)

1. **Tenant in URL mandatory** — هیچ endpoint عملیاتی بدون `/t/:slug`.
2. **Tenant match enforced in Auth Guard** — اگر `JWT.tid !== req.tenant.id` → **403** با `code: TENANT_MISMATCH`.
3. **All DB queries tenant-scoped** — read: `where: { tenantId }`؛ update/delete: `findFirst({ id, tenantId })` → در صورت عدم یافتن **404**؛ create: `tenantId` **فقط از سرور** تزریق شود، از client قبول نشود.

---

## شش سند ستون‌فقرات (قفل‌شده)

- **docs/specs/BILLING-SEATS.md** — پلن، صندلی، انقضا، کدهای خطا.
- **docs/specs/TENANCY-ISOLATION.md** — سه گاردریل بالا + ممنوعیت دریافت tenantId از client.
- **docs/specs/AUTH.md** — JWT، cookie با Path، session، rotation/revoke.
- **docs/design/UI-STANDARDS.md** — Sidebar ۲۸۰/۸۰، DataTable، Jalali، Aurora/glass.
- **docs/specs/API-CONTRACT.md** — endpointها، pagination، قالب خطا، نمونه payload.
- **docs/tasks/SPRINT-0.md** (و SPRINT-X بعدی) — تیکت‌ها، DoD، QA.

هر تغییری که به API، مدل داده، امنیت یا UI مربوط است باید با این اسناد سازگار باشد.

---

## دستور پیشنهادی برای Cursor (وقتی تغییر جدید می‌خواهی)

می‌توانی این بلوک را به‌عنوان دستور اول به Cursor بدهی:

```
قبل از هر پیاده‌سازی، طبق OpenSpec پیش برو:

1. اگر تصمیم محصول/تجاری است: یک proposal در docs/proposals/ با قالب TEMPLATE.md بنویس (یا به پروپوزال موجود ارجاع بده).
2. قرارداد فنی را در docs/specs/ به‌روز کن یا سند جدید با _TEMPLATE.md اضافه کن (Scope، Data model، API contract، Edge cases، Security، AC، Test plan).
3. اگر به UI مربوط است: docs/design/ (مثلاً UI-STANDARDS.md) را رعایت کن و در صورت نیاز به‌روز کن.
4. تسک‌های قابل اجرا را در docs/tasks/ (مثلاً SPRINT-X.md) با DoD و AC ثبت کن.
5. سه گاردریل ضد نشت (Tenant in URL، Guard تطابق tid، queryهای tenant-scoped) را نقض نکن.
6. فقط بعد از این مراحل پیاده‌سازی را شروع کن و در پایان چک‌لیست QA مربوطه را اجرا کن.
```

---

## خلاصه مسیرها

| چی نیاز داری | کجا نگاه کنی |
|---------------|----------------|
| قرارداد API / خطا / مدل داده | docs/specs/ به‌ویژه API-CONTRACT، AUTH، TENANCY-ISOLATION |
| استاندارد UI / توکن / کامپوننت | docs/design/UI-STANDARDS.md و frontend/src/styles/ |
| بک‌لاگ و DoD | docs/tasks/SPRINT-0.md و قالب _TEMPLATE-SPRINT.md |
| مرجع فلسفه Spec و workflow | OpenSpec-main/docs/ (concepts، getting-started، workflows) |
