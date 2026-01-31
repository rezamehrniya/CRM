# Design: UI Standards (Aurora / Glass)

**وضعیت:** قفل‌شده (ستون‌فقرات UI)  
**مرجع:** فایل‌های `frontend/src/styles/theme.css` و `aurora.css`

---

## Scope / Non-goals

- **در scope:** Sidebar، DataTable، تاریخ شمسی، توکن‌های رنگی و glass، تم روشن/تاریک.
- **خارج از scope:** طراحی موبایل-first در MVP (دسکتاپ اول).

---

## Sidebar (Collapsible)

| حالت | عرض |
|------|------|
| باز | ۲۸۰px |
| بسته (collapsed) | ۸۰px |

- کلاس/کامپوننت: از قرارداد `sidebarItemClassName` و استایل `glass-panel` استفاده شود.
- آیتم فعال: حالت **pill** (مثلاً کلاس `sidebar-active` یا معادل).
- توگل تم و جستجو در Topbar.

---

## DataTable

- **پیشرفته (Advanced):** فیلتر سمت سرور، صفحه‌بندی سرور، sort.
- **PageSize پیش‌فرض:** ۲۵.
- استایل جدول: سطح شیشه‌ای (مثلاً `glass-table-surface`) برای سازگاری با Aurora.

---

## تاریخ

- **Jalali (شمسی) همه‌جا** برای نمایش به کاربر.
- **tooltip** با تاریخ میلادی (Gregorian) در صورت نیاز.
- ذخیره و مبادله با API به صورت ISO میلادی یا عدد timestamp (قرارداد API را ببینید).

---

## Aurora / Glass Tokens

- **پس‌زمینه:** کلاس `aurora-bg` برای صفحهٔ اصلی (گرادیان‌های نرم).
- **کارت‌ها:** `glass-card` برای KPI و بلوک‌های کوچک.
- **پنل‌ها:** `glass-panel` برای سایدبار و پنل‌های بزرگ.
- **جدول:** `glass-table-surface` برای سطح جدول.

---

## توکن‌های HSL (theme.css)

- **Primary:** مجنتا — `335 86% 44%` (#D01060).
- **Secondary:** بنفش — `255 55% 50%`.
- **Radius:** `--radius: 18px` برای کارت و دکمه.
- تم روشن و تاریک با متغیرهای `:root` و `.dark`.

---

## قرارداد کامپوننت‌ها

- **GlassCard / KPICard:** برای خلاصه‌های آماری و کارت‌های لیست.
- **Theme toggle:** تغییر بین light/dark با persistence (مثلاً localStorage).
- **JalaliDate:** نمایش شمسی + tooltip میلادی.

---

## Acceptance Criteria

- [ ] Sidebar ۲۸۰/۸۰ با حالت فعال pill.
- [ ] DataTable با pageSize=25 و پشتیبانی فیلتر/صفحه‌بندی سرور.
- [ ] تاریخ در UI شمسی با tooltip میلادی.
- [ ] پس‌زمینه Aurora و کارت/پنل glass در صفحات اصلی.
