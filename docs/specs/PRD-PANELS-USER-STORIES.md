# PRD: پنل‌ها و User Stories (با معیار پذیرش)

**وضعیت:** پیشنویس  
**آخرین به‌روزرسانی:** 2026-01-28  
**مرجع:** [proposals/ROLES-AND-PANELS.md](../proposals/ROLES-AND-PANELS.md), [RBAC-PANELS.md](RBAC-PANELS.md)

---

## تعریف نقش‌ها (خلاصه)

- **ADMIN (OWNER):** مدیر Tenant؛ دسترسی کامل به داده‌ها و تنظیمات داخل Tenant.
- **USER (MEMBER):** فروشنده؛ دسترسی به دادهٔ خود + مشاهدهٔ وضعیت مشتری (Customer 360°)؛ بدون Settings/Billing/Users/Pipelines و بدون حذف/ویرایش حساس در Payments/Contracts.

---

## 1. Dashboard

### ADMIN – User Stories

- به‌عنوان **Admin** می‌خواهم **KPI کل فروش** را ببینم (Leads، Deals، Conversion) تا وضعیت کسب‌وکار را ارزیابی کنم.
- به‌عنوان **Admin** می‌خواهم **وضعیت هر فروشنده** را مقایسه کنم تا عملکرد تیم را مدیریت کنم.
- به‌عنوان **Admin** می‌خواهم **مشتری‌های در خطر** (پرداخت عقب‌افتاده / بدون فعالیت) را ببینم تا گلوگاه‌ها را رفع کنم.

**KPIهای پنل Admin:**  
Leads این ماه، Deals فعال، Conversion Rate، Payments Overdue، Tasks overdue.

**Acceptance Criteria (ADMIN – Dashboard)**

- [ ] صفحهٔ Dashboard برای نقش OWNER KPIهای بالا را نمایش می‌دهد.
- [ ] مقایسهٔ فروشنده‌ها (مثلاً جدول یا کارت per user) قابل مشاهده است.
- [ ] لیست یا بلوک «مشتری در خطر» (پرداخت عقب‌افتاده / بدون فعالیت > X روز) نمایش داده می‌شود.

---

### USER – User Stories

- به‌عنوان **فروشنده** می‌خواهم **کارهای امروز خودم** را ببینم تا اولویت‌بندی کنم.
- به‌عنوان **فروشنده** می‌خواهم **لیدهای داغ** را سریع پیدا کنم تا پیگیری کنم.
- به‌عنوان **فروشنده** می‌خواهم بدانم **کدام مشتری نیاز به پیگیری** دارد تا فراموش نشود.

**KPIهای پنل Sales (My Dashboard):**  
My Open Deals، Tasks Today، Leads بدون پیگیری > X روز، آخرین فعالیت‌ها.

**Acceptance Criteria (USER – Dashboard)**

- [ ] صفحهٔ Dashboard برای نقش MEMBER فقط KPIهای «خود» را نمایش می‌دهد.
- [ ] کارهای امروز (Tasks) و لیدهای داغ/بدون پیگیری و آخرین فعالیت‌ها مرتبط با خود کاربر است.
- [ ] هیچ داده‌ای از سایر فروشنده‌ها نمایش داده نمی‌شود.

---

## 2. Leads

### ADMIN

- ساخت / ویرایش / تخصیص لید
- تغییر Stage
- Convert Lead → Customer
- دیدن تاریخچهٔ کامل فعالیت‌ها

**Acceptance Criteria (ADMIN – Leads)**

- [ ] Admin می‌تواند لید جدید بسازد و به کاربر تخصیص دهد.
- [ ] Admin می‌تواند Stage لید را تغییر دهد و Lead را به Customer تبدیل کند.
- [ ] تاریخچهٔ فعالیت‌های هر لید برای Admin قابل مشاهده است.

### USER

- مشاهدهٔ فقط لیدهای تخصیص‌یافته به خود
- ثبت تماس / یادداشت / فعالیت
- تغییر Stage (در محدودهٔ Pipeline مجاز)
- درخواست Convert یا Convert مستقیم طبق Policy

**Acceptance Criteria (USER – Leads)**

- [ ] فروشنده فقط لیست لیدهای assign شده به خود را می‌بیند.
- [ ] می‌تواند برای لید فعالیت (تماس، یادداشت) ثبت کند و در صورت مجاز Stage را تغییر دهد.
- [ ] امکان Convert به مشتری طبق policy (درخواست یا مستقیم) وجود دارد.
- [ ] API برای MEMBER فقط لیدهای assigneeId = userId برمی‌گرداند.

---

## 3. Customers (Clients)

### ADMIN

- مشاهده و ویرایش اطلاعات مشتری
- دیدن وضعیت کلی مشتری
- دسترسی به پروژه‌ها، قراردادها، پرداخت‌ها

**Acceptance Criteria (ADMIN – Customers)**

- [ ] Admin لیست همهٔ مشتری‌ها را می‌بیند و می‌تواند ویرایش کند.
- [ ] دسترسی به اطلاعات مرتبط (پروژه، قرارداد، پرداخت) برای هر مشتری وجود دارد.

### USER

- مشاهدهٔ فقط مشتری‌های مرتبط با خود
- دیدن وضعیت مشتری (Read-only)

**Acceptance Criteria (USER – Customers)**

- [ ] فروشنده فقط مشتری‌های «مرتبط با خود» (مثلاً دارای deal/lead با او) را در لیست می‌بیند.
- [ ] ویرایش اطلاعات مشتری برای MEMBER غیرفعال است (read-only).
- [ ] API برای MEMBER فقط مشتری‌های مجاز را برمی‌گرداند.

---

## 4. Customer 360° View (مانیتورینگ وضعیت مشتری)

