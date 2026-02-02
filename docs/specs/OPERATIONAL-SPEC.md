# Spec عملیاتی کامل — ارتباط صفحات، RBAC، و امکانات هر نقش

این سند **ارتباط صفحات با هم** (data flow + navigation flow)، **امکانات هر نقش** (فروشنده vs مدیر فروش) برای هر صفحه، و **قوانین RBAC و ناوبری** را مشخص می‌کند. خروجی قابل استفاده مستقیم به‌عنوان PRD/UI spec است.

**نقش‌ها:**
- **مدیر فروش = OWNER**
- **فروشنده = MEMBER**

---

## 1) مدل ارتباط صفحات با هم (Core Relationship Map)

### موجودیت‌های محوری

| موجودیت | توضیح |
|--------|--------|
| **Contact (مخاطب)** | فرد |
| **Company (شرکت)** | سازمان/کسب‌وکار |
| **Deal (معامله)** | فرصت فروش در Pipeline |
| **Lead (لید)** | سرنخ اولیه (قبل از تبدیل) |
| **Task (کار)** | پیگیری‌ها |
| **Activity (فعالیت)** | ثبت تعامل (تماس/جلسه/یادداشت) |
| **Membership (اعضا)** | کاربران سیستم + نقش‌ها |
| **Pipeline/Stages (مراحل فروش)** | ساختار جریان Deal |

### ارتباطات اصلی (Foreign Keys منطقی)

- **Contact ↔ Company:** یک مخاطب می‌تواند به یک شرکت وصل باشد
- **Deal ↔ (Contact \| Company):** معامله می‌تواند به مخاطب یا شرکت لینک شود
- **Lead ↔ OwnerUser:** لید به یک مسئول (فروشنده) تخصیص می‌یابد
- **Task ↔ (Contact \| Deal \| Company):** تسک می‌تواند مرتبط باشد
- **Activity ↔ (Contact \| Deal):** فعالیت‌ها مرتبط به مشتری/معامله
- **Import → Contacts/Companies:** ورود داده این دو را می‌سازد/به‌روزرسانی می‌کند

### سه مسیر اصلی کار (Workflows)

#### WF-1: Lead → Deal (مسیر استاندارد فروش)

1. ایجاد Lead (یا Import)
2. تماس/پیگیری (Activity + Task)
3. تبدیل Lead به: Contact + Company (در صورت نیاز) + Deal در Stage اول Pipeline
4. پیشبرد Deal تا برد/باخت

#### WF-2: Contact/Company → Deal

1. ایجاد Contact یا Company
2. ایجاد Deal مرتبط
3. ثبت Activity + ساخت Task برای follow-up
4. پیشبرد Deal

#### WF-3: Daily Execution (کار روزانه فروشنده)

1. Dashboard → «کارهای امروز من»
2. باز کردن Task
3. ثبت Activity
4. به‌روزرسانی Lead/Deal
5. بستن Task (Done)

---

## 2) اصول RBAC و Ownership (قانون ساده و قابل اجرا)

### قانون دیدن داده‌ها (Read Scope)

- **مدیر فروش (OWNER):** همه داده‌های tenant را می‌بیند
- **فروشنده (MEMBER):**
  - پیش‌فرض: داده‌های **ownerUserId = خودش**
  - هر چیزی که به او **assigned** شده (Lead/Task/Deal)

> اگر در محصول «اشتراک‌گذاری داده بین فروشنده‌ها» ندارید، همین قانون ساده بهترین است.

### قانون تغییر داده‌ها (Write Scope)

- **OWNER:** کامل
- **MEMBER:** فقط روی مواردی که owner/assigned خودش است
- **استثناها:** Import و Settings فقط OWNER

---

## 3) Spec هر صفحه: ارتباطات + امکانات نقش‌ها

### 3.1 داشبورد

**ارتباطات:** Pull از Tasks, Leads, Deals, Activities؛ KPIها از تجمیع همین‌ها.

| نقش | امکانات |
|-----|---------|
| **فروشنده (MEMBER)** | کارت‌ها: کارهای امروز من، لیدهای جدید من، معاملات در خطر، آخرین فعالیت‌های من. اکشن‌های سریع: ایجاد Task، ثبت Activity، ایجاد Lead. |
| **مدیر فروش (OWNER)** | همه موارد بالا + نمای کلی تیم: KPI تیمی (تعداد لیدها، نرخ تبدیل، معاملات فعال)، Performance per member. فیلتر: بر اساس فروشنده، بازه زمانی. |

