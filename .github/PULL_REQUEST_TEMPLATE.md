## توضیح تغییرات

<!-- خلاصهٔ چیزی که عوض شده و چرا -->

## نوع تغییر

- [ ] باگ‌ fix
- [ ] فیچر جدید
- [ ] Breaking change
- [ ] مستندات / پیکربندی

## چک‌لیست PR (طبق [ENGINEERING-STANDARDS](docs/specs/ENGINEERING-STANDARDS.md))

### Tenant & Auth
- [ ] `tenantId` در همهٔ queryها enforce شده
- [ ] auth guard + role guard برای routeهای جدید پیاده شده
- [ ] read-only mode رعایت شده (در صورت انقضای subscription)

### UI & Design System
- [ ] UI از Design System استفاده کرده (رنگ/spacing از tokens، بدون hardcode)
- [ ] responsive روی حداقل ۴ سایز چک شده (۳۶۰×۸۰۰، ۷۶۸×۱۰۲۴، ۱۳۶۶×۷۶۸، ۱۹۲۰×۱۰۸۰)

### کیفیت و Pipeline
- [ ] lint / typecheck / test / build سبز (محلی یا CI)
- [ ] در صورت تغییر دیتابیس: migration امن است و rollback note دارم

### Spec و مستندات
- [ ] در صورت تغییر API/رفتار: spec یا docs به‌روز شده
- [ ] endpoint جدید (در صورت وجود): validation + auth + tenancy guard + تست

---

**مرجع:** [docs/specs/ENGINEERING-STANDARDS.md](docs/specs/ENGINEERING-STANDARDS.md)
