# اتصال پروژه CRM به ریپوی Git

از آن‌جا که پوشهٔ پروژه روی درایو **D** است، این دستورات را در **ترمینال خودتان** (PowerShell یا Git Bash) اجرا کنید.

## ۱) باز کردن پوشهٔ پروژه

```powershell
cd D:\CRM
```

## ۲) پاک‌سازی در صورت خطای قفل (در صورت نیاز)

اگر قبلاً `git init` زده‌اید و خطای **config.lock** یا **Permission denied** می‌گیرید:

```powershell
Remove-Item -Recurse -Force .git -ErrorAction SilentlyContinue
```

## ۳) مقداردهی ریپو و اولین کامیت

```powershell
git init
git add .
git commit -m "Initial commit: Sakhtar CRM backend + frontend + docs"
```

## ۴) اتصال به ریپوی ریموت

ریپو: [github.com/rezamehrniya/CRM](https://github.com/rezamehrniya/CRM)

```powershell
git remote add origin https://github.com/rezamehrniya/CRM.git
```

با SSH:

```powershell
git remote add origin git@github.com:rezamehrniya/CRM.git
```

## ۵) شاخهٔ اصلی و پوش به ریموت

```powershell
git branch -M main
git push -u origin main
```

---

بعد از این مراحل، پروژه به ریپو وصل است و با `git push` و `git pull` می‌توانید با تیم همگام شوید.
