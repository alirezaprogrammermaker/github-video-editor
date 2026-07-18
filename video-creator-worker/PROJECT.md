# راهنمای پروژه Video Creator Worker

## خلاصه پروژه
سیستم مدیریت محتوای شبکه اجتماعی با قابلیت ساخت خودکار ویدیو از ریلز اینستاگرام، تحلیل هوش مصنوعی، و انتشار خودکار.

## فناوری‌ها
- **Runtime**: Cloudflare Workers
- **Backend**: Hono (TypeScript)
- **Frontend**: React + Ant Design
- **Database**: Cloudflare D1
- **AI**: Cloudflare Workers AI (Whisper + Vision)
- **Workflow**: GitHub Actions (FFmpeg + Python)
- **Social**: Zernio API (Instagram)

## ساختار پروژه

```
video-creator-worker/
├── worker/                         # Backend
│   ├── index.ts                    # نقطه ورود + webhook callbacks (AI + workflow)
│   ├── cron.ts                     # Cron jobs (هر دقیقه)
│   ├── middleware.ts                # احراز هویت
│   ├── timezone.ts                 # توابع زمان تهران
│   ├── types.ts                    # انواع Bindings (DB + AI)
│   ├── hash.ts                     # هش رمز عبور
│   ├── constants/
│   │   └── video-status.ts         # وضعیت‌های ویدیو
│   ├── routes/
│   │   ├── auth.ts                 # ورود/خروج/ثبت‌نام
│   │   ├── dashboard.ts            # API داشبورد (تنظیمات، اکانت‌ها، ادمین‌ها)
│   │   ├── webhook.ts              # وب‌هوک زرنیو (پیام، ریلز)
│   │   ├── videos.ts               # API ویدیوها + workflow + publish + analyze
│   │   ├── telegram.ts             # ربات تلگرام
│   │   └── ai.ts                   # چت هوش مصنوعی
│   └── db/
│       ├── Model.ts                # مدل ORM پایه (sorted, updateWhere, deleteWhere)
│       ├── User.ts                 # کاربران پنل
│       ├── Session.ts              # نشست‌ها
│       ├── Setting.ts              # تنظیمات کلید-مقدار
│       ├── ZernioAccount.ts        # اکانت‌های API زرنیو
│       ├── ZernioSocialAccount.ts  # حساب‌های شبکه اجتماعی (language, caption_template)
│       ├── PageAdmin.ts            # ادمین‌های پیج
│       ├── BotChannel.ts           # کانال‌های ربات
│       ├── BotHelp.ts              # راهنمای ربات
│       ├── InstagramDmSession.ts   # نشست‌های دایرکت
│       ├── InstagramVideo.ts       # ویدیوها (ai_analysis, ai_title, ai_caption, ai_hashtags)
│       ├── VideoTemplate.ts        # قالب‌های ویدیو
│       ├── Schedule.ts             # زمانبندی انتشار
│       ├── AiSetting.ts            # تنظیمات AI + لاگ مصرف
│       ├── AiDatabaseAccess.ts     # دسترسی AI به دیتابیس
│       └── TelegramUser.ts         # کاربران تلگرام
├── src/                            # Frontend
│   ├── pages/
│   │   ├── Login.tsx               # صفحه ورود
│   │   ├── Signup.tsx              # صفحه ثبت‌نام
│   │   ├── DashboardHome.tsx       # داشبورد اصلی
│   │   ├── Videos.tsx              # لیست ویدیوها (مرتب‌سازی جدیدترین بالا)
│   │   ├── VideoEdit.tsx           # ویرایش ویدیو + AI تولید کپشن
│   │   ├── TelegramUsers.tsx       # مدیریت کاربران تلگرام
│   │   ├── TelegramUserSessions.tsx # نشست‌های تلگرام
│   │   ├── BotChannels.tsx         # مدیریت کانال‌ها
│   │   ├── BotHelps.tsx            # راهنمای ربات
│   │   ├── ZernioAccounts.tsx      # مدیریت اکانت‌های زرنیو
│   │   ├── ZernioSocialAccounts.tsx # حساب‌های شبکه اجتماعی (language, caption_template)
│   │   ├── AISettings.tsx          # تنظیمات هوش مصنوعی
│   │   └── Settings.tsx            # تنظیمات کلی + GitHub
│   ├── components/
│   │   ├── Layout.tsx              # طرح‌بندی سایدبار
│   │   ├── ProtectedRoute.tsx      # محافظ مسیر
│   │   ├── PageHeader.tsx          # هدر صفحات
│   │   └── ScheduleManager.tsx     # مدیریت زمانبندی
│   └── App.tsx                     # مسیریابی
├── migrations/                     # مایگریشن‌های D1 (28 مایگریشن)
├── .github/workflows/
│   ├── video-edit.yml              # ساخت ویدیو (FFmpeg + Python)
│   ├── analyze-video.yml           # تحلیل ویدیو (فریم + صدا)
│   └── release-delete.yml          # حذف release
└── wrangler.jsonc                  # پیکربندی Cloudflare (AI + D1 + Cron)
```

