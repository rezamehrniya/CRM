# داکیومنت OpenSpec

این پوشه ایندکس داکیومنت‌های مرتبط با OpenSpec در پروژه Sakhtar CRM است.

## داخل همین پروژه

- **[راهنمای OpenSpec (فارسی)](../OPENSPEC-GUIDE.md)** — مفاهیم، workflow در این پروژه، لینک به مرجع کامل.

## مرجع کامل (انگلیسی)

پوشه **OpenSpec-main** در روت پروژه (`../../OpenSpec-main/`) شامل داکیومنت رسمی OpenSpec است:

| فایل | موضوع |
|------|--------|
| [concepts.md](../../OpenSpec-main/docs/concepts.md) | مفاهیم، فلسفه، Spec، Change، Delta، Schema، Archive |
| [getting-started.md](../../OpenSpec-main/docs/getting-started.md) | شروع کار و ساختار |
| [workflows.md](../../OpenSpec-main/docs/workflows.md) | الگوهای workflow و بهترین روش‌ها |
| [commands.md](../../OpenSpec-main/docs/commands.md) | دستورات اسلش (/opsx:new، /opsx:ff، …) |
| [cli.md](../../OpenSpec-main/docs/cli.md) | CLI ترمینال (openspec init، list، validate، …) |
| [customization.md](../../OpenSpec-main/docs/customization.md) | schema و قالب‌های سفارشی |
| [opsx.md](../../OpenSpec-main/docs/opsx.md) | workflow OPSX |

برای تعریف تغییرات و specهای جدید از اصول **proposal → specs → design → tasks** استفاده کنید؛ در صورت نصب CLI از دستورات `/opsx:new`, `/opsx:ff`, `/opsx:apply` می‌توان استفاده کرد.
