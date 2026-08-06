# GitHub Video Editor

Automated social-video pipeline: Instagram reels come in via a Cloudflare Worker, get edited/analyzed, then rendered with **Remotion** on GitHub Actions. Successful mp4 output is uploaded to **Cloudflare R2** and published through Zernio.

This repository is **public**. Actions minutes on the free public tier are effectively unlimited, and **workflow logs/inputs remain public**. New rendered mp4s are **not** published as GitHub Release assets (they go to R2 under `renders/<job>/<random>.mp4`). Older releases may still exist until cleaned up — never put secrets or private media URLs into logs or props dumps.

## Architecture

```
Instagram DM → Zernio webhook → Cloudflare Worker (D1 + AI)
                                      │
                                      ▼
                         GitHub Actions: video-edit.yml
                         (Remotion render, ~4 vCPU / 15 GiB runner)
                                      │
                                      ▼
                         Cloudflare R2: renders/<job>/<random>.mp4
                                      │
                                      ▼
              Signed webhook (HMAC) → Worker allowlists R2_PUBLIC_BASE_URL
                                      │
                                      ▼
                              Publish via Zernio
```

Optional debug path: `output_format=zip` uploads a short-lived Actions Artifact instead of R2 (not the success delivery path).

| Piece | Location |
|-------|----------|
| Remotion compositions | `remotion-video-creator/` (`InstagramReel`, `YouTubeLongVideo`, `DynamicTemplate`) |
| Render / analyze / legacy cleanup workflows | `.github/workflows/` |
| Cloudflare Worker + dashboard | `video-creator-worker/` (often gitignored / separate deploy) |
| Local WebVTT subtitle pipeline | `tools/subtitle-generator/` |

Persian deep-dive: [`PROJECT.md`](./PROJECT.md).

## Compositions

Registered in `remotion-video-creator/src/Root.tsx`:

- **InstagramReel** — 720×1280 vertical reel
- **YouTubeLongVideo** — 1920×1080 landscape
- **DynamicTemplate** — layer JSON via `template_config`

## Local Remotion render

```bash
cd remotion-video-creator
npm ci
npm run dev          # Remotion Studio
```

Put a sample file at `remotion-video-creator/public/video.mp4` (Studio / default props use `videoSrc: "video.mp4"`).

CLI-style render (same idea as CI):

```bash
cd remotion-video-creator
npx remotion render InstagramReel --output=../outputs/output.mp4 --codec=h264
```

Pass props with `--props=path/to/props.json` when you need titles, watermark, VTT, or `templateConfig`.

## Trigger the Video Edit workflow

**GitHub UI:** Actions → **Video Edit** → Run workflow. Useful inputs: `video_url`, `composition`, `static_text`, `marquee_text`, `watermark_text`, `subtitle_content`, `template_config`, `webhook_url`, `shortcode`, `output_format`.

**CLI / API** (needs a PAT with `workflow` scope in the environment):

```powershell
$env:GITHUB_TOKEN = "ghp_..."   # do not commit this
# optional helpers (gitignored): trigger_workflow.ps1, trigger_workflow_no_url.ps1, trigger_check.ps1
```

Or with `gh`:

```bash
gh workflow run video-edit.yml -f composition=InstagramReel -f output_format=mp4
```

Worker-side dispatch lives under `video-creator-worker/` (build-trigger / GitHub API helpers).

## Subtitles

```bash
cd tools/subtitle-generator
pip install -r requirements.txt
# set CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN (or CLOUDFLARE_ACCOUNTS)
ffmpeg -i video.mp4 -vn -acodec pcm_s16le -ar 16000 -ac 1 audio.wav -y
python subtitle_pipeline.py audio.wav my_subs
```

Feed the `.vtt` contents into the workflow `subtitle_content` input. Details: [`tools/subtitle-generator/README.md`](./tools/subtitle-generator/README.md).

## Worker

The control plane is **`video-creator-worker/`**:

- `worker/` — Hono API, webhooks, cron, D1, Workers AI
- `src/` — React dashboard
- Deploy with Wrangler (`wrangler.jsonc`)

If that directory is missing from a clone, it may be private/local-only (see root `.gitignore`).

### Telegram ↔ dashboard posting

Optional ingest path (same `posts` pipeline as DM, status `pending`):

1. Dashboard home → **اتصال به تلگرام** creates a short-lived deep link (`t.me/<bot>?start=<token>`, ~15 min).
2. Opening it runs `/start <token>` and binds that Telegram chat to the dashboard user.
3. Pick a social account (`/accounts`), then send Instagram reel/post URL(s) — one or many per message (`reel` / `reels` / `p` / `tv` on instagram.com only).
4. Bot commands: `/accounts`, `/cancel`, `/help`, `/unlink`.

**Ops:** apply D1 migration `0039_telegram_dashboard_link.sql`, re-set the Telegram webhook from Settings (stores/checks `secret_token`), deploy the Worker.

**Limitation:** social-account listing for the bot is loose/single-tenant (all synced accounts if the user owns a Zernio key or is admin).

Persian detail: [`PROJECT.md`](./PROJECT.md) — بخش «اتصال تلگرام ↔ داشبورد».

## Security & secrets

- Credentials: environment variables / GitHub Secrets only — never commit them.
- Callback from Actions to the Worker is HMAC-signed (`X-Signature-256`) with `WORKFLOW_CALLBACK_SECRET`.
- **GitHub Actions secrets (names only):** `WORKFLOW_CALLBACK_SECRET`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL`.
- **Worker:** same `WORKFLOW_CALLBACK_SECRET` + `R2_PUBLIC_BASE_URL` (allowlist for `renders/...` URLs).
- Legacy: `release-delete.yml` / `cleanup.yml` still exist for old GitHub Releases; new mp4 delivery does not use Releases.