---

### 3.2 مخاطبین (Contacts)

**ارتباطات:** Contact می‌تواند به Company وصل شود؛ Contact → Deals، Activities، Tasks.

| نقش | امکانات |
|-----|---------|
| **فروشنده** | لیست مخاطبین تخصیص‌یافته به خودش؛ ایجاد/ویرایش مخاطب (فقط owner خودش)؛ مشاهده Contact Detail: اطلاعات شخصی، شرکت مرتبط، معاملات، فعالیت‌ها و کارها. |
| **مدیر فروش** | دسترسی به همه مخاطبین؛ تغییر مالک/مسئول مخاطب (Reassign). Import فقط OWNER (در صفحه Import). |

---

### 3.3 شرکت‌ها (Companies)

**ارتباطات:** Company → Contacts؛ Company → Deals؛ Customer 360 (Contacts + Deals).

| نقش | امکانات |
|-----|---------|
| **فروشنده** | مشاهده شرکت‌های مربوط به خودش؛ ایجاد/ویرایش شرکت (در محدوده خودش)؛ Company Detail: لیست مخاطبین و معاملات شرکت؛ اکشن سریع: ایجاد Deal جدید برای شرکت. |
| **مدیر فروش** | مشاهده همه + Reassign company owner؛ (اختیاری) Merge duplicate companies. |

---

### 3.4 معاملات (Deals)

**ارتباطات:** Deal به PipelineStage وصل است؛ Deal می‌تواند Contact/Company داشته باشد؛ Deal → Activities + Tasks.

| نقش | امکانات |
|-----|---------|
| **فروشنده** | لیست معاملات خودش؛ فیلترها: Stage، Close date، Amount range؛ ایجاد Deal (برای خودش)؛ تغییر Stage (select یا drag/drop)؛ Deal Detail: اطلاعات، فعالیت‌ها، کارها، لینک به Contact/Company. |
| **مدیر فروش** | همه موارد + دید تیمی + فیلتر بر اساس فروشنده؛ تغییر Stage هر معامله؛ تغییر owner (Reassign)؛ تنظیم Pipeline از Settings. |

---

### 3.5 لیدها (Leads)

**ارتباطات:** Lead هنوز مشتری قطعی نیست؛ Lead → تبدیل به Contact/Company + Deal؛ Lead → Tasks + Activities (پیگیری).

| نقش | امکانات |
|-----|---------|
| **فروشنده** | ایجاد Lead جدید؛ فیلتر بر اساس status؛ ثبت followUpAt؛ اکشن‌ها: «تماس انجام شد» → Activity، «ایجاد Task پیگیری»، «تبدیل به مشتری/معامله» (اگر مجاز)؛ محدودیت: فقط لیدهای خودش. |
| **مدیر فروش** | مشاهده همه لیدها؛ تخصیص لید به فروشنده (Assign)؛ تغییر وضعیت لید؛ تبدیل Lead به Deal حتی اگر owner فروشنده دیگر باشد (در صورت سیاست). |

---

### 3.6 کارها (Tasks)

**ارتباطات:** Task می‌تواند به Contact/Company/Deal لینک شود؛ نتیجه Task در Activity ثبت می‌شود.

| نقش | امکانات |
|-----|---------|
| **فروشنده** | لیست کارهای من؛ فیلتر وضعیت OPEN/DONE؛ Due date (شمسی)؛ Mark as done؛ ایجاد Activity از داخل Task (ثبت نتیجه تماس)؛ Task Detail: اطلاعات + لینک‌های مرتبط. |
| **مدیر فروش** | مشاهده همه کارهای تیم؛ Assign task به فروشنده‌ها؛ گزارش: overdue tasks per member. |

---

### 3.7 فعالیت (Activity)

**ارتباطات:** Activity روی Contact/Deal ثبت می‌شود؛ Activity می‌تواند نتیجه Task باشد.

| نقش | امکانات |
|-----|---------|
| **فروشنده** | لیست فعالیت‌های خودش؛ ثبت فعالیت جدید: CALL/MEETING/NOTE، لینک به contact/deal، تاریخ/زمان شمسی. (پیشنهاد: غیرقابل ویرایش؛ فقط حذف توسط OWNER) |
| **مدیر فروش** | دید کل فعالیت‌های تیم؛ فیلتر بر اساس user/type/date؛ pin کردن فعالیت مهم (اختیاری). |

