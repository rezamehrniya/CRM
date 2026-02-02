# راهنمای OpenSpec در پروژه Sakhtar CRM

این سند توضیح می‌دهد OpenSpec چیست، چطور در این پروژه استفاده می‌شود، و به کجا برای جزئیات بیشتر مراجعه کنید.

**مرجع کامل (انگلیسی):** پوشه **[OpenSpec-main](../OpenSpec-main/)** در روت پروژه — شامل مفاهیم، workflowها، دستورات و CLI.

---

## OpenSpec چیست؟

OpenSpec یک چارچوب سبک برای **spec-driven development** است:

- **Specها** = منبع حقیقتِ «سیستم الان چطور کار می‌کند».
- **Changeها** = پیشنهاد تغییر؛ هر تغییر یک پوشه با proposal، specs (دلتا)، design، tasks تا قبل از پیاده‌سازی تکمیل می‌شود.

اصول (از مرجع OpenSpec):

```
fluid not rigid       — بدون فاز قفل‌شده؛ هر وقت لازم است artifact بساز یا به‌روز کن
iterative not waterfall — در حین پیاده‌سازی یاد می‌گیری؛ spec و design را به‌روز کن
easy not complex      — راه‌اندازی سبک، بدون تشریفات زیاد
brownfield-first      — برای کدبیس موجود هم کار می‌کند (تغییر به‌صورت دلتا)
```

---

## دو نوع استفاده در این پروژه

### ۱. workflow مبتنی بر docs/ (فعلی)

در این پروژه منبع حقیقت **docs/** است، نه پوشهٔ `openspec/` داخل پروژه:

| معادل OpenSpec | در Sakhtar CRM |
|-----------------|-----------------|
| proposal | `docs/proposals/` با قالب TEMPLATE |
| specs (قرارداد فنی) | `docs/specs/` — API-CONTRACT، AUTH، TENANCY، BILLING، … |
| design | `docs/design/` — UI-STANDARDS و اسناد طراحی |
| tasks | `docs/tasks/` — SPRINT-0، SPRINT-SALES-PREP، QA-* |

**چرخه اجباری (طبق CURSOR-WORKFLOW):**

```
proposal → specs → design → tasks → implementation → QA
```

یعنی: قبل از کد، proposal/ spec/ design/ tasks را ثبت یا به‌روز کن؛ بعد پیاده‌سازی؛ در پایان QA.

### ۲. دستورات OPSX و CLI (در صورت نصب OpenSpec)

اگر OpenSpec CLI را نصب و در پروژه `openspec init` کرده باشید، می‌توانید از دستورات اسلش در چت AI استفاده کنید:

| دستور | کار |
|--------|-----|
| `/opsx:new <نام-تغییر>` | شروع یک change؛ ساخت پوشه در `openspec/changes/<نام>/` |
| `/opsx:ff` | ساخت یک‌جا proposal، specs، design، tasks |
| `/opsx:continue` | ساخت گام‌به‌گام artifact بعدی |
| `/opsx:apply` | پیاده‌سازی تسک‌های tasks.md |
| `/opsx:verify` | بررسی تطابق پیاده‌سازی با spec/design |
| `/opsx:archive` | ادغام دلتا specها در spec اصلی و انتقال change به archive |

مرجع کامل دستورات: [OpenSpec-main/docs/commands.md](../OpenSpec-main/docs/commands.md) و [OpenSpec-main/docs/cli.md](../OpenSpec-main/docs/cli.md).

---

## مفاهیم کلیدی (خلاصه)

### Spec و Requirement و Scenario

- **Spec:** توصیف رفتار یک دامنه (مثلاً auth، billing).
- **Requirement:** یک رفتار مشخص که سیستم **باید** داشته باشد (با کلمات SHALL/MUST/SHOULD).
- **Scenario:** یک مثال قابل تست (معمولاً Given / When / Then).

### Change و Delta Spec

- **Change:** یک پوشه با proposal، design، tasks و **delta specs**.
- **Delta spec:** فقط «چه چیزی عوض می‌شود» — با بخش‌های ADDED / MODIFIED / REMOVED به‌جای کپی کل spec.

### Artifactها

- **proposal.md** — چرا و چه scope (Intent، Scope، Approach).
- **specs/** — دلتاهای requirement/scenario.
- **design.md** — رویکرد فنی، تصمیمات معماری، جریان داده.
- **tasks.md** — چک‌لیست پیاده‌سازی با تیک.

---

## لینک به داکیومنت کامل OpenSpec

همهٔ فایل‌های زیر داخل **OpenSpec-main/docs/** هستند:

| سند | محتوا |
|-----|--------|
| [concepts.md](../OpenSpec-main/docs/concepts.md) | مفاهیم و فلسفه؛ Spec، Change، Delta، Schema، Archive |
| [getting-started.md](../OpenSpec-main/docs/getting-started.md) | شروع کار؛ ساختار پوشه‌ها؛ اولین change |
| [workflows.md](../OpenSpec-main/docs/workflows.md) | الگوهای workflow؛ چه موقع ff و چه موقع continue؛ parallel changes |
| [commands.md](../OpenSpec-main/docs/commands.md) | مرجع دستورات اسلش (/opsx:new، /opsx:ff، /opsx:apply، …) |
| [cli.md](../OpenSpec-main/docs/cli.md) | مرجع CLI ترمینال (openspec init، list، validate، archive، …) |
| [customization.md](../OpenSpec-main/docs/customization.md) | schema و قالب‌های سفارشی |
| [opsx.md](../OpenSpec-main/docs/opsx.md) | workflow OPSX و پیکربندی پروژه |

---

## جمع‌بندی

- **برای تعریف تغییر در این پروژه:** طبق [CURSOR-WORKFLOW.md](CURSOR-WORKFLOW.md) از proposal → specs → design → tasks استفاده کن و سه گاردریل ضد نشت را رعایت کن.
- **برای درک عمیق Spec و Change و Delta:** [OpenSpec-main/docs/concepts.md](../OpenSpec-main/docs/concepts.md).
- **برای دستورات اسلش و CLI:** در صورت استفاده از OpenSpec، [commands.md](../OpenSpec-main/docs/commands.md) و [cli.md](../OpenSpec-main/docs/cli.md).
