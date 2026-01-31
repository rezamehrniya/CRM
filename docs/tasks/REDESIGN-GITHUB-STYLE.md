# بازطراحی کامل پنل به سبک GitHub (Primer Design System)

**نوع:** طراحی UI/UX — قابل اجرا توسط Cursor یا Dev Agent  
**زبان:** فارسی (RTL)، فونت Peyda  
**خروجی:** پنل Sakhtar CRM با حس و لایه‌بندی شبیه GitHub، سازگار با مخاطب فارسی.

---

## هدف

بازطراحی کامل پنل Sakhtar CRM بر اساس سبک طراحی **GitHub**، با ترکیب **سیستم طراحی Primer** و نیازهای فارسی‌زبان (RTL + فونت Peyda).  
خروجی نهایی باید از نظر سبک، لایه‌بندی، پالت رنگ و حس کلی شبیه پنل GitHub باشد، بدون تغییر زبان یا محتوای فارسی.

---

## ساختار پروژه (مرجع)

| لایه | تکنولوژی |
|------|----------|
| Frontend | React + Vite + Tailwind |
| UI System | shadcn/ui + aurora.css |
| تم | Theme switcher فعال (Light/Dark)، متغیرهای CSS در `theme.css` |
| لایه‌بندی | Sidebar, Header, AppLayout, Pages |

**فایل‌های کلیدی برای تغییر:**
- `frontend/src/layout/AppLayout.tsx` — layout اصلی، Sidebar، Header
- `frontend/src/styles/theme.css` — پالت و متغیرهای تم
- `frontend/src/styles/aurora.css` — کارت/پنل/جدول
- `frontend/src/components/ui/*` — Card, Button, Input, Separator
- `frontend/src/pages/*` — جداول، فرم‌ها، داشبورد

---

## قواعد طراحی به سبک GitHub

### 1. رنگ‌ها (Light Mode)

| کاربرد | مقدار | یادداشت |
|--------|--------|---------|
| پس‌زمینه صفحه | `#FFFFFF` | page |
| پس‌زمینه کارت/سکشن | `#F6F8FA` | card |
| مرز | `#E0E6EB` | border |
| hover | `rgba(0,0,0,0.03)` | subtle |
| متن اصلی | `#1F2328` | foreground |
| متن ثانویه | `#656D76` | muted-foreground |
| لینک/آکشن اصلی | `#0969DA` | primary (GitHub blue) |
| فونت | Peyda | 14px، وزن 400–600 |

**Dark Mode:** حفظ رفتار فعلی با پالت تیره (Primer Dark)؛ تداخل با Light نداشته باشد.

### 2. ساختار لایه‌ها

#### Sidebar
- چسبیده به چپ در LTR؛ در **RTL** چسبیده به **راست**.
- عرض ثابت: **240px** (در حالت collapse فقط آیکون با tooltip، عرض ~64px).
- پس‌زمینه: `#F6F8FA`.
- آیتم‌ها: آیکون Lucide + متن؛ فونت `text-sm`, `font-medium`.
- **Highlight آیتم فعال:** نوار رنگی باریک سمت راست (در RTL سمت چپ نوار)، رنگ `#0969DA` (`bg-[#0969DA]` یا متغیر `--primary`).
- مرز با محتوا: `border-e` (در RTL: `border-s`) با رنگ `#E0E6EB`.

#### Header
- ارتفاع ثابت: **56px**.
- پس‌زمینه: سفید `#FFFFFF` با `border-b` به رنگ `#E0E6EB`.
- محتوا: عنوان صفحه (یا breadcrumb)، دکمه theme toggle، آواتار کاربر (با امکان dropdown).
- تراز: راست‌چین؛ فاصله‌گذاری یکنواخت (`px-6` یا `px-8`).

#### Main Content
- فاصله‌گذاری: `px-8`, `py-6` (یا معادل در breakpointهای مختلف).
- عرض محتوا: `max-w-7xl`, `mx-auto`.
- کارت‌ها: `rounded-xl`, `border` با `#E0E6EB`, پس‌زمینه `#F6F8FA`.

#### Table
- **بدون** خط grid عمودی؛ فقط borderهای افقی (بالا/پایین ردیف).
- **Header:** پس‌زمینه `#F6F8FA`, `font-semibold`, سایز کوچک (مثلاً `text-xs` یا `text-sm` با small-caps اگر خوانا باشد).
- **Row hover:** پس‌زمینه `#F0F2F5` یا معادل کم‌کنتراست.
- مرز ردیف: `border-b` با `#E0E6EB`.

