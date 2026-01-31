# چک‌لیست QA — نقش‌ها و دسترسی (RBAC)

**مرجع:** [specs/RBAC-PANELS.md](../specs/RBAC-PANELS.md) · [specs/PERMISSION-MATRIX.md](../specs/PERMISSION-MATRIX.md)

---

## ۱. MEMBER (فروشنده)

- [ ] **منو:** آیتم «تنظیمات» در سایدبار نمایش داده **نمی‌شود**.
- [ ] **URL مستقیم به `/t/:slug/app/settings`:** ریدایرکت به `/t/:slug/app/error?code=403` یا نمایش صفحهٔ خطای 403.
- [ ] **URL مستقیم به `/t/:slug/app/settings/billing`:** همان رفتار 403.
- [ ] **API Billing:** درخواست `GET /api/t/:slug/billing/subscription` با JWT نقش MEMBER → پاسخ **403** با code مناسب (مثلاً FORBIDDEN / Insufficient role).
- [ ] **API Settings:** درخواست `GET /api/t/:slug/settings` با JWT نقش MEMBER → پاسخ **403**.

---

## ۲. OWNER (مدیر)

- [ ] **منو:** آیتم «تنظیمات» نمایش داده می‌شود و کلیک به صفحهٔ Settings می‌رود.
- [ ] **صفحه Settings:** نمایش دسته‌بندی‌ها (کاربران، Pipeline، منابع لید، اشتراک) و لینک «مشاهده» برای Billing.
- [ ] **صفحه Settings > Billing:** نمایش وضعیت اشتراک و استفاده (صندلی) بدون خطای 403.
- [ ] **API Billing و Settings:** با JWT نقش OWNER پاسخ **200** و دادهٔ صحیح.
- [ ] **Logout:** دکمهٔ خروج در هدر کار می‌کند؛ پس از خروج ریدایرکت به لاگین و توکن پاک شده است.
- [ ] **Login مجدد:** پس از logout، login با همان کاربر (OWNER) بدون باگ انجام می‌شود.

---

## ۳. امنیت و پاسخ خطا

- [ ] **Tenant mismatch:** توکن tenant A با URL tenant B → **403 TENANT_MISMATCH** (طبق AUTH spec).
- [ ] **پاسخ 403:** بدنهٔ پاسخ شامل `statusCode`, `code`, `message` است (قالب استاندارد خطا).
- [ ] (اختیاری) **traceId:** در پاسخ‌های خطا (logout / forbidden) در صورت پیاده‌سازی در backend، وجود traceId چک شود.

---

## ۴. تست دستی پیشنهادی

1. ورود با کاربر **MEMBER** → بررسی منو (بدون تنظیمات) → تلاش برای ورود به `/t/demo/app/settings` از نوار آدرس → انتظار: 403 یا redirect به error.
2. ورود با کاربر **OWNER** → کلیک روی تنظیمات → مشاهدهٔ صفحه Settings → کلیک روی «مشاهده» اشتراک → مشاهدهٔ دادهٔ Billing.
3. با کاربر OWNER: Logout → Login مجدد → بررسی عدم خطا و نمایش صحیح منو و نقش در هدر.
4. با ابزار (DevTools / Postman): ارسال درخواست به `GET /api/t/demo/billing/subscription` با Bearer token کاربر MEMBER → انتظار: 403.
