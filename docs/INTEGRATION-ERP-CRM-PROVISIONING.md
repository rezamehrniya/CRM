# سند هماهنگی توسعه ERP ↔ CRM — پروویژنینگ Tenant

**نسخه:** 1.0  
**تاریخ:** 2026-02-02  
**وضعیت:** قفل‌شده (قابل ارسال به هر دو Cursor Dev — ERP و CRM)  
**هدف:** فروش CRM پایه در ERP + پروویژنینگ Tenant در CRM با API سرویس‌به‌سرویس

**نکته کلیدی:** توسعه توسط **دو Cursor Dev جدا** و استقرار روی **دو سرور مجزا**.

---

## 1) معماری نهایی

### 1.1 سرویس‌ها

| سرویس | دامنه | نقش |
|-------|--------|-----|
| **ERP Panel (Control Plane)** | `https://erp.sakhtar.net` | فروش/پرداخت دستی/دریافت رسید؛ تایید دستی ادمین؛ فراخوانی API پروویژنینگ CRM؛ نمایش دسترسی به مشتری |
| **CRM App (Execution Plane)** | `https://crm.sakhtar.net` | اپ چندمستاجری Path-based؛ tenant از slug مسیر؛ احراز هویت مستقل (phone+password) |

### 1.2 Multi-tenancy در CRM

- **Frontend:** `/t/:tenantSlug/app/...`
- **API:** `/api/t/:tenantSlug/...`
- **Custom domain/subdomain:** ❌ وجود ندارد

### 1.3 احراز هویت

- **CRM مستقل** از ERP
- **Username:** شماره موبایل
- **Password:** پسورد موقت تولید شده هنگام provision
- **SSO/OTP مشترک:** ❌ خارج از اسکوپ

---

## 2) جریان کار (User Journey)

### 2.1 مشتری

1. مشتری از ERP اقدام به خرید CRM پایه می‌کند
2. پرداخت انجام می‌دهد و در ERP ثبت می‌کند:
   - نام، نام خانوادگی
   - موبایل
   - ایمیل (برای اطلاع‌رسانی)
   - نام شرکت/تیم
   - آپلود رسید
3. وضعیت: `در انتظار تایید`

### 2.2 ادمین (شما) در ERP

1. رسید را بررسی می‌کند
2. روی درخواست، `Approve & Provision` می‌زند
3. ERP با CRM تماس می‌گیرد و tenant ساخته می‌شود
4. ERP لینک ورود + یوزرنیم + پسورد را به مشتری نشان می‌دهد

---

## 3) قرارداد بین ERP و CRM (API Contract)

### 3.1 CRM Service Admin API — Provision Tenant

**Endpoint (CRM):**

```
POST https://crm.sakhtar.net/api/admin/provision/tenant
```

**Auth:**

```
Authorization: Bearer <CRM_SERVICE_TOKEN>
```

**Request Body:**

```json
{
  "tenantSlug": "acme",
  "tenantName": "Acme Co",
  "seatLimit": 20,
  "owner": {
    "firstName": "Ali",
    "lastName": "Mohammadi",
    "phone": "0912xxxxxxx",
    "email": "a@b.com"
  },
  "source": { "erpPurchaseId": "uuid" }
}
```

**Response 200/201:**

```json
{
  "ok": true,
  "tenant": { "id": "cuid", "slug": "acme", "name": "Acme Co" },
  "access": {
    "appUrl": "https://crm.sakhtar.net/t/acme/app/login",
    "apiBaseUrl": "https://crm.sakhtar.net/api/t/acme",
    "username": "0912xxxxxxx",
    "password": "TempPass123!"
  }
}
```

**Error Codes:**

| کد HTTP | code | توضیح |
|---------|------|--------|
| 401 | `INVALID_SERVICE_TOKEN` | توکن سرویس نامعتبر |
| 409 | `TENANT_SLUG_TAKEN` | slug قبلاً استفاده شده |
| 400 | `VALIDATION_ERROR` | خطای اعتبارسنجی |
| 500 | `PROVISION_FAILED` | خطای داخلی پروویژن |

### 3.2 قوانین slug

- **Regex:** `^[a-z0-9-]{3,30}$`
- یکتا در CRM
- پیشنهاد تولید در ERP: از نام شرکت + random suffix کوتاه

---

## 4) تسک‌های Cursor Dev — CRM (Server: crm.sakhtar.net)

### 4.1 Backend — Must Have

1. **Endpoint:** `POST /api/admin/provision/tenant`
2. **Service Token Guard:**
   - env: `CRM_SERVICE_TOKEN`
   - بررسی `Authorization: Bearer <token>`
3. **Provision Transaction:**
   - Create Tenant (slug unique, status ACTIVE)
   - Upsert User by phone (global)
   - Create Membership role=OWNER in tenant
   - Generate temp password (10–12 chars)
   - Save passwordHash
   - Seed minimal pipeline/stages (در صورت وجود)
4. **Response** مطابق قرارداد (appUrl, apiBaseUrl, path-based)

**Acceptance Criteria (CRM)**

- با یک call معتبر:
  - tenant ساخته شود
  - owner بتواند login کند
  - مسیر `/t/:slug/app/login` کار کند
  - مسیر `/api/t/:slug/auth/me` کار کند

**Out of Scope (CRM)**

- SSO با ERP
- reset password flow
- subdomain/host-based
- admin UI

### 4.2 Env/Config (CRM)

