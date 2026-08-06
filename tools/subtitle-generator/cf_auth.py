"""
Cloudflare Workers AI credentials, loaded from the environment.

Two ways to configure:

  Single account:
    CLOUDFLARE_ACCOUNT_ID=<account id>
    CLOUDFLARE_API_TOKEN=<api token>

  Several accounts (rotated on HTTP 429 to work around the daily free quota):
    CLOUDFLARE_ACCOUNTS="name:<account id>:<api token>,name2:<account id>:<api token>"

Never hardcode tokens here — this file is committed to a public repository.
"""
import os
import time
from typing import List, NamedTuple

import requests


class Account(NamedTuple):
    name: str
    account_id: str
    api_token: str


def load_accounts() -> List[Account]:
    raw = os.environ.get("CLOUDFLARE_ACCOUNTS", "").strip()
    if raw:
        accounts = []
        for entry in raw.split(","):
            entry = entry.strip()
            if not entry:
                continue
            parts = entry.split(":")
            if len(parts) != 3:
                raise ValueError(
                    f"Bad CLOUDFLARE_ACCOUNTS entry {entry!r}; expected name:account_id:api_token"
                )
            accounts.append(Account(parts[0], parts[1], parts[2]))
        if accounts:
            return accounts

    account_id = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "").strip()
    api_token = os.environ.get("CLOUDFLARE_API_TOKEN", "").strip()
    if account_id and api_token:
        return [Account("default", account_id, api_token)]

    raise SystemExit(
        "No Cloudflare credentials found. Set CLOUDFLARE_ACCOUNT_ID and "
        "CLOUDFLARE_API_TOKEN, or CLOUDFLARE_ACCOUNTS for multi-account rotation."
    )


class CloudflareAI:
    """Thin Workers AI client that rotates accounts when one is rate limited."""

    def __init__(self, accounts: List[Account] = None):
        self.accounts = accounts or load_accounts()
        self.index = 0

    @property
    def account(self) -> Account:
        return self.accounts[self.index]

    def rotate(self, reason: str = "") -> None:
        old = self.account.name
        self.index = (self.index + 1) % len(self.accounts)
        print(f"  -> Rotating account: {old} -> {self.account.name} {reason}")

    def run(self, model: str, payload: dict, retries: int = None) -> requests.Response:
        """POST to `/ai/run/<model>`. The URL is rebuilt after each rotation so the
        account id always matches the token being sent."""
        attempts = retries if retries is not None else len(self.accounts)
        response = None
        for _ in range(max(attempts, 1)):
            acc = self.account
            url = f"https://api.cloudflare.com/client/v4/accounts/{acc.account_id}/ai/run/{model}"
            headers = {
                "Authorization": f"Bearer {acc.api_token}",
                "Content-Type": "application/json",
            }
            response = requests.post(url, headers=headers, json=payload)
            if response.status_code == 429 and len(self.accounts) > 1:
                self.rotate(f"(429 from {acc.name})")
                time.sleep(0.5)
                continue
            return response
        return response