---

### 3.8 ورود داده (Import)

**ارتباطات:** Import فقط Contacts/Companies را می‌سازد/آپدیت می‌کند.

| نقش | امکانات |
|-----|---------|
| **فروشنده** | ❌ دسترسی ندارد (یا فقط preview). دلیل: جلوگیری از آلودگی داده. |
| **مدیر فروش** | Import CSV مخاطب و شرکت؛ Mapping ستون‌ها؛ Validation: duplicate detection (phone/email/companyName)؛ Log نتیجه: created/updated/failed. |

---

### 3.9 مدیریت اعضا (Members)

**ارتباطات:** Membership به RBAC و Seat limit وصل است.

| نقش | امکانات |
|-----|---------|
| **فروشنده** | ❌ ندارد. |
| **مدیر فروش** | مشاهده اعضا؛ Invite/Disable؛ تعیین نقش (OWNER/MEMBER)؛ Seat usage: baseSeatLimit + addonSeats؛ (اختیاری) انتقال مالکیت tenant. |

---

### 3.10 تنظیمات (Settings)

**ارتباطات:** Settings: Pipeline، Lead sources، Billing، Users.

| نقش | امکانات |
|-----|---------|
| **فروشنده** | ❌ ندارد. |
| **مدیر فروش** | Pipeline stages (read-only یا editable)؛ Lead sources؛ Billing: وضعیت اشتراک، invoices؛ Users: لیست و نقش‌ها. |

---

## 4) قوانین ناوبری (Navigation Rules)

### Link Graph (لینک‌دهی بین صفحات)

- **از Lead:** لینک به Taskهای مرتبط، Activityهای مرتبط، لینک به Convert flow (به Contact/Company/Deal).
- **از Deal:** لینک به Contact/Company، لینک به Tasks/Activities.
- **از Company:** Customer 360 (contacts + deals).
- **از Contact:** لینک به company، لینک به deals.
- **از Task:** لینک به entity مرتبط؛ CTA برای ثبت activity.

---

## 5) تفاوت UX برای OWNER vs MEMBER (قانون کلی)

### OWNER در همه صفحات این اضافه را دارد

- فیلتر بر اساس عضو (member)
- Reassign owner/assignee
- Export (اگر دارید)
- Bulk actions (اختیاری)

### MEMBER در همه صفحات محدود است به

- My items
- No global settings
- No members management
- No import

---

## 6) Definition of Done (برای تحویل)

- **هر صفحه:**
  - یک حالت «My» برای MEMBER
  - یک حالت «All + filter by member» برای OWNER
- **لینک‌های cross-entity** کار می‌کنند.
- **Create:** بعد از ایجاد، به detail یا لیست برگردد.
- **در همه create forms:**
  - owner/assignee برای MEMBER پیش‌فرض خودش
  - owner/assignee برای OWNER قابل انتخاب

---

## پیگیری‌های ممکن (برای Cursor / تیم)

این Spec را می‌توان به موارد زیر تفکیک کرد:

1. **RBAC Matrix دقیق با Guardها** — نقش × صفحه × عملیات (read/write) و پیاده‌سازی در backend/frontend.
2. **Cross-linking** — لیست دقیق لینک‌های بین صفحات و entityها (از کدام صفحه به کدام با چه پارامتر).
3. **Filtering/Ownership** — فیلتر «فقط مال من» برای MEMBER و «همه + فیلتر عضو» برای OWNER در هر ماژول.
4. **Task list دقیق Backend + Frontend** — چک‌لیست پیاده‌سازی بر اساس همین Spec.
5. **Spec مسیرهای API** — endpointها و scope (per-role) برای هر صفحه.

**مراجع مرتبط در پروژه:**

- [RBAC-PANELS.md](./RBAC-PANELS.md) — نقش‌ها و پنل‌ها
- [PERMISSION-MATRIX.md](./PERMISSION-MATRIX.md) — ماتریس دسترسی
- [PRD-PANELS-USER-STORIES.md](./PRD-PANELS-USER-STORIES.md) — داستان‌های کاربری
- [API-CONTRACT.md](./API-CONTRACT.md) — قرارداد API
- [PRODUCT-AND-TECHNICAL-STATE.md](../PRODUCT-AND-TECHNICAL-STATE.md) — وضعیت فعلی محصول و فنی
