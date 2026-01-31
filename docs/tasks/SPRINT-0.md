# Sprint 0 — زیرساخت و قفل Spec

**هدف:** تکمیل زیرساخت، قفل کردن Specهای ستون‌فقرات و اطمینان از رعایت چرخه proposal → spec → design → tasks.

---

## Goal

- ساختار `docs/` (proposals, specs, design, tasks, adr) و قالب‌ها ایجاد شده.
- ۶ سند ستون‌فقرات قفل شده و در کد و رفتار اعمال شده‌اند.
- Cursor (و هر dev) از «منبع حقیقت» و قواعد ضد نشت مطلع باشد.

---

## Tickets (خلاصه)

| ID | شرح | DoD / AC |
|----|------|----------|
| SAK-001 | ساختار پوشه‌های docs و قالب Proposal/Spec/Tasks | پوشه‌ها و TEMPLATEها موجود؛ docs/README به‌روز |
| SAK-002 | سند BILLING-SEATS و تناظر با Guard/مدل | docs/specs/BILLING-SEATS.md؛ SubscriptionActiveGuard روی writeها |
| SAK-003 | سند TENANCY-ISOLATION و سه گاردریل اجباری | docs/specs/TENANCY-ISOLATION.md؛ URL + Guard + query در کد |
| SAK-004 | سند AUTH و تناظر با JWT/cookie/Session | docs/specs/AUTH.md؛ رفتار مطابق AUTH-ARCHITECTURE |
| SAK-005 | سند UI-STANDARDS و Aurora/glass | docs/design/UI-STANDARDS.md؛ فرانت مطابق توکن و کامپوننت |
| SAK-006 | سند API-CONTRACT و نمونه payload/خطا | docs/specs/API-CONTRACT.md؛ endpointها و قالب خطا یکسان |
| SAK-007 | DOCUMENTATION.md: بخش Source of Truth | ترتیب: specs → design → tasks → READMEها |
| SAK-008 | قانون ضد نشت در Specها (Policy) | سه گاردریل در TENANCY و AUTH به‌صورت اجباری ثبت شده |
| SAK-009 | Cursor workflow / Prompt برای OpenSpec | فایل راهنما یا rule برای proposal→spec→design→tasks→implementation |

---

## Dependencies

- OpenSpec-main به‌عنوان مرجع در ریپو موجود است.
- Backend و Frontend فعلی پایهٔ اعمال Specها هستند.

---

## QA Checklist

- [ ] هیچ endpoint عملیاتی بدون `/t/:slug` نیست.
- [ ] با توکن tenant A روی مسیر tenant B → 403 TENANT_MISMATCH.
- [ ] ایجاد منبع با tenantId در body → سرور ignore و tenantId واقعی تزریق شود.
- [ ] پس از انقضای subscription، writeها 403 SUBSCRIPTION_EXPIRED.

---

## Release Checklist

- [ ] تمام اسناد در docs/ commit شده‌اند.
- [ ] DOCUMENTATION.md و docs/README.md به‌روز هستند.
- [ ] تیم از مسیرهای specs / design / tasks مطلع است.
