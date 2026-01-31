# طراحی سایدبار — نسخهٔ حرفه‌ای (Sakhtar CRM)

**وضعیت:** پیاده‌سازی شده  
**مرجع:** پیشنهاد طراحی برای حس B2B و SaaS حرفه‌ای

---

## هدف

ساختار واضح، مینیمال، حرفه‌ای، قابل تشخیص در اولین نگاه — مناسب تجربه فروشنده/ادمین B2B.

---

## ساختار

### 1. عرض و حالت‌ها

| حالت | عرض | ویژگی |
|------|------|--------|
| Expanded (پیش‌فرض دسکتاپ) | `w-[280px]` | آیکون + عنوان |
| Collapsed (toggle دستی) | `w-[80px]` | فقط آیکون، با Tooltip عنوان |
| Mobile | Off-canvas | کامل مخفی، فقط با منوی همبرگری |

### 2. آیتم‌ها

| آیکون | عنوان | مقصد |
|-------|--------|------|
| LayoutDashboard | داشبورد | /dashboard |
| Users | مخاطبین | /contacts |
| Building2 | شرکت‌ها | /companies |
| HandCoins | معاملات | /deals |
| CheckSquare | کارها | /tasks |
| Activity | فعالیت | /activity |
| Upload | ورود داده | /import |
| Settings | تنظیمات | /settings (فقط OWNER) |

- در حالت collapse فقط آیکون با `title` (Tooltip مرورگر)
- در حالت expanded: متن با `text-sm font-medium`، فاصله بین آیتم‌ها `gap-2`

### 3. استایل

| عنصر | مقدار |
|------|--------|
| پس‌زمینه | `bg-[#f8f9fa]` (روشن)، `dark:bg-card` |
| Border راست (RTL: چپ) | `border-e border-border` |
| آیتم فعال | `bg-muted/80` + `border-e-2 border-primary` |
| آیتم‌ها | `hover:bg-muted/40`, `rounded-md`, `px-3 py-2`, `transition-colors` |
| فونت | Peyda، `text-sm font-medium` |
| آیکون | Lucide `size-5`، `text-muted-foreground` |

### 4. مکان دکمه‌ها

- **Switch Theme** و **Logout** در پایین سایدبار (`shrink-0`، زیر ناو)
- **نام Tenant** در بالای سایدبار در حالت expanded

### 5. قابلیت‌ها

- حالت collapse با دکمه در هدر سایدبار و `localStorage` برای persistence
- موبایل: دکمه همبرگری در هدر اصلی، سایدبار به‌صورت off-canvas (backdrop + translate)

---

## فایل‌های مرتبط

- `frontend/src/layout/AppLayout.tsx` — ساختار و استایل سایدبار
- `frontend/src/index.css` — عرض‌های `.app-shell-sidebar` و `.app-shell-main`
- `frontend/src/components/theme-toggle.tsx` — دکمه تم در پایین سایدبار
