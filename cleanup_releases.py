"""
Delete old GitHub releases from a repository.

Usage:
    python cleanup_releases.py                            # Delete releases older than 7 days
    python cleanup_releases.py --days 30                  # Delete releases older than 30 days
    python cleanup_releases.py --dry-run                  # Show what would be deleted without deleting
    python cleanup_releases.py --keep 10                  # Keep the 10 most recent releases
    python cleanup_releases.py --keep 30 --min-age-hours 336 --yes   # Non-interactive (cron/CI)

Reads GITHUB_TOKEN from .env file or environment variable.
"""

import os
import sys
import json
import argparse
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any


def load_token() -> str:
    """Load GitHub token from .env or environment."""
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        return token

    env_path = Path(__file__).parent / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("GITHUB_TOKEN="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")

    print("Error: GITHUB_TOKEN not found. Set it in .env or as environment variable.")
    sys.exit(1)


def load_repo() -> str:
    """Load repo from .env or detect from git remote."""
    repo = os.environ.get("GITHUB_REPO")
    if repo:
        return repo

    env_path = Path(__file__).parent / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("GITHUB_REPO="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")

    # Detect from git remote
    try:
        import subprocess
        result = subprocess.run(
            ["git", "remote", "get-url", "origin"],
            capture_output=True, text=True, cwd=Path(__file__).parent
        )
        url = result.stdout.strip()
        # Parse: https://github.com/owner/repo.git or git@github.com:owner/repo.git
        if "github.com" in url:
            parts = url.split("github.com")[-1].strip("/:")
            parts = parts.removesuffix(".git")
            return parts
    except Exception:
        pass

    print("Error: GITHUB_REPO not found. Set it in .env or ensure git remote is configured.")
    sys.exit(1)


def api_request(token: str, method: str, path: str, body: dict | None = None) -> tuple[int, Any]:
    """Make a GitHub API request."""
    url = f"https://api.github.com{path}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "ReleaseCleanupScript",
    }

    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req) as resp:
            payload = resp.read()
            return resp.status, json.loads(payload) if payload else None
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()
    except urllib.error.URLError as e:
        return 0, str(e.reason)


def get_all_releases(token: str, repo: str) -> list[dict]:
    """Fetch all releases (paginated)."""
    releases = []
    page = 1
    while True:
        status, data = api_request(token, "GET", f"/repos/{repo}/releases?per_page=100&page={page}")
        if status != 200:
            print(f"Error fetching releases: HTTP {status}")
            sys.exit(1)
        if not data:
            break
        releases.extend(data)
        if len(data) < 100:
            break
        page += 1
    return releases


def release_timestamp(release: dict) -> str:
    """Best-known timestamp for a release. Drafts have no published_at."""
    return release.get("published_at") or release.get("created_at") or ""


def release_age_hours(release: dict, now: datetime) -> float | None:
    """Age of a release in hours, or None when no usable timestamp exists."""
    raw = release_timestamp(release)
    if not raw:
        return None
    try:
        stamp = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None
    return (now - stamp).total_seconds() / 3600


def delete_release(token: str, repo: str, release_id: int, tag_name: str) -> bool:
    """Delete a single release."""
    status, _ = api_request(token, "DELETE", f"/repos/{repo}/releases/{release_id}")
    if status == 204:
        return True
    print(f"  Failed to delete {tag_name}: HTTP {status}")
    return False


def delete_tag(token: str, repo: str, tag_name: str) -> bool:
    """Delete a git tag."""
    status, _ = api_request(token, "DELETE", f"/repos/{repo}/git/refs/tags/{tag_name}")
    return status == 204


def confirm(count: int) -> bool:
    """Ask for interactive confirmation. A closed stdin counts as 'no'."""
    try:
        answer = input(f"\nDelete {count} releases? [y/N] ").strip().lower()
    except EOFError:
        print("\nNo input available (non-interactive). Use --yes to confirm.")
        return False
    return answer == "y"


def main():
    parser = argparse.ArgumentParser(description="Delete old GitHub releases")
    parser.add_argument("--days", type=int, default=7, help="Delete releases older than N days (default: 7)")
    parser.add_argument("--keep", type=int, default=0, help="Keep the N most recent releases (overrides --days)")
    parser.add_argument("--min-age-hours", type=float, default=0,
                        help="Never delete a release younger than N hours (safety guard, applied on top of --days/--keep)")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be deleted without deleting")
    parser.add_argument("--delete-tags", action="store_true", help="Also delete associated git tags")
    parser.add_argument("--repo", type=str, help="Repository (owner/repo). Auto-detected if not set.")
    parser.add_argument("-y", "--yes", action="store_true", help="Skip the confirmation prompt (for cron/CI)")
    args = parser.parse_args()

    token = load_token()
    repo = args.repo or load_repo()
    now = datetime.now(timezone.utc)

    print(f"Repository: {repo}")
    print("Loading releases...")

    releases = get_all_releases(token, repo)
    print(f"Total releases: {len(releases)}")

    # Sort by published_at descending; drafts (published_at: null) fall back to created_at
    releases.sort(key=release_timestamp, reverse=True)

    # Determine which to delete
    to_delete = []

    if args.keep > 0:
        # Keep the N most recent, delete the rest
        to_delete = releases[args.keep:]
        print(f"Keeping {min(args.keep, len(releases))} most recent releases")
    else:
        # Delete releases older than N days
        cutoff = now - timedelta(days=args.days)
        for r in releases:
            raw = release_timestamp(r)
            if raw:
                stamp = datetime.fromisoformat(raw.replace("Z", "+00:00"))
                if stamp < cutoff:
                    to_delete.append(r)
        print(f"Cutoff: {cutoff.strftime('%Y-%m-%d')} (releases older than {args.days} days)")

    if args.min_age_hours > 0:
        kept = []
        for r in to_delete:
            age = release_age_hours(r, now)
            if age is None or age < args.min_age_hours:
                continue
            kept.append(r)
        skipped = len(to_delete) - len(kept)
        to_delete = kept
        print(f"Age guard: keeping releases younger than {args.min_age_hours:g}h ({skipped} skipped)")

    if not to_delete:
        print("No releases to delete.")
        return

    print(f"\nReleases to delete: {len(to_delete)}")
    print("-" * 60)

    for r in to_delete:
        tag = r["tag_name"]
        name = r.get("name", "")
        pub = release_timestamp(r)[:10]
        print(f"  {tag:<20} {pub}  {name}")

    print("-" * 60)

    if args.dry_run:
        print("\n[DRY RUN] No releases were deleted.")
        return

    # Confirm
    if not args.yes and not confirm(len(to_delete)):
        print("Cancelled.")
        return

    # Delete
    deleted = 0
    failed = 0
    for r in to_delete:
        tag = r["tag_name"]
        rid = r["id"]
        print(f"  Deleting {tag}...", end=" ", flush=True)
        if delete_release(token, repo, rid, tag):
            deleted += 1
            print("OK")
            if args.delete_tags:
                delete_tag(token, repo, tag)
        else:
            failed += 1

    print(f"\nDone! Deleted: {deleted}, Failed: {failed}")

    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
