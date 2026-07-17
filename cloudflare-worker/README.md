# GitHub Video Trigger - Cloudflare Worker

This Cloudflare Worker replaces the Python `trigger.py` script. It triggers GitHub Actions video editing workflows via the GitHub API using `@octokit/rest`.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure wrangler.toml

Update `wrangler.toml` with your GitHub repo and workflow:

```toml
[vars]
GITHUB_REPO = "your-username/your-repo"
GITHUB_WORKFLOW = "video-edit.yml"
GITHUB_BRANCH = "main"
```

### 3. Set GitHub token as a secret

```bash
wrangler secret put GITHUB_TOKEN
```

Paste your GitHub token when prompted.

### 4. Local development

```bash
npm run dev
```

The worker will be available at `http://localhost:8787`.

### 5. Test locally

```bash
node test.js
```

### 6. Deploy to Cloudflare

```bash
npm run deploy
```

## Usage

Send a POST request to the worker URL:

```bash
curl -X POST https://your-worker.workers.dev \
  -H "Content-Type: application/json" \
  -d '{
    "video_url": "https://example.com/video.mp4",
    "static_text": "یک پدر و دوازده فرزند",
    "marquee_text": "برای خرید فالوور اینستاگرام به آیا ig_shop پیام بدید",
    "watermark_text": "@insta_shop",
    "output_format": "mp4"
  }'
```

### Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `video_url` | No | (bundled video.mp4) | URL of video to edit |
| `static_text` | No | `12 فرزند` | Static text for first phase (0-2s) |
| `marquee_text` | No | `برای خرید فالوور...` | Marquee text (2s-end) |
| `watermark_text` | No | `@insta_shop` | Watermark text |
| `output_format` | No | `mp4` | Output format: `mp4` or `zip` |

### Response

```json
{
  "success": true,
  "message": "Workflow triggered successfully",
  "status": 204,
  "repo": "your-username/your-repo",
  "workflow": "video-edit.yml",
  "branch": "main",
  "inputs": {
    "video_url": "https://example.com/video.mp4",
    "static_text": "یک پدر و دوازده فرزند",
    "marquee_text": "برای خرید فالوور اینستاگرام به آیا ig_shop پیام بدید",
    "watermark_text": "@insta_shop",
    "output_format": "mp4"
  },
  "check_url": "https://github.com/your-username/your-repo/actions"
}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | Yes (secret) | GitHub personal access token with `repo` and `actions` scope |
| `GITHUB_REPO` | Yes (var) | Repository in `owner/repo` format |
| `GITHUB_WORKFLOW` | Yes (var) | Workflow file name (e.g., `video-edit.yml`) |
| `GITHUB_BRANCH` | Yes (var) | Branch to trigger on (e.g., `main`) |
