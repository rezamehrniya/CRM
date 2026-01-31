# راهنمای داکیومنت و رفرنس — Sakhtar CRM

این سند نقطه ورود به تمام مستندات و مرجع‌های پروژه است.

## Source of Truth (ترتیب اولویت برای Cursor و توسعه‌دهندگان)

**قراردادها و تصمیم‌های الزام‌آور از این‌جا می‌آیند. READMEها آموزشی و راه‌اندازی هستند؛ Specها قرارداد هستند.**

1. **`docs/specs/*`** — قرارداد فنی، API، مدل داده، گاردریلت‌های امنیتی (اجباری).
2. **`docs/design/*`** — استانداردهای UI، توکن‌ها، الگوهای تعامل.
3. **`docs/tasks/*`** — بک‌لاگ قابل اجرا، DoD، معیار پذیرش.
4. **READMEها** (ریپو، backend، frontend) — صرفاً راه‌اندازی و آشنایی اولیه.

Cursor و هر dev باید برای «چه چیزی درست است» اول به specs و design مراجعه کنند؛ برای «چطور اجرا کنم» به README و tasks.

---

## اسناد داخلی (پوشه docs/)

- **[docs/README.md](docs/README.md)** — فهرست ساختار docs و منبع حقیقت
- **[docs/AUTH-ARCHITECTURE.md](docs/AUTH-ARCHITECTURE.md)** — معماری Auth (روایی؛ قرارداد رسمی در [docs/specs/AUTH.md](docs/specs/AUTH.md))

**ساختار استاندارد (OpenSpec-style):**

| مسیر | نقش |
|------|------|
| [docs/proposals/](docs/proposals/) | تصمیم‌های محصول/تجاری؛ قالب: [TEMPLATE.md](docs/proposals/TEMPLATE.md) |
| [docs/specs/](docs/specs/) | قرارداد فنی، API، مدل داده، گاردریلت‌ها |
| [docs/design/](docs/design/) | UI blueprint، توکن‌ها، الگوهای تعامل |
| [docs/tasks/](docs/tasks/) | بک‌لاگ، DoD، acceptance criteria |
| [docs/adr/](docs/adr/) | تصمیم‌های معماری |

**۶ سند ستون‌فقرات (قفل‌شده):**  
[docs/specs/BILLING-SEATS.md](docs/specs/BILLING-SEATS.md) · [docs/specs/TENANCY-ISOLATION.md](docs/specs/TENANCY-ISOLATION.md) · [docs/specs/AUTH.md](docs/specs/AUTH.md) · [docs/design/UI-STANDARDS.md](docs/design/UI-STANDARDS.md) · [docs/specs/API-CONTRACT.md](docs/specs/API-CONTRACT.md) · [docs/tasks/SPRINT-0.md](docs/tasks/SPRINT-0.md)

**قانون پروژه (Guardrails + PR + CI):** [docs/specs/ENGINEERING-STANDARDS.md](docs/specs/ENGINEERING-STANDARDS.md) — تعریف Done، ۹ استاندارد غیرقابل‌نقض، چک‌لیست PR و گیت‌های CI. قالب PR: [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md). Pipeline: [.github/workflows/ci.yml](.github/workflows/ci.yml).

**راهنمای Cursor (workflow OpenSpec):** [docs/CURSOR-WORKFLOW.md](docs/CURSOR-WORKFLOW.md) — چرخه proposal→spec→design→tasks→implementation و دستور آماده برای شروع تغییرات. در روت پروژه فایل [.cursorrules](.cursorrules) برای اولویت منبع حقیقت و قواعد ضد نشت تنظیم شده است.

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
