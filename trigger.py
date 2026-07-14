import requests
import sys
import os
from pathlib import Path

def load_env():
    env_path = Path(__file__).parent / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip())


def trigger_workflow(repo, workflow, token, video_url, branch="main"):
    url = f"https://api.github.com/repos/{repo}/actions/workflows/{workflow}/dispatches"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
    }
    data = {
        "ref": branch,
        "inputs": {
            "video": video_url
        }
    }

    print(f"Triggering workflow '{workflow}' on {repo}...")
    print(f"Video: {video_url}")
    print(f"Branch: {branch}")

    resp = requests.post(url, json=data, headers=headers)

    if resp.status_code == 204:
        print("Workflow triggered successfully!")
        print(f"\nCheck runs at: https://github.com/{repo}/actions")
    else:
        print(f"Failed! Status: {resp.status_code}")
        print(f"Response: {resp.text}")
        sys.exit(1)


if __name__ == "__main__":
    load_env()
    if len(sys.argv) < 4:
        print("Usage: python trigger.py <owner/repo> <workflow_file> <github_token> [video_url] [branch]")
        print("\nExample:")
        print('  python trigger.py myuser/my-repo video-edit.yml ghp_xxxxx "https://example.com/video.mp4"')
        print("\nEnvironment variable alternative:")
        print("  Set GITHUB_TOKEN env var to skip passing token as argument")
        sys.exit(1)

    repo = sys.argv[1]
    workflow = sys.argv[2]
    token = sys.argv[3] if len(sys.argv) > 3 else os.environ.get("GITHUB_TOKEN", "")

    if not token:
        print("Error: GitHub token required. Pass as argument or set GITHUB_TOKEN env var.")
        sys.exit(1)

    video_url = sys.argv[4] if len(sys.argv) > 4 else "https://example.com/sample.mp4"
    branch = sys.argv[5] if len(sys.argv) > 5 else "main"

    trigger_workflow(repo, workflow, token, video_url, branch)
