# راهنمای پروژه GitHub Video Editor

## خلاصه پروژه

سیستم خودکار ساخت و انتشار ویدیو برای شبکه‌های اجتماعی. ریلز اینستاگرام از دایرکت دریافت می‌شود، با هوش مصنوعی تحلیل می‌شود، با **Remotion** در GitHub Actions رندر می‌شود، خروجی به **Cloudflare R2** آپلود می‌شود، و از طریق Worker زمان‌بندی/منتشر می‌شود.

> نسخه قدیمی مبتنی بر `main.py` + FFmpeg دیگر نقطه ورود اصلی نیست. رندر فعلی داخل `remotion-video-creator/` انجام می‌شود.

## معماری کلی

```
Instagram DM → Zernio Webhook → Cloudflare Worker → GitHub Actions (Remotion)
                                   ↓                        ↓
                             Database (D1)           Cloudflare R2 (renders/…)
                                   ↓                        ↓
                             Cron Jobs ←──────── Webhook Callback (امضا‌شده + URL)
                                   ↓
                             Zernio API → Publish to Instagram
```

مسیر موفقیت: رندر Remotion → آپلود به R2 با کلید `renders/<job>/<random>.mp4` → callback HMAC با همان URL → Worker فقط مسیرهای زیر `R2_PUBLIC_BASE_URL` را می‌پذیرد → انتشار از طریق Zernio.

## کامپوننت‌ها

### 1. Cloudflare Worker (`video-creator-worker/`)

- **Backend:** Hono + TypeScript (`video-creator-worker/worker/`)
- **Frontend:** React + Ant Design (`video-creator-worker/src/`)
- **Database:** Cloudflare D1
- **AI:** Cloudflare Workers AI (Whisper، Vision، LLM)
- **Cron:** زمان‌بندی انتشار و کارهای پس‌زمینه
- این پوشه در `.gitignore` ریشه است (معمولاً به‌صورت جداگانه دیپلوی می‌شود)

### 2. Remotion (`remotion-video-creator/`)

ترکیب‌های ثبت‌شده در `src/Root.tsx`:

| Composition | ابعاد | کاربرد |
|-------------|-------|--------|
| `InstagramReel` | 720×1280 | ریل عمودی با واترمارک، عنوان، متن متحرک، زیرنویس |
| `YouTubeLongVideo` | 1920×1080 | ویدیو افقی بلند + زیرنویس |
| `DynamicTemplate` | 720×1280 | قالب لایه‌ای از JSON (`template_config`) |

ورودی‌های مهم props: `videoSrc`, `subtitleContent` (WebVTT), `title` / `static_text`, `watermark`, `scrollingText` / `marquee_text`, `templateConfig`, `durationInSeconds`.

### 3. GitHub Actions (`.github/workflows/`)

| Workflow | فایل | نقش |
|----------|------|-----|
| Video Edit | `video-edit.yml` | دانلود ویدیو → رندر Remotion (`concurrency=4`) → آپلود R2 → webhook |
| Analyze Video | `analyze-video.yml` | استخراج فریم/صدا با FFmpeg برای تحلیل AI در Worker |
| Release Delete | `release-delete.yml` | حذف دستی releaseهای قدیمی با الگوی `video-<number>` (legacy) |
| Cleanup Releases | `cleanup.yml` | پاکسازی زمان‌بندی‌شده releaseهای قدیمی (legacy) |
| Check Resources | `check-resources.yml` | گزارش CPU/RAM رانر |

رانر: `ubuntu-latest` (معمولاً حدود **۴ vCPU / ۱۵ GiB** روی GitHub-hosted). رپو **عمومی** است → دقایق Actions عملاً نامحدود (سهمیه رایگان پابلیک)، و **لاگ/ورودی‌های workflow همچنان عمومی**اند. خروجی‌های **جدید** mp4 دیگر روی GitHub Releases نیستند (روی R2اند)؛ releaseهای قدیمی ممکن است تا پاکسازی باقی بمانند. راز و داده حساس را در لاگ نگذارید.

`output_format=zip` فقط مسیر دیباگ است (Artifact با ماندگاری کوتاه)؛ مسیر تحویل موفق از R2 می‌گذرد.

### 4. ابزار زیرنویس (`tools/subtitle-generator/`)

پایپ‌لاین محلی Cloudflare Workers AI برای ساخت WebVTT:

- `subtitle_pipeline.py` — صوت فارسی → زیرنویس انگلیسی (+ نسخه اصلاح‌شده فارسی)
- `translate_en_to_fa.py` — جهت برعکس
- `cf_auth.py` — خواندن اعتبارنامه فقط از env (`CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN` یا `CLOUDFLARE_ACCOUNTS`)
- خروجی با `remotion-video-creator/src/utils/parseVtt.ts` سازگار است و به‌عنوان ورودی `subtitle_content` به `video-edit.yml` داده می‌شود

جزئیات: `tools/subtitle-generator/README.md`

## جریان کار

### ساخت ویدیو

