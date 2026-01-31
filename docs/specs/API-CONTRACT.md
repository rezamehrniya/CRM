# Spec: API Contract

**وضعیت:** قفل‌شده (ستون‌فقرات API)  
**پایهٔ URL:** `/api/t/:tenantSlug`

---

## قواعد کلی

- **Tenant:** تمام endpointها تحت `/api/t/:tenantSlug/...`. tenantSlug اجباری است.
- **Auth:** همهٔ routeهای زیر (غیر از login/refresh) نیاز به `Authorization: Bearer <accessToken>` دارند.
- **خطا:** پاسخ خطا به صورت بدنۀ JSON با `statusCode`, `code`, `message`.

---

## قالب پاسخ خطا

```json
{
  "statusCode": 403,
  "code": "TENANT_MISMATCH",
  "message": "Token does not match tenant."
}
```

کدهای رایج: `UNAUTHORIZED`, `TENANT_MISMATCH`, `SUBSCRIPTION_EXPIRED`, `FORBIDDEN`.

---

## Pagination

- **Query:** `page`, `pageSize` (پیش‌فرض صفحه‌ی ۱، pageSize طبق spec هر endpoint؛ پیش‌فرض کلی ۲۵).
- **Response:** آرایهٔ `items` به همراه (در صورت نیاز) `total`, `page`, `pageSize`.

---

## Filter Schema

- فیلترها با query params؛ نام پارامتر ثابت (مثلاً `search`, `companyId`).
- قرارداد پروژه: نام پارامترها در docs هر ماژول ذکر شود.

---

## Auth

| متد | مسیر | بدنه | پاسخ |
|-----|------|------|------|
| POST | `/auth/login` | `{ "phoneOrEmail", "password" }` | `{ "accessToken", "user" }` + Set-Cookie (refresh) |
| POST | `/auth/refresh` | — (cookie) | `{ "accessToken" }` + Set-Cookie |
| POST | `/auth/logout` | — | 204 + Clear cookie |
| GET | `/auth/me` | — | `{ "user", "tenant" }` |

---

## Contacts

| متد | مسیر | توضیح |
|-----|------|--------|
| GET | `/contacts` | لیست با query: page, pageSize, search |
| GET | `/contacts/:id` | یک contact |
| POST | `/contacts` | ایجاد؛ body: fullName, phone?, email?, companyId?؛ tenantId از سرور |
| PATCH | `/contacts/:id` | به‌روزرسانی |
| DELETE | `/contacts/:id` | حذف (۴۰۴ اگر متعلق به tenant دیگر باشد) |

---

## Companies

| متد | مسیر | توضیح |
|-----|------|--------|
| GET | `/companies` | لیست با page, pageSize, search |
| GET | `/companies/:id` | یک company |
| POST | `/companies` | ایجاد؛ tenantId از سرور |
| PATCH | `/companies/:id` | به‌روزرسانی |
| DELETE | `/companies/:id` | حذف؛ ۴۰۴ در صورت عدم تعلق به tenant |

---

## Dashboard

| متد | مسیر | توضیح |
|-----|------|--------|
| GET | `/dashboard` | خلاصه KPI (مثلاً تعداد contact، company، deal) برای tenant |

---

## Billing

| متد | مسیر | توضیح |
|-----|------|--------|
| GET | `/billing/subscription` | وضعیت subscription فعلی |
| GET | `/billing/usage` | استفاده (seats و غیره) |
| GET | `/billing/invoices` | لیست فاکتورها |

---

## نمونه Payload ایجاد Contact

**Request:**  
`POST /api/t/demo/contacts`  
```json
{
  "fullName": "علی احمدی",
  "phone": "+989121234567",
  "email": "ali@example.com",
  "companyId": "optional-company-id"
}
```

**Response 201:**  
```json
{
  "id": "cuid-...",
  "tenantId": "...",
  "fullName": "علی احمدی",
  "phone": "+989121234567",
  "email": "ali@example.com",
  "companyId": "optional-company-id",
  "ownerUserId": null
}
```

**نکته:** ارسال `tenantId` در body **نادیده گرفته می‌شود**؛ همیشه از سرور تزریق می‌شود.