#### Button
- سبک ساده؛ رنگ اصلی `#0969DA`؛ border و hover ملایم.
- `variant="ghost"`: بدون سایه یا پس‌زمینه قابل توجه؛ فقط hover ملایم.
- ارتفاع ثابت: `h-8`؛ فونت حدود `13px` یا `text-sm`.

#### Input / Field
- مرز: `#D0D7DE`؛ focus ring: `#0969DA`.
- پس‌زمینه: سفید.
- Label بالا با رنگ `#656D76` (muted-foreground).

### 3. رفتارها

- **Responsive:** breakpointهای `sm` / `md` / `lg`؛ در موبایل Sidebar به صورت off-canvas + overlay.
- **Scrollbar:** پنهان ولی قابل اسکرول (`overflow-auto` + کلاس `hide-scrollbar` در صورت نیاز).
- **انیمیشن:** فقط در hoverها؛ `transition-colors duration-150`.

### 4. تایپوگرافی

- فونت: **Peyda** (ترجیحاً با FaNum برای اعداد در فرم‌ها).
- متن معمولی: `font-normal`, `text-sm`, `leading-6`.
- عنوان‌ها: `font-semibold`, `text-lg`.
- متن توضیحی: `text-muted-foreground` (معادل `#656D76` در Light).

### 5. فرم‌ها

- شبیه فرم‌های تنظیمات GitHub:
  - فیلدها تمام عرض.
  - دکمه‌های اصلی پایین راست (در RTL پایین چپ).
  - سکشن‌ها با `border-b` از هم جدا.

### 6. خطا و هشدار (Alert)

- آیکون در سمت راست (در RTL سمت چپ).
- border رنگی؛ پس‌زمینه ملایم.
- رنگ‌ها:
  - قرمز (خطا): `#CF222E`
  - زرد (هشدار): `#BF8700`
  - سبز (موفق): `#1A7F37`

---

## خروجی مورد انتظار (Checklist)

- [ ] **Layout:** بازنویسی/بازطراحی `AppLayout.tsx` مطابق Sidebar + Header + Main بالا.
- [ ] **Sidebar:** عرض 240px، پس‌زمینه و مرز و highlight فعال با رنگ GitHub blue.
- [ ] **Header:** ارتفاع 56px، سفید، border پایین، شامل theme toggle و آواتار.
- [ ] **تم:** به‌روزرسانی `theme.css` (و در صورت نیاز `aurora.css`) برای پالت GitHub-style (رنگ‌ها و فاصله‌ها).
- [ ] **Card:** سبک GitHub (rounded-xl, border, bg کارت).
- [ ] **Table:** بدون grid عمودی؛ header و row hover مطابق بالا.
- [ ] **Form:** تمام عرض؛ دکمه‌ها پایین راست؛ سکشن‌ها با border-b.
- [ ] **Button / Input:** ارتفاع و رنگ و focus ring مطابق قواعد بالا.
- [ ] **Alert:** آیکون + border رنگی + رنگ‌های خطا/هشدار/موفق.
- [ ] **RTL:** همه‌چیز راست‌چین و جهت RTL حفظ شود.
- [ ] **فونت:** Peyda در همه‌جا؛ اعداد در فرم‌ها با FaNum در صورت امکان.
- [ ] **زبان:** دکمه‌ها، فرم‌ها و متن‌ها فارسی بمانند؛ فقط استایل شبیه GitHub.

---

## پیاده‌سازی ترجیحی

- استفاده از **Tailwind** و **shadcn/ui**؛ تا حد امکان بدون custom CSS اضافه.
- رنگ‌ها از طریق **متغیرهای CSS** در `theme.css` (مثلاً `--color-canvas-default`, `--color-border-default`, `--color-accent-fg`) تا theme-switch و Dark Mode بدون تداخل کار کنند.
- در صورت نیاز به آیکون: **Lucide**.

---

## مراجع

- [Primer Design System](https://primer.style/)
- [GitHub Primer Colors](https://primer.style/foundations/color)
- پالت فعلی پروژه: `frontend/src/styles/theme.css` (قبلاً با Primer Light هم‌تراز شده).

---

## استفاده از این سند

- **Cursor / Dev Agent:** این فایل را به‌عنوان پرامپت و چک‌لیست اجرا استفاده کنید؛ هر بخش «قواعد طراحی» و «خروجی مورد انتظار» را به‌صورت گام‌به‌گام اعمال کنید.
- **Notion / فریلنسر:** می‌توان این سند را در Notion کپی کرد یا به صورت PDF/لینک به repo به توسعه‌دهنده داد تا همان قواعد و چک‌لیست را رعایت کند.

---

*آخرین به‌روزرسانی: بر اساس پرامپت بازطراحی GitHub-style برای پنل Sakhtar CRM.*
