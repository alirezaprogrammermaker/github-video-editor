# راهنمای پروژه Video Creator Worker

## خلاصه پروژه
یک سیستم مدیریت محتوای شبکه اجتماعی است که از طریق دایرکت اینستاگرام مدیریت میشه و ویدیوها رو خودکار میسازه و منتشر میکنه.

## فناوری‌ها
- **Runtime**: Cloudflare Workers
- **Backend**: Hono (TypeScript)
- **Frontend**: React + Ant Design
- **Database**: Cloudflare D1
- **Workflow**: GitHub Actions
- **Social**: Zernio API (Instagram)

## ساختار پروژه

```
video-creator-worker/
├── worker/                    # Backend
│   ├── index.ts              # نقطه ورود + cron handler
│   ├── cron.ts               # Cron jobs (هر دقیقه)
│   ├── timezone.ts           # توابع زمان تهران
│   ├── types.ts              # انواع Bindings
│   ├── routes/
│   │   ├── auth.ts           # احراز هویت
│   │   ├── dashboard.ts      # API داشبورد
│   │   ├── webhook.ts        # وب‌هوک زرنیو
│   │   ├── videos.ts         # API ویدیوها + workflow
│   │   └── telegram.ts       # ربات تلگرام
│   └── db/
│       ├── Model.ts          # مدل ORM پایه
│       ├── User.ts           # کاربران
│       ├── Session.ts        # نشست‌ها
│       ├── Setting.ts        # تنظیمات کلید-مقدار
│       ├── ZernioAccount.ts  # اکانت‌های زرنیو
│       ├── ZernioSocialAccount.ts # حساب‌های شبکه اجتماعی
│       ├── PageAdmin.ts      # ادمین‌های پیج
│       ├── InstagramDmSession.ts # نشست‌های دایرکت
│       ├── InstagramVideo.ts # ویدیوها
│       ├── VideoTemplate.ts  # قالب‌های ویدیو
│       └── Schedule.ts       # زمانبندی انتشار
├── src/                       # Frontend
│   ├── pages/
│   │   ├── Login.tsx         # صفحه لاگین
│   │   ├── DashboardHome.tsx # داشبورد اصلی
│   │   ├── TelegramUsers.tsx # مدیریت کاربران تلگرام
│   │   ├── ZernioAccounts.tsx # مدیریت اکانت‌های زرنیو
│   │   ├── ZernioSocialAccounts.tsx # حساب‌های شبکه اجتماعی + زمانبندی
│   │   ├── Videos.tsx        # لیست ویدیوها
│   │   ├── VideoEdit.tsx     # ویرایش ویدیو + template
│   │   ├── AISettings.tsx    # تنظیمات هوش مصنوعی
│   │   └── Settings.tsx      # تنظیمات کلی + GitHub
│   ├── components/
│   │   ├── Layout.tsx        # طرح‌بندی سایدبار
│   │   ├── ProtectedRoute.tsx # محافظ مسیر
│   │   └── ScheduleManager.tsx # مدیریت زمانبندی
│   └── App.tsx               # مسیریابی
├── migrations/                # مایگریشن‌های D1
├── wrangler.jsonc             # پیکربندی Cloudflare
└── trigger.py                 # اسکریپت پایتون trigger workflow
```

## وضعیت‌های ویدیو (به ترتیب)

```
pending → ready → building → ready_for_publish → published
                          ↓
                        failed
```

| وضعیت | توضیح |
|-------|-------|
| `pending` | ویدیو تازه ذخیره شده |
| `ready` | آماده ارسال به workflow |
| `building` | GitHub Actions در حال اجرا |
| `ready_for_publish` | ویدیو ساخته شد، آماده انتشار |
| `published` | منتشر شد |
| `failed` | خطا در ساخت |

## جداول دیتابیس

| جدول | توضیح |
|------|-------|
| `users` | کاربران پنل |
| `sessions` | نشست‌های ورود |
| `settings` | تنظیمات کلید-مقدار |
| `zernio_accounts` | اکانت‌های API زرنیو |
| `zernio_social_accounts` | حساب‌های شبکه اجتماعی متصل |
| `zernio_page_admins` | ادمین‌های هر پیج |
| `instagram_dm_sessions` | نشست‌های دایرکت |
| `instagram_videos` | ویدیوها |
| `video_templates` | قالب‌های ویدیو |
| `social_account_schedules` | زمانبندی انتشار |

## وب‌هوک زرنیو

