# مستندات پروژه Sakhtar CRM

ساختار استاندارد بر اساس **OpenSpec**: proposal → specs → design → tasks.  
**منبع حقیقت:** اول specs، بعد design، بعد tasks؛ READMEها فقط راه‌اندازی.

---

## ساختار پوشه docs/

| پوشه | نقش | قالب |
|------|------|------|
| **proposals/** | تصمیم‌های محصول/تجاری (No Freemium، Seat Pack، …) | [TEMPLATE.md](proposals/TEMPLATE.md) |
| **specs/** | قرارداد فنی، API، مدل داده، گاردریلت‌های امنیتی | [_TEMPLATE.md](specs/_TEMPLATE.md) |
| **design/** | UI blueprint، توکن‌ها (Aurora/Glass)، الگوی تعامل | — |
| **tasks/** | بک‌لاگ اسپرینت، DoD، acceptance criteria | [_TEMPLATE-SPRINT.md](tasks/_TEMPLATE-SPRINT.md) |
| **adr/** | تصمیم‌های معماری (Tenant routing، cookie path، RLS roadmap) | — |

---

## ۶ سند ستون‌فقرات (قفل‌شده)

هر تغییر در محصول یا کد باید با این اسناد سازگار باشد.

| سند | توضیح |
|-----|--------|
| [specs/BILLING-SEATS.md](specs/BILLING-SEATS.md) | پلن سالانه، صندلی، انقضا → read-only، Seat Pack، کدهای خطا |
| [specs/TENANCY-ISOLATION.md](specs/TENANCY-ISOLATION.md) | سه گاردریل اجباری: Tenant in URL، Guard تطابق tid، همهٔ queryها tenant-scoped |
| [specs/AUTH.md](specs/AUTH.md) | JWT کوتاه‌عمر، refresh در cookie با Path محدود، session، rotation/revoke |
| [design/UI-STANDARDS.md](design/UI-STANDARDS.md) | Sidebar ۲۸۰/۸۰، DataTable، Jalali + tooltip میلادی، Aurora/glass tokens |
| [specs/API-CONTRACT.md](specs/API-CONTRACT.md) | endpointها، pagination، filter، قالب خطا، نمونه payload |
| [tasks/SPRINT-0.md](tasks/SPRINT-0.md) | تیکت‌های اسپرینت ۰، DoD، QA و Release checklist |
| [specs/ENGINEERING-STANDARDS.md](specs/ENGINEERING-STANDARDS.md) | **قانون پروژه:** تعریف Done، ۹ Guardrail، چک‌لیست PR، گیت‌های CI/CD |

---

## قانون ضد نشت (Policy — اجباری)

1. **Tenant in URL mandatory** — هیچ endpoint عملیاتی بدون `/t/:slug`.
2. **Tenant match in Auth Guard** — اگر `JWT.tid !== req.tenant.id` → **403 TENANT_MISMATCH**.
3. **All DB queries tenant-scoped** — read با `tenantId` در where؛ create با تزریق tenantId از سرور؛ update/delete با `findFirst(id + tenantId)` و در صورت عدم یافتن **404**.

---

## نقش‌ها و پنل‌ها (Admin / Sales)

| سند | توضیح |
|-----|--------|
| [proposals/ROLES-AND-PANELS.md](proposals/ROLES-AND-PANELS.md) | تصمیم محصول: دو نقش (ADMIN/USER)، دو پنل، Customer 360°، نگاشت به OWNER/MEMBER |
| [specs/RBAC-PANELS.md](specs/RBAC-PANELS.md) | Spec RBAC: ماتریس دسترسی، پنل‌های ناوبری، Guard و فیلتر داده در API و UI |
| [specs/PRD-PANELS-USER-STORIES.md](specs/PRD-PANELS-USER-STORIES.md) | User Stories و Acceptance Criteria برای هر پنل (Dashboard، Leads، Customers، 360°، Deals، Tasks، Payments، Settings) |
| [specs/PERMISSION-MATRIX.md](specs/PERMISSION-MATRIX.md) | ماتریس دسترسی (جدول نقش‌ها و بخش‌ها، routeهای Backend/Frontend با محدودیت OWNER) — قابل تحویل به تیم |
| [tasks/QA-RBAC.md](tasks/QA-RBAC.md) | چک‌لیست QA برای نقش‌ها و دسترسی (MEMBER / OWNER، تست دستی و API) |
| [tasks/SPRINT-SALES-PREP.md](tasks/SPRINT-SALES-PREP.md) | بکلاگ اجرایی ۱۴ روزه — آماده‌سازی فروش (فاز ۱ Demo، فاز ۲ فروش واقعی) |
| [PANELS-STATUS.md](PANELS-STATUS.md) | وضعیت پنل‌ها — فرانت (مسیرها، RBAC)، بک (endpointها، Guard)، دواپس (CI، env) |
| [demo/DEMO-SCENARIO.md](demo/DEMO-SCENARIO.md) | سناریوی کامل دمو (۴–۶ دقیقه)، گام‌به‌گام و ویژگی‌های قابل نمایش |
| [tasks/QA-DEMO-SCENARIO.md](tasks/QA-DEMO-SCENARIO.md) | چک‌لیست QA برای tenant دمو و سناریوی دمو |
| [sales/DEMO-SALES-INTRO.md](sales/DEMO-SALES-INTRO.md) | معرفی فروش و دمو (قابل استفاده برای PDF / Notion) |

---

## اسناد روایی / تکمیلی

| سند | توضیح |
|-----|--------|
| [AUTH-ARCHITECTURE.md](AUTH-ARCHITECTURE.md) | فلوی کامل Auth، Guardها، چک‌لیست QA ضد نشت |
| [INTEGRATION-ERP-CRM-PROVISIONING.md](INTEGRATION-ERP-CRM-PROVISIONING.md) | **هماهنگی ERP ↔ CRM:** قرارداد API پروویژنینگ، تسک‌های CRM و ERP، استقرار دو سرور؛ قابل ارسال به هر دو Cursor Dev |

---

## مرجع Spec و workflow: OpenSpec

- **[راهنمای OpenSpec — فارسی](OPENSPEC-GUIDE.md)** — مفاهیم، workflow در این پروژه، لینک به مرجع کامل.
- **ایندکس داکیومنت OpenSpec:** [openspec/README.md](openspec/README.md).

پروژه از **[OpenSpec-main](../OpenSpec-main/)** به‌عنوان مرجع کامل (انگلیسی) برای نگارش spec و تغییرات استفاده می‌کند.

| موضوع | مسیر در OpenSpec-main |
|--------|------------------------|
| مفاهیم و فلسفه | [docs/concepts.md](../OpenSpec-main/docs/concepts.md) |
| شروع کار و ساختار | [docs/getting-started.md](../OpenSpec-main/docs/getting-started.md) |
| Workflowها | [docs/workflows.md](../OpenSpec-main/docs/workflows.md) |
| دستورات و CLI | [docs/commands.md](../OpenSpec-main/docs/commands.md) ، [docs/cli.md](../OpenSpec-main/docs/cli.md) |

چرخه پیشنهادی برای هر تغییر: **proposal → specs → design → tasks → implementation → QA**.