## وضعیت‌های ویدیو (به ترتیب)

```
pending → ready_for_create_video → building → wait_for_publish → published
                                                          ↓
                                                       failed
```

| وضعیت | مقدار | توضیح |
|-------|-------|-------|
| در انتظار | `pending` | ویدیو تازه ذخیره شده |
| آماده ساخت | `ready_for_create_video` | آماده ارسال به workflow |
| در حال ساخت | `building` | GitHub Actions در حال اجرا |
| آماده انتشار | `wait_for_publish` | ویدیو ساخته شد |
| منتشر شده | `published` | منتشر شد |
| ناموفق | `failed` | خطا در ساخت |

## جداول دیتابیس

| جدول | توضیح | فیلدهای کلیدی |
|------|-------|---------------|
| `users` | کاربران پنل | email, password |
| `sessions` | نشست‌های ورود | user_id, expires_at |
| `settings` | تنظیمات کلید-مقدار | key, value |
| `zernio_accounts` | اکانت‌های API زرنیو | api_key |
| `zernio_social_accounts` | حساب‌های شبکه اجتماعی | username, language, caption_template |
| `zernio_page_admins` | ادمین‌های هر پیج | user_id, role |
| `instagram_dm_sessions` | نشست‌های دایرکت | step, data |
| `instagram_videos` | ویدیوها | status, output_url, ai_* fields |
| `video_templates` | قالب‌های ویدیو | name, fields (JSON) |
| `social_account_schedules` | زمانبندی انتشار | time_slots, active_days |
| `ai_settings` | تنظیمات AI | setting_key, setting_value |
| `ai_usage_log` | لاگ مصرف AI | tokens_used, request_count |
| `telegram_users` | کاربران تلگرام | chat_id, role |
| `bot_channels` | کانال‌های ربات | channel_id, is_mandatory |

## فیلدهای AI در ویدیو

| فیلد | توضیح |
|------|-------|
| `ai_analysis` | تحلیل خام (متن + توصیف فریم‌ها) |
| `ai_title` | عنوان تولید شده توسط AI |
| `ai_caption` | کپشن تولید شده توسط AI |
| `ai_hashtags` | هشتگ‌های تولید شده توسط AI |

## فیلدهای شبکه اجتماعی

| فیلد | توضیح |
|------|-------|
| `language` | زبان محتوا (fa, en, ar, tr, ...) |
| `caption_template` | قالب کپشن با `{caption}` |

## وب‌هوک‌ها (PUBLIC - بدون احراز هویت)

| آدرس | توضیح |
|------|-------|
| `POST /api/callback/workflow` | دریافت نتیجه ساخت ویدیو |
| `POST /api/callback/analyze` | دریافت نتیجه تحلیل AI |
| `POST /api/webhook/zernio` | وب‌هوک زرنیو |

## تحلیل هوش مصنوعی (AI Video Analysis)

### جریان کار
```
کلیک "AI تولید کپشن" در صفحه ویرایش
  → Worker workflow رو trigger می‌کنه (analyze-video.yml)
  → Workflow ویدیو رو دانلود + ۵ فریم و صدا استخراج می‌کنه
  → Worker: صدا → Whisper → متن گفتار
  → Worker: فریم‌ها → Vision Model → توصیف صحنه‌ها
  → Worker: ترکیب نتایج → کپشن + عنوان + هشتگ
  → Worker: auto-fill کپشن، عنوان (متن ثابت)، واترمارک (آیدی پیج)
```