```
1. ریلز از دایرکت می‌آید → ذخیره در D1 (pending)
2. ویرایش در پنل (کپشن، قالب، متن، واترمارک، زیرنویس)
3. «ساخت ویدیو» → status: building → dispatch به video-edit.yml
4. Remotion رندر می‌کند → آپلود به R2 (renders/<job>/<random>.mp4)
5. Worker با webhook امضاشده + output_url مطلع می‌شود → allowlist روی R2_PUBLIC_BASE_URL → wait_for_publish
6. انتشار زمان‌بندی‌شده یا فوری از طریق Zernio
```

### تحلیل AI

```
1. کاربر «AI تولید کپشن» را می‌زند
2. analyze-video.yml ویدیو را می‌گیرد و فریم/صدا استخراج می‌کند
3. Worker: صدا → Whisper، فریم → Vision، ترکیب → کپشن/هشتگ/پر کردن فرم
```

### اتصال تلگرام ↔ داشبورد و ارسال پست

مسیر جایگزین ورود ریلز (علاوه بر دایرکت Zernio): کاربر داشبورد را به چت ربات وصل می‌کند و لینک اینستاگرام می‌فرستد؛ همان جدول `posts` با وضعیت `pending`.

```
داشبورد («اتصال به تلگرام») → deep link (توکن کوتاه‌عمر ≈۱۵ دقیقه)
  → در تلگرام: /start <token> → bind chat به dashboard user
  → انتخاب حساب اجتماعی → ارسال لینک reel/p/tv → ingest → posts (pending)
```

| مرحله | جزئیات |
|-------|--------|
| اتصال | کارت خانه داشبورد → `POST /api/dashboard/telegram-link/create` → `https://t.me/<bot>?start=<token>` |
| ارسال | `/accounts` یا کیبورد «حساب‌های من» → لینک(ها)؛ هر پیام می‌تواند چند URL داشته باشد |
| دستورات | `/accounts` انتخاب حساب · `/cancel` لغو مرحله · `/help` راهنما · `/unlink` قطع اتصال |
| اپس دستی | migration `0039_telegram_dashboard_link.sql` · از Settings دوباره set webhook (برای `secret_token`) · دیپلوی Worker |

**محدودیت‌ها:** لیست حساب‌های اجتماعی برای ربات فعلاً سست/تک‌مستأجری است (همه اکانت‌های همگام‌شده اگر کاربر کلید زرنیو داشته باشد یا ادمین باشد). فقط لینک‌های `instagram.com` از نوع `reel` / `reels` / `p` / `tv`.

## وضعیت‌های ویدیو

```
pending → ready_for_create_video → building → wait_for_publish → published
                                                          ↓
                                                       failed
```

## فناوری‌ها

| کامپوننت | فناوری |
|----------|--------|
| Runtime Worker | Cloudflare Workers |
| Backend | Hono (TypeScript) |
| Frontend | React + Ant Design |
| Database | Cloudflare D1 |
| Object storage (خروجی رندر) | Cloudflare R2 |
| AI | Cloudflare Workers AI |
| Video render | Remotion 4 (GitHub Actions) |
| Analyze helper | FFmpeg (فقط در `analyze-video.yml`) |
| Social API | Zernio |
| Subtitles (محلی) | `tools/subtitle-generator` + Whisper/LLM |

## ساختار فایل‌ها (عمومی)

```
github-video-editor/
├── .github/workflows/           # Actions (Remotion + analyze + cleanup legacy)
├── remotion-video-creator/      # پروژه Remotion (compositions + public/video.mp4)
├── tools/subtitle-generator/    # پایپ‌لاین WebVTT با Workers AI
├── video-creator-worker/        # Worker (معمولاً ignore / ریپوی جدا)
├── PROJECT.md                   # این فایل
└── README.md                    # شروع سریع
```

## راهنمای سریع

### توسعه‌دهنده جدید

1. `README.md` — معماری و رندر محلی / تریگر workflow
2. `remotion-video-creator/` — `npm ci` سپس `npm run dev` (Remotion Studio)
3. `tools/subtitle-generator/README.md` — ساخت زیرنویس
4. `video-creator-worker/` — پنل و webhookها (در صورت دسترسی محلی)

### اضافه کردن قالب / composition جدید

1. کامپوننت را در `remotion-video-creator/src/` بسازید
2. در `src/Root.tsx` با `<Composition id="...">` ثبت کنید
3. گزینه را به `composition` در `video-edit.yml` اضافه کنید (و در صورت نیاز به Worker)

### امنیت و Secrets

1. توکن Cloudflare / GitHub را فقط در env یا Secrets بگذارید — هرگز در فایل‌های tracked
2. Callback ویدیو با `WORKFLOW_CALLBACK_SECRET` و هدر `X-Signature-256` امضا می‌شود
3. رپو پابلیک است: لاگ Actions و ورودی‌ها را عمومی فرض کنید؛ mp4های جدید روی Release نیستند
4. Secrets لازم در GitHub Actions (فقط نام‌ها): `WORKFLOW_CALLBACK_SECRET`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL`
5. روی Worker: همان `WORKFLOW_CALLBACK_SECRET` + `R2_PUBLIC_BASE_URL` (برای allowlist مسیر `renders/...`)