**آدرس:** `https://video-creator-worker.social-panel.workers.dev/api/webhook/zernio`

**رویدادهای پشتیبانی شده:**
- `message.received` - پیام دریافتی (شامل ریلز)
- `account.connected` / `account.updated` - اتصال/بروزرسانی حساب
- `account.disconnected` - قطع اتصال حساب

**منطق دایرکت:**
- **کاربر عادی:** پاسخ ساده
- **ریلز:** ذخیره + لینک ویرایش در داشبورد (دکمه URL)
- **ادمین:** منوی مدیریت با دستورات
- **کلید ادمین:** اضافه شدن به لیست ادمین‌ها

## Cron Jobs (هر دقیقه)

```
* * * * * (UTC) → tehranTime() تبدیل به ساعت تهران
```

**کارها:**
1. `processReadyVideos` - ارسال ویدیوهای "ready" به GitHub workflow
2. `checkBuildingVideos` - بررسی وضعیت workflow
3. `checkScheduleForPublish` - انتشار خودکار طبق زمانبندی
4. `checkZernioPublishStatus` - بررسی وضعیت انتشار

## زمانبندی انتشار

**در صفحه حساب‌های شبکه اجتماعی → ویرایش → زمانبندی:**
- **ساعت‌ها:** فرمت `HH:MM` (ساعت تهران)
- **روزهای هفته:** `1`=یکشنبه تا `7`=شنبه (فرمت Cloudflare)

## Workflow GitHub Actions

**آدرس repo:** `alirezaprogrammermaker/github-video-editor`
**فایل workflow:** `video-edit.yml`

**ورودی‌ها:**
- `video_url` - لینک ویدیو
- `static_text` - متن ثابت روی ویدیو
- `marquee_text` - متن متحرک
- `watermark_text` - واترمارک

**خروجی:** GitHub Release با لینک `output.mp4`

## تنظیمات GitHub (در صفحه تنظیمات)

| فیلد | کلید دیتابیس |
|------|--------------|
| Repo | `github_repo` |
| Token | `github_token` |
| Workflow | `github_workflow` |
| Branch | `github_branch` |

## API‌های اصلی

| متد | آدرس | توضیح |
|-----|------|-------|
| POST | `/api/auth/login` | ورود |
| POST | `/api/webhook/zernio` | وب‌هوک زرنیو |
| GET | `/api/videos` | لیست ویدیوها |
| PUT | `/api/videos/:shortcode` | ویرایش ویدیو |
| POST | `/api/videos/check-workflow/:shortcode` | بررسی وضعیت workflow |
| GET | `/api/dashboard/schedules/:id` | دریافت زمانبندی |
| PUT | `/api/dashboard/schedules/:id` | ذخیره زمانبندی |

## نکات مهم

1. **زمان:** همه زمان‌ها بر اساس ساعت تهران (Asia/Tehran) هستند
2. **Cron:** بر اساس UTC اجرا میشه ولی زمان داخل کد تهران هست
3. **روزهای هفته:** Cloudflare از `1`=یکشنبه تا `7`=شنبه استفاده میکنه
4. **توکن GitHub:** در دیتابیس settings با کلید `github_token` ذخیره میشه
5. **وب‌هوک:** باید پاسخ سریع بده، پردازش در `waitUntil` انجام میشه
6. **ریلز:** لینک ویدیو با پروکسی `ig-proxy.dknow2296.workers.dev` ارسال میشه

## تست

**تست وب‌هوک با ریلز:**
```bash
curl -X POST https://video-creator-worker.social-panel.workers.dev/api/webhook/zernio \
  -H "Content-Type: application/json" \
  -H "x-zernio-event: message.received" \
  -d '{"event":"message.received","message":{"attachments":[{"type":"video","originalType":"ig_reel","url":"https://www.instagram.com/reel/SHORTCODE/"}]}}'
```

**تست workflow status:**
```bash
curl -X POST https://video-creator-worker.social-panel.workers.dev/api/videos/check-workflow/SHORTCODE
```

## لاگ‌ها

**مشاهده لاگ‌ها در Cloudflare:**
1. Workers & Pages → ورکر → Logs
2. یا `wrangler tail`

**فرمت لاگ:**
```
[Cron] Running at 2026-07-18T10:30:00 (hour: 10, minute: 30, day: 2)
[Cron] Found 1 ready video(s) to build
[Cron] Triggered: DaWpRErgXJw
```
