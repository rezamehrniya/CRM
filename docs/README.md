# مستندات پروژه Sakhtar CRM

فهرست اسناد داخلی و ارجاع به مرجع Spec/داکیومنت.

## اسناد پروژه

| سند | توضیح |
|-----|--------|
| [AUTH-ARCHITECTURE.md](AUTH-ARCHITECTURE.md) | معماری احراز هویت tenant-safe، JWT، cookie، Guardها و چک‌لیست QA ضد نشت |

## مرجع Spec و داکیومنت: OpenSpec

پروژه از **[OpenSpec-main](../OpenSpec-main/)** به‌عنوان مرجع برای نگارش spec، تغییرات و workflow استفاده می‌کند. تمام رفرنس‌های مربوط به «چگونه spec بنویسیم»، «ساختار proposal/design/tasks» و دستورات AI-assisted از این پوشه است.

| موضوع | مسیر در OpenSpec-main |
|--------|------------------------|
| مفاهیم و فلسفه (spec vs change، artifacts) | [docs/concepts.md](../OpenSpec-main/docs/concepts.md) |
| شروع کار و ساختار openspec/ | [docs/getting-started.md](../OpenSpec-main/docs/getting-started.md) |
| الگوهای workflow و دستورات | [docs/workflows.md](../OpenSpec-main/docs/workflows.md) |
| دستورات Slash و مهارت‌ها | [docs/commands.md](../OpenSpec-main/docs/commands.md) |
| CLI (مرجع ترمینال) | [docs/cli.md](../OpenSpec-main/docs/cli.md) |
| سفارشی‌سازی و schema | [docs/customization.md](../OpenSpec-main/docs/customization.md) |

برای تغییرات جدید می‌توان از چرخه proposal → specs → design → tasks (طبق [getting-started](../OpenSpec-main/docs/getting-started.md)) و در صورت نصب `@fission-ai/openspec` از دستورات `/opsx:new`, `/opsx:ff`, `/opsx:apply`, `/opsx:archive` استفاده کرد.
