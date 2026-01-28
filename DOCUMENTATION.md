# راهنمای داکیومنت و رفرنس — Sakhtar CRM

این سند نقطه ورود به تمام مستندات و مرجع‌های پروژه است.

## اسناد داخلی (پوشه docs/)

- **[docs/README.md](docs/README.md)** — فهرست اسناد پروژه
- **[docs/AUTH-ARCHITECTURE.md](docs/AUTH-ARCHITECTURE.md)** — معماری Auth (JWT، cookie، Guard، 403/404)

## مرجع Spec و داکیومنت: OpenSpec-main

پوشه **[OpenSpec-main/](OpenSpec-main/)** فریم‌ورک Spec و مرجع داکیومنت است. در همه‌ی موارد زیر از آن استفاده کنید:

| نیاز | رفرنس در OpenSpec-main |
|------|-------------------------|
| مفاهیم Spec و Change، artifacts، ساختار openspec/ | [OpenSpec-main/docs/concepts.md](OpenSpec-main/docs/concepts.md) |
| نحوه شروع، ساختار specs/ و changes/ | [OpenSpec-main/docs/getting-started.md](OpenSpec-main/docs/getting-started.md) |
| الگوهای workflow (Quick Feature، Exploratory و غیره) | [OpenSpec-main/docs/workflows.md](OpenSpec-main/docs/workflows.md) |
| دستورات Slash و مهارت‌های AI | [OpenSpec-main/docs/commands.md](OpenSpec-main/docs/commands.md) |
| مرجع CLI (openspec init, show, archive و …) | [OpenSpec-main/docs/cli.md](OpenSpec-main/docs/cli.md) |
| نصب و پشتیبانی ابزارها | [OpenSpec-main/docs/installation.md](OpenSpec-main/docs/installation.md) ، [supported-tools.md](OpenSpec-main/docs/supported-tools.md) |
| سفارشی‌سازی schema و artifact | [OpenSpec-main/docs/customization.md](OpenSpec-main/docs/customization.md) |

**خلاصه از [OpenSpec-main/README.md](OpenSpec-main/README.md):** OpenSpec با اصل «fluid نه rigid»، proposal → specs → design → tasks را برای هر change پیشنهاد می‌دهد و با دستوراتی مثل `/opsx:new`, `/opsx:ff`, `/opsx:apply`, `/opsx:archive` در ابزارهای AI قابل استفاده است.

## مسیرهای کلیدی پروژه

- **ریپو و اجرا:** [README.md](README.md)
- **Backend:** `backend/` — NestJS، Prisma؛ متغیرها در `backend/.env.example`
- **Frontend:** `frontend/` — React، Vite، Tailwind، Aurora/Glass UI