### مدل‌های مورد استفاده
| مدل | هزینه | کاربرد |
|------|-------|--------|
| `@cf/openai/whisper` | $0.00045/دقیقه | تبدیل صدا به متن |
| `@cf/meta/llama-4-scout-17b-16e-instruct` | رایگان | تحلیل فریم + تولید متن |

### زبان‌های پشتیبانی شده
فارسی (fa)، English (en)، العربية (ar)، Türkçe (tr)، Español (es)، Français (fr)، Deutsch (de)، Русский (ru)، हिन्दी (hi)، اردو (ur)

## Workflow GitHub Actions

### video-edit.yml (ساخت ویدیو)
**ورودی‌ها:** video_url, template, static_text, marquee_text, watermark_text, webhook_url, shortcode

### analyze-video.yml (تحلیل ویدیو)
**ورودی‌ها:** video_url, webhook_url, shortcode
**خروجی:** فریم‌ها (base64) + صدا (base64) → webhook worker

### release-delete.yml (حذف release)
**ورودی:** tag_name

## Cron Jobs (هر دقیقه)

1. `processReadyVideos` - ارسال ویدیوهای `ready_for_create_video` به workflow
2. `checkBuildingVideos` - بررسی وضعیت workflow در حال اجرا
3. `checkScheduleForPublish` - انتشار خودکار طبق زمانبندی
4. `checkZernioPublishStatus` - بررسی وضعیت انتشار

## API‌های اصلی

| متد | آدرس | توضیح |
|-----|------|-------|
| POST | `/api/auth/login` | ورود |
| GET | `/api/videos` | لیست ویدیوها (جدیدترین بالا) |
| GET | `/api/videos/:shortcode` | دریافت ویدیو |
| PUT | `/api/videos/:shortcode` | ویرایش + ساخت ویدیو |
| DELETE | `/api/videos/:shortcode` | حذف ویدیو + release |
| POST | `/api/videos/:shortcode/publish` | انتشار فوری |
| POST | `/api/videos/:shortcode/analyze` | شروع تحلیل AI |
| POST | `/api/videos/:shortcode/delete-release` | حذف release |
| POST | `/api/videos/check-workflow/:shortcode` | بررسی وضعیت workflow |
| POST | `/api/videos/check-all-building` | بررسی همه ویدیوهای در حال ساخت |
| PUT | `/api/dashboard/zernio-social-accounts/:id` | ویرایش حساب (language, caption_template) |

## نکات مهم

1. **زمان:** همه زمان‌ها بر اساس ساعت تهران (Asia/Tehran)
2. **Cron:** بر اساس UTC اجرا میشه ولی زمان داخل کد تهران هست
3. **توکن GitHub:** در دیتابیس settings با کلید `github_token` ذخیره میشه
4. **وب‌هوک:** باید پاسخ سریع بده، پردازش در background انجام میشه
5. **AI:** Whisper هزینه دارد ($0.00045/دقیقه)، Vision رایگان
6. **template_id:** در دیتابیس `default` ذخیره می‌شه (نه `tpl_default`)
7. **انتشار:** از طریق Zernio API با caption_template رندر می‌شه

## تست

**تست تحلیل AI:**
```bash
curl -X POST https://video-creator-worker.social-panel.workers.dev/api/videos/SHORTCODE/analyze
```

**تست انتشار فوری:**
```bash
curl -X POST https://video-creator-worker.social-panel.workers.dev/api/videos/SHORTCODE/publish
```

**تست وب‌هوک زرنیو:**
```bash
curl -X POST https://video-creator-worker.social-panel.workers.dev/api/webhook/zernio \
  -H "Content-Type: application/json" \
  -H "x-zernio-event: message.received" \
  -d '{"event":"message.received","message":{"attachments":[{"type":"video","originalType":"ig_reel","url":"https://www.instagram.com/reel/SHORTCODE/"}]}}'
```
