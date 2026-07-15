"""Trigger the video-edit GitHub Actions workflow with Persian-safe encoding.

Sends workflow_dispatch inputs as proper UTF-8 so Persian/Arabic text is not
corrupted into "?" before reaching the runner. Optional text inputs
(static_text, marquee_text, watermark_text) override the workflow defaults.
"""
import json
import sys
import os
from pathlib import Path

import requests


def load_env():
    env_path = Path(__file__).parent / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip())


def trigger_workflow(repo, workflow, token, inputs, branch="main"):
    url = f"https://api.github.com/repos/{repo}/actions/workflows/{workflow}/dispatches"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        # Explicit charset so any intermediary keeps the body UTF-8 intact.
        "Content-Type": "application/json; charset=utf-8",
    }
    data = {"ref": branch, "inputs": inputs}

    # Encode with ensure_ascii=False and force UTF-8 bytes. Using requests'
    # default `json=` would emit \uXXXX escapes (also valid), but sending raw
    # UTF-8 is the most robust against any proxy/encoding issue along the way.
    body = json.dumps(data, ensure_ascii=False).encode("utf-8")

    print(f"Triggering workflow '{workflow}' on {repo}...")
    print(f"Branch: {branch}")
    for k, v in inputs.items():
        shown = v if len(v) <= 60 else v[:57] + "..."
        print(f"  {k}: {shown}")

    resp = requests.post(url, data=body, headers=headers)

    if resp.status_code == 204:
        print("\nWorkflow triggered successfully!")
        print(f"Check runs at: https://github.com/{repo}/actions")
    else:
        print(f"\nFailed! Status: {resp.status_code}")
        print(f"Response: {resp.text}")
        sys.exit(1)


def _build_inputs(video_url, static_text, marquee_text, watermark_text):
    """Assemble workflow inputs, dropping empties so defaults are preserved."""
    inputs = {}
    if video_url:
        inputs["video"] = video_url
    if static_text:
        inputs["static_text"] = static_text
    if marquee_text:
        inputs["marquee_text"] = marquee_text
    if watermark_text:
        inputs["watermark_text"] = watermark_text
    return inputs


if __name__ == "__main__":
    load_env()

    import argparse
    p = argparse.ArgumentParser(
        description="Trigger the video-edit workflow (Persian-safe).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Example:\n"
            '  python trigger.py myuser/my-repo video-edit.yml ghp_xxx \\\n'
            '      --marquee-text "برای خرید پیام بدید"'
        ),
    )
    p.add_argument("repo", help="owner/repo, e.g. myuser/my-repo")
    p.add_argument("workflow", help="workflow file, e.g. video-edit.yml")
    p.add_argument("token", nargs="?", default=os.environ.get("GITHUB_TOKEN", ""),
                   help="GitHub token (or set GITHUB_TOKEN env var)")
    p.add_argument("--branch", default="main", help="branch to run on")
    p.add_argument("--video-url", default=None, help="video URL input")
    p.add_argument("--static-text", default=None, help="static text (0-2s)")
    p.add_argument("--marquee-text", default=None, help="marquee text (2s-end)")
    p.add_argument("--watermark-text", default=None, help="watermark text")

    # Backward-compat: positional video_url as 4th arg still works.
    if len(sys.argv) >= 4 and not sys.argv[3].startswith("-") and sys.argv[3] != os.environ.get("GITHUB_TOKEN", ""):
        # Heuristic: old CLI passed repo, workflow, token, [video_url], [branch]
        args, _remaining = p.parse_known_args()
        positional = [a for a in sys.argv[3:] if not a.startswith("-")]
        if positional and args.token and not args.video_url:
            args.video_url = positional[0]
    else:
        args = p.parse_args()

    if not args.token:
        print("Error: GitHub token required. Pass as argument or set GITHUB_TOKEN env var.")
        sys.exit(1)

    inputs = _build_inputs(args.video_url, args.static_text,
                           args.marquee_text, args.watermark_text)
    trigger_workflow(args.repo, args.workflow, args.token, inputs, args.branch)
