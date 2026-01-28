# Sakhtar CRM — Frontend (React + Vite)

SPA با مسیر `/t/:tenantSlug/app`.

## مستندات و رفرنس

- **راهنمای کلی داکیومنت:** [../DOCUMENTATION.md](../DOCUMENTATION.md)
- **Spec و workflow (مرجع):** [../OpenSpec-main/](../OpenSpec-main/) — [concepts](../OpenSpec-main/docs/concepts.md), [workflows](../OpenSpec-main/docs/workflows.md)

## راه‌اندازی

```bash
npm install
npm run dev
```

پروکسی `/api` به backend روی `localhost:3000` تنظیم شده است.

## استایل و UI

- **توکن‌ها و Aurora:** `src/styles/theme.css`, `src/styles/aurora.css`
- **کامپوننت‌های شیشه‌ای:** `src/components/ui/glass.tsx`
- **تم روشن/تاریک:** `src/components/theme-toggle.tsx` با ذخیره در localStorage
