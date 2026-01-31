# Engineering Standards & Guardrails — Sakhtar CRM (v1)

**وضعیت:** قفل‌شده (قانون پروژه)  
**ارتباط:** [PR Checklist](../../.github/PULL_REQUEST_TEMPLATE.md) · [CI/CD](../../.github/workflows/ci.yml)

---

## 0) تعریف "Done"

هیچ فیچری **Done** نیست مگر:

- معماری/کد سالم
- UI مطابق Design System
- responsive پاس شده
- tenant isolation + auth پاس شده
- تست‌ها/لینت/بیلد پاس شده
- CI/CD سبز و deploy بدون drift

---

## 1) سلامت معماری و کد (Architecture Health)

### Guardrails

- **Layering ثابت (Backend):**
  - `controller → service → repo(prisma) → db`
  - هیچ Prisma call مستقیم داخل controller.
- **Domain boundaries:**
  - CRM, Billing, Auth, Tenancy modules جدا.
- **No hidden coupling:**
  - هر وابستگی cross-module باید interface داشته باشد.
- **Error contract واحد:**
  - همه خطاها payload استاندارد داشته باشند (`statusCode`, `code`, `message`).

### PR Checklist (Code)

- [ ] تغییرات شامل refactor بدون تست ممنوع
- [ ] هر endpoint جدید: validation + auth + tenancy guard
- [ ] لاگ مهم با `tenantId` و `requestId`

---

## 2) تبعیت از UI System واحد (Design System Compliance)

### Guardrails

- استفاده از کامپوننت‌های تعریف‌شده در Design System (**frontend/src/components/** و قرارداد [UI-STANDARDS.md](../design/UI-STANDARDS.md)) **اجباری**.
- ساخت کامپوننت جدید فقط با:
  - **Spec** در `docs/design/` (مثلاً COMPONENTS.md در فاز بعد)
  - و قرارگیری در ساختار مشخص frontend.
- ممنوع:
  - styleهای پراکنده
  - استفاده مستقیم از کتابخانه UI جدید بدون تصمیم معماری (ADR)

### Lint rule پیشنهادی

- ممنوعیت استفاده از `ml/mr/pl/pr` (فقط `ms/me/ps/pe`)
- ممنوعیت رنگ hardcode (hex) خارج از tokens

---

## 3) Responsive "واقعی" (Dynamic Responsive)

### استاندارد Breakpointها

- Mobile: `<640`
- Tablet: `640–1024`
- Desktop: `>1024`

### قواعد UI

- **Sidebar:**
  - Desktop: collapsible 280/80
  - Mobile: off-canvas (Sheet)
- **Tables:**
  - Mobile: columns minimal + horizontal scroll (controlled)
  - Drawer برای detail view به جای صفحه جدید

### QA Responsive

- [ ] 360×800
- [ ] 768×1024
- [ ] 1366×768
- [ ] 1920×1080

---

## 4) Database Safety & Privacy (بسیار حساس)

### Guardrails حیاتی

- **Backups:**
  - daily full backup + نگهداری ۱۴ روز
  - تست restore ماهانه (حداقل)
- **Migrations:**
  - prisma migrations فقط از طریق CI و با review
  - destructive migrations ممنوع بدون plan/rollback
- **Multi-tenant isolation:**
  - همه جداول tenantId
  - همه queryها tenant-scoped
  - create: tenantId فقط server-injected
- **Access to DB:**
  - پروداکشن: دسترسی حداقلی (least privilege)
  - secret management (env) + rotation

### Roadmap safety (پیشنهادی)

- فاز بعد: Postgres **RLS** برای جلوگیری از نشت حتی در خطای dev.

---

## 5) Iterations / Realtime Consistency / Notifications

### تعریف

- "یکپارچگی دیتا" یعنی:
  - state UI با API sync باشد
  - optimistic update فقط با rollback
  - هر action مهم audit log داشته باشد

### Guardrails

- Event model استاندارد:
  - `entity.created | updated | deleted`
- Notification engine (MVP):
  - in-app toast + badge
  - سپس websocket/SSE فاز بعد

### QA

- [ ] تغییر stage deal فوراً در kanban و list یکی شود
- [ ] بعد از failed write → rollback و پیام درست

---

## 6) Performance پنل در Production

### اهداف (SLO)

- **TTI Dashboard:** < 2s روی شبکه متوسط
- **List fetch:** < 600ms (cache + pagination)
- **JS bundle:** lazy route-based

### Guardrails

- server-side pagination/sort/filter
- debounce search = 300ms
- skeleton به جای spinner
- caching tenant-aware (key شامل tenantId)

---

## 7) Authentication / Authorization و جلوگیری از "direct URL access"

### Guardrails

- **Route guard در frontend:**
  - اگر role/permission ندارد → redirect به 403 page
- **Server guard در backend:**
  - JWT valid
  - `token.tid === req.tenant.id`
  - RBAC برای route
- **Never trust frontend:** همه enforcement در backend انجام شود.

### رفتار درست

- user اگر لینک صفحه‌ای را ندارد:
  - backend 403/404 بدهد
  - frontend صفحه 403 استاندارد نشان دهد

---

## 8) تست‌های فنی (Lint & Typecheck & Test & Build)

### Gateها (اجباری)

- `lint` (eslint)
- `typecheck` (tsc)
- `test` (unit حداقل برای billing/tenancy/auth)
- `build` (frontend + backend)

### Minimum test coverage (MVP)

- Tenancy isolation tests
- Seat enforcement tests
- Expired read-only tests
- Auth refresh path-scope tests

---

## 9) CI/CD و DevOps (No drift بین Dev و Prod)

### اصول

- **One Dockerfile** برای prod/dev (یا multi-stage ولی یک source)
- config تنها فرق:
  - logging level
  - cache TTL
  - worker concurrency
- DB migration فقط در deploy pipeline (نه دستی)
- **Healthchecks:**
  - `/health`
  - DB ping
  - (Redis ping در فاز بعد)

### Pipeline پیشنهادی

1. **PR:**
   - lint → typecheck → test → build
2. **Merge to main:**
   - build images
   - run migrations
   - deploy
   - smoke tests
   - rollback plan آماده

---

## PR Checklist (کوتاه و اجرایی)

- [ ] tenantId در همه queryها enforce شده
- [ ] auth guard + role guard پیاده شده
- [ ] read-only mode رعایت شده (expired)
- [ ] UI از DS استفاده کرده، رنگ/spacing hardcode ندارد
- [ ] responsive روی ۴ سایز تست شده
- [ ] lint/typecheck/test/build سبز
- [ ] migration safe + rollback note

---

## دستور به Cursor و تیم

- هر PR باید این checklist را پاس کند.
- هر تغییر خارج از DS باید "spec + component add" داشته باشد.
- هر endpoint جدید باید "tenant guard + auth + tests" داشته باشد.
