# Design: ناوبری و پنل‌ها (Admin / Sales)

**مرجع:** [specs/RBAC-PANELS.md](../specs/RBAC-PANELS.md) · [proposals/ROLES-AND-PANELS.md](../proposals/ROLES-AND-PANELS.md)

---

## سایدبار بر اساس نقش

- **OWNER (Admin):** همهٔ آیتم‌ها از جمله **تنظیمات**.
- **MEMBER (Sales):** همان آیتم‌ها **بدون** تنظیمات؛ دسترسی مستقیم به `/settings` → redirect به `/app/error?code=403`.

آیتم‌های با `adminOnly: true` فقط برای `role === 'OWNER'` نمایش داده می‌شوند.

---

## Wireframe متنی — پنل Admin

```
┌─ Sidebar (چپ در RTL) ─────────────────┐
│  Sakhtar CRM                    [◀]   │
├───────────────────────────────────────┤
│  📊 داشبورد                           │
│  👥 مخاطبین                           │
│  🏢 شرکت‌ها                            │
│  🤝 معاملات                           │
│  ✅ کارها                             │
│  📌 فعالیت                            │
│  📤 ورود داده                         │
│  ⚙️ تنظیمات                           │  ← فقط OWNER
└───────────────────────────────────────┘
```

---

## Wireframe متنی — پنل Sales (USER)

```
┌─ Sidebar ─────────────────────────────┐
│  Sakhtar CRM                    [◀]   │
├───────────────────────────────────────┤
│  📊 داشبورد                           │
│  👥 مخاطبین                           │
│  🏢 شرکت‌ها                            │
│  🤝 معاملات                           │
│  ✅ کارها                             │
│  📌 فعالیت                            │
│  📤 ورود داده                         │
│  (تنظیمات نمایش داده نمی‌شود)         │
└───────────────────────────────────────┘
```

---

## پیاده‌سازی فرانت

- **AuthContext:** `/auth/me` برای گرفتن `role`؛ ذخیرهٔ `accessToken` پس از لاگین و ارسال در هدر درخواست‌ها.
- **AppLayout:** `useAuth().role`؛ فیلتر `navItems` با `adminOnly`؛ `useEffect` برای redirect به `/app/error?code=403` در صورت دسترسی مستقیم MEMBER به `/settings`.