برای **USER** این صفحه بسیار مهم است: فهم وضعیت مشتری بدون تماس با Admin.

### محتوا (Read-only برای USER)

- اطلاعات پایهٔ مشتری
- **وضعیت فروش:** Deals باز/بسته، آخرین Stage
- **وضعیت مالی:** پرداخت‌های انجام‌شده، اقساط عقب‌افتاده
- **فعالیت‌ها:** آخرین تماس، آخرین Task
- **وضعیت پروژه** (در صورت وجود)
- **هشدارها:** No activity > X days، Payment overdue

**Acceptance Criteria (Customer 360°)**

- [ ] صفحهٔ 360° برای هر مشتری (مثلاً `/customers/:id/360` یا تب Overview) وجود دارد.
- [ ] برای MEMBER فقط در صورت «مرتبط بودن» مشتری با خود کاربر در دسترس است؛ در غیر این صورت 403.
- [ ] تمام بلوک‌ها (اطلاعات پایه، فروش، مالی، فعالیت، پروژه، هشدارها) برای USER فقط خواندنی هستند.
- [ ] API مثلاً `GET /customers/:id/overview` با چک دسترسی MEMBER پیاده شده است.

---

## 5. Deals / Sales Pipeline

### ADMIN

- تعریف Pipeline و Stageها
- مشاهدهٔ همهٔ Dealها
- گزارش عملکرد فروشنده‌ها

**Acceptance Criteria (ADMIN – Deals)**

- [ ] Admin می‌تواند Pipeline و Stageها را در Settings مدیریت کند و همهٔ Dealها را ببیند.
- [ ] گزارش عملکرد (مثلاً per فروشنده) در دسترس است.

### USER

- مشاهدهٔ فقط Dealهای خود
- Drag & Drop در Kanban
- ثبت مبلغ، احتمال، تاریخ بستن

**Acceptance Criteria (USER – Deals)**

- [ ] فروشنده فقط Dealهای خود (ownerUserId = userId) را می‌بیند.
- [ ] Kanban با Drag & Drop برای تغییر Stage در دسترس است.
- [ ] امکان ویرایش مبلغ، احتمال، تاریخ بستن برای Dealهای خود وجود دارد.
- [ ] API برای MEMBER فیلتر ownerUserId اعمال می‌کند.

---

## 6. Tasks & Activities

### ADMIN

- مشاهدهٔ همهٔ Taskها
- Assign Task به کاربران
- گزارش بهره‌وری تیم

**Acceptance Criteria (ADMIN – Tasks/Activities)**

- [ ] Admin لیست همهٔ Taskها/Activityها را می‌بیند و می‌تواند Task به کاربر assign کند.
- [ ] گزارش بهره‌وری (اختیاری) در دسترس است.

### USER

- ایجاد Task برای خود
- ثبت تماس / جلسه / پیگیری
- بستن Task

**Acceptance Criteria (USER – Tasks/Activities)**

- [ ] فروشنده Taskهای خود را می‌بیند و می‌تواند Task جدید بسازد و Task را ببندد.
- [ ] ثبت Activity (تماس، جلسه، یادداشت) برای lead/deal/customer مرتبط امکان‌پذیر است.
- [ ] API برای MEMBER فیلتر بر اساس assignedTo/createdBy اعمال می‌کند.

---

## 7. Payments & Contracts

### ADMIN

- ایجاد قرارداد و ثبت پرداخت
- تغییر وضعیت پرداخت و Upload رسید

### USER

- **فقط مشاهده:** وضعیت پرداخت مشتری و قراردادها — **بدون ویرایش.**

**Acceptance Criteria (Payments & Contracts)**

- [ ] Admin می‌تواند قرارداد و پرداخت ایجاد/ویرایش کند.
- [ ] MEMBER فقط GET دارد؛ POST/PATCH/DELETE روی Payments/Contracts برای MEMBER با 403 پاسخ می‌دهد.
- [ ] در UI برای MEMBER دکمهٔ ایجاد/ویرایش/حذف در این بخش‌ها نمایش داده نمی‌شود.

---

## 8. Settings

### ADMIN

- مدیریت کاربران و تعیین نقش
- مدیریت Billing
- تنظیم Pipeline و Lead Sources

### USER

- **بدون دسترسی:** منو و مسیر Settings برای MEMBER مخفی/ممنوع است.

**Acceptance Criteria (Settings)**

- [ ] تنها OWNER به Settings (Users، Billing، Pipelines، Lead Sources) دسترسی دارد.
- [ ] منوی Settings برای MEMBER نمایش داده نمی‌شود.
- [ ] دسترسی مستقیم با URL به `/settings` برای MEMBER منجر به 403 یا redirect به صفحهٔ خطا می‌شود.
- [ ] APIهای Settings با `@Roles('OWNER')` محافظت شده‌اند.

---

## Definition of Done (خلاصهٔ محصول)

- فروشنده **بدون تماس با Admin** می‌تواند وضعیت مشتری را بفهمد و بداند چه کاری انجام دهد.
- Admin در **&lt; 5 دقیقه** وضعیت کل فروش و گلوگاه‌ها را می‌بیند.
- **هیچ داده‌ای** خارج از Tenant یا خارج از محدودهٔ نقش قابل مشاهده نباشد (**Server-enforced**).

---

## مراحل بعدی پیشنهادی

- به‌روزرسانی Navigation واقعی فرانت (Sidebar) بر اساس [RBAC-PANELS.md](RBAC-PANELS.md).
- پیاده‌سازی Guards و فیلترهای RBAC در backend برای هر resource.
- طراحی و پیاده‌سازی صفحهٔ Customer 360° و endpointٔ overview.
- افزودن تسک‌های اسپرینت در `docs/tasks/` برای هر بلوک بالا.
