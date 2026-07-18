# راهنمای پروژه GitHub Video Editor

## خلاصه پروژه
سیستم خودکار ساخت و انتشار ویدیو برای شبکه‌های اجتماعی. ویدیوهای Instagram Reel از طریق دایرکت دریافت می‌شن، با هوش مصنوعی تحلیل می‌شن، ویدیو ساخته می‌شه، و خودکار منتشر می‌شه.

## معماری کلی

```
Instagram DM → Zernio Webhook → Cloudflare Worker → GitHub Actions (FFmpeg)
                                    ↓                        ↓
                              Database (D1)          Release + Output
                                    ↓                        ↓
                              Cron Jobs ←──────── Webhook Callback
                                    ↓
                              Zernio API → Publish to Instagram
```

## کامپوننت‌ها

### 1. Cloudflare Worker (`video-creator-worker/`)
- **Backend**: Hono + TypeScript
- **Frontend**: React + Ant Design (SPA)
- **Database**: Cloudflare D1
- **AI**: Cloudflare Workers AI (Whisper + Vision)
- **Cron**: هر دقیقه

### 2. GitHub Actions Workflows
- `video-edit.yml` - ساخت ویدیو با FFmpeg + Python
- `analyze-video.yml` - تحلیل ویدیو (فریم + صدا)
- `release-delete.yml` - حذف release

### 3. GitHub Actions Workflow (Python)
- `main.py` - پردازش ویدیو با FFmpeg
- قالب‌ها: default, persian-shop, marquee-only, static-only

## جریان کار

### جریان اصلی (ساخت ویدیو)
```
1. ریلز اینستاگرام از طریق دایرکت دریافت می‌شه
2. در دیتابیس ذخیره می‌شه (status: pending)
3. کاربر در پنل ویرایش می‌کنه (کپشن، قالب، متن ثابت، واترمارک)
4. کاربر "ساخت ویدیو" رو می‌زنه (status: building)
5. GitHub Actions workflow اجرا می‌شه
6. خروجی به GitHub Release آپلود می‌شه
7. Worker webhook رو دریافت می‌کنه (status: wait_for_publish)
8. زمانبندی انتشار یا انتشار فوری
```

### جریان تحلیل AI
```
1. کاربر "AI تولید کپشن" رو می‌زنه
2. GitHub Actions ویدیو رو دانلود + فریم و صدا استخراج می‌کنه
3. Worker: صدا → Whisper → متن
4. Worker: فریم‌ها → Vision Model → توصیف
5. Worker: ترکیب → کپشن + عنوان + هشتگ
6. Worker: auto-fill فرم (کپشن، متن ثابت، واترمارک)
```

## وضعیت‌های ویدیو

```
pending → ready_for_create_video → building → wait_for_publish → published
                                                          ↓
                                                       failed
```

## فناوری‌ها

| کامپوننت | فناوری |
|----------|--------|
| Runtime | Cloudflare Workers |
| Backend | Hono (TypeScript) |
| Frontend | React + Ant Design |
| Database | Cloudflare D1 |
| AI | Cloudflare Workers AI |
| Video Processing | FFmpeg (GitHub Actions) |
| Social API | Zernio |
| Version Control | GitHub |

## ساختار فایل‌ها

```
github-video-editor/
├── .github/workflows/        # GitHub Actions
│   ├── video-edit.yml        # ساخت ویدیو
│   ├── analyze-video.yml     # تحلیل ویدیو
│   └── release-delete.yml    # حذف release
├── video-creator-worker/     # Cloudflare Worker
│   ├── worker/               # Backend (TypeScript)
│   ├── src/                  # Frontend (React)
│   ├── migrations/           # Database migrations (28)
│   └── wrangler.jsonc        # Cloudflare config
├── main.py                   # Python video processing
├── PROJECT.md                # این فایل
└── requirements.txt          # Python dependencies
```

## راهنمای سریع

### برای توسعه‌دهنده جدید
1. `video-creator-worker/PROJECT.md` - راهنمای کامل Worker
2. `video-creator-worker/wrangler.jsonc` - پیکربندی Cloudflare
3. `video-creator-worker/migrations/` - ساختار دیتابیس

### برای اضافه کردن قالب جدید
1. فایل Python در `main.py` اضافه کن
2. در `video-edit.yml` template جدید رو support کن
3. در دیتابیس `video_templates` رکورد جدید بساز

### برای اضافه کردن زبان جدید
1. در `worker/index.ts` به `LANGUAGE_NAMES` اضافه کن
2. در `ZernioSocialAccounts.tsx` آپشن اضافه کن

## نکات مهم

1. **امنیت:** توکن‌ها در دیتابیس ذخیره می‌شن نه در کد
2. **وب‌هوک‌ها:** PUBLIC هستند (بدون احراز هویت)
3. **Cron:** هر دقیقه اجرا می‌شه
4. **AI:** Whisper هزینه دارد، Vision رایگان
5. **GitHub Actions:** 2000 دقیقه رایگان ماهانه