| متغیر | الزام | توضیح |
|--------|--------|--------|
| `CRM_SERVICE_TOKEN` | اجباری | توکن طولانی تصادفی برای اعتبارسنجی درخواست‌های admin |
| `APP_BASE_URL` | اختیاری | مثلاً `https://crm.sakhtar.net` برای ساخت appUrl |

### 4.3 Logging (CRM)

- log ساختاریافته برای هر provision:
  - `tenantSlug`
  - `erpPurchaseId`
  - `result`: ok | error

---

## 5) تسک‌های Cursor Dev — ERP (Server: erp.sakhtar.net)

### 5.1 Backend — Must Have

1. **مدل `CrmPurchase` (یا مشابه)** با فیلدهای:
   - buyer: firstName, lastName, phone, email, companyName
   - receiptFileUrl
   - status: `PENDING_REVIEW` | `REJECTED` | `PROVISIONED`
   - provision result: tenantSlug, appUrl, apiBaseUrl, username, password

2. **Endpoint کاربر:**
   - `POST /api/crm/purchases` — ثبت درخواست + آپلود رسید
   - `GET /api/crm/purchases/me/latest` — نمایش وضعیت و دسترسی

3. **Endpoint ادمین:**
   - `GET /api/admin/crm/purchases` — لیست
   - `POST /api/admin/crm/purchases/:id/reject`
   - `POST /api/admin/crm/purchases/:id/provision` — call CRM

4. **CRM client در ERP:**
   - env: `CRM_BASE_URL=https://crm.sakhtar.net`
   - env: `CRM_SERVICE_TOKEN=<same token as CRM>`
   - call: `POST <CRM_BASE_URL>/api/admin/provision/tenant`

5. **Idempotency:** اگر purchase قبلاً `PROVISIONED` است، provision دوباره → **409**.

**Acceptance Criteria (ERP)**

- مشتری می‌تواند درخواست ثبت کند و وضعیت را ببیند
- ادمین می‌تواند approve/provision کند
- پس از provision، مشتری اطلاعات دسترسی را در ERP ببیند

### 5.2 Frontend (ERP) — Must Have

| مسیر | نقش | توضیح |
|------|------|--------|
| `/crm/purchase` | مشتری | فرم + آپلود رسید |
| `/crm/status` | مشتری | نمایش وضعیت |
| `/admin/crm/purchases` | ادمین | لیست درخواست‌ها |
| `/admin/crm/purchases/:id` | ادمین | جزئیات + approve/reject + فرم tenantSlug |

### 5.3 Copy/UI مهم (ERP)

- به جای «دامین اختصاصی» از **«لینک ورود»** استفاده شود:  
  `https://crm.sakhtar.net/t/<slug>/app/login`
- نمایش: **Username** = phone، **Password** = temp password

---

## 6) استقرار (دو سرور مجزا)

### 6.1 Networking

- ERP server باید بتواند به CRM درخواست HTTPS بزند:
  - Outbound: ERP → CRM روی پورت **443**
- Endpoint `/api/admin/provision/tenant` فقط با token قابل دسترسی

### 6.2 Secrets

- `CRM_SERVICE_TOKEN` باید روی **هر دو** سرور **یکسان** باشد:
  - CRM: برای validate
  - ERP: برای call
- توصیه: توکن را rotate‌پذیر نگه دارید (بعداً)

### 6.3 CORS

- چون ERP از سرور خودش CRM را call می‌کند (server-to-server)، CORS معمولاً مسئله نیست.
- اگر در آینده از browser call شد، باید allowlist شود (فعلاً لازم نیست).

---

## 7) تست یکپارچه (Integration Test)

### 7.1 تست CRM (مستقل)

```bash
curl -X POST https://crm.sakhtar.net/api/admin/provision/tenant \
  -H "Authorization: Bearer <CRM_SERVICE_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantSlug":"acme",
    "tenantName":"Acme Co",
    "seatLimit":20,
    "owner":{"firstName":"Ali","lastName":"Mohammadi","phone":"09120000000","email":"a@b.com"},
    "source":{"erpPurchaseId":"test-1"}
  }'
```

### 7.2 تست ERP → CRM

- در ERP admin UI، provision را انجام دهید و خروجی را verify کنید:
  - status = PROVISIONED
  - appUrl ساخته شده
  - username/password ذخیره شده

### 7.3 تست login مشتری

- مشتری وارد URL شود: `https://crm.sakhtar.net/t/acme/app/login`
- با phone + password وارد شود

---

## 8) موارد خارج از اسکوپ (Scope Creep)

- اتصال پرداخت بانکی آنلاین
- SSO/OTP مشترک بین ERP و CRM
- دامنه اختصاصی هر tenant
- reset password / forgot password
- seat limit enforcement

---

## 9) Definition of Done مشترک

- [ ] ERP درخواست خرید را ثبت و مدیریت کند
- [ ] CRM tenant را با API بسازد
- [ ] دسترسی (link + phone + password) در ERP نمایش داده شود
- [ ] login مستقل CRM کار کند
- [ ] هر دو سرویس روی سرورهای جدا stable باشند

---

## 10) سوالات اجرایی (قبل از Merge — پاسخ در PR)

این‌ها را Cursor Devها باید در PR جواب بدهند:

1. **CRM login endpoint دقیقاً چیست؟** (برای تست نهایی)
2. **pipeline seeding** در provisioning لازم است یا خیر؟
3. **policy پسورد موقت:** طول و کاراکترها؟
