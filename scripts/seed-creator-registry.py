#!/usr/bin/env python3
"""Seed Firestore creator_registry from data/creator-accounts.json.

Usage (from this repo root — Trekstak-Partnership / partners-site):
  python3 scripts/seed-creator-registry.py
  npm run seed:registry

Requires firebase-service-account-key.json in this repo root, or in the parent
Trekstak 1.5 folder on your Mac (same key used by other upload scripts).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
ACCOUNTS_PATH = REPO_ROOT / "data" / "creator-accounts.json"
KEY_CANDIDATES = [
    REPO_ROOT / "firebase-service-account-key.json",
    REPO_ROOT.parent / "firebase-service-account-key.json",
]


def email_to_registry_id(email: str) -> str:
    return email.strip().lower().replace(".", "_dot_").replace("@", "_at_")


def resolve_key_path() -> Path | None:
    for path in KEY_CANDIDATES:
        if path.is_file():
            return path
    return None


def main() -> int:
    if not ACCOUNTS_PATH.is_file():
        print(f"Missing {ACCOUNTS_PATH}", file=sys.stderr)
        return 1

    key_path = resolve_key_path()
    if not key_path:
        print(
            "Missing firebase-service-account-key.json in repo root or parent folder.",
            file=sys.stderr,
        )
        return 1

    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
    except ImportError:
        print("Install firebase-admin: pip install firebase-admin", file=sys.stderr)
        return 1

    if not firebase_admin._apps:
        cred = credentials.Certificate(str(key_path))
        firebase_admin.initialize_app(cred)

    data = json.loads(ACCOUNTS_PATH.read_text(encoding="utf-8"))
    creators = data.get("creators") or []
    db = firestore.client()
    batch = db.batch()
    count = 0

    for creator in creators:
        email = (creator.get("email") or "").strip().lower()
        slug = (creator.get("slug") or "").strip().lower()
        creator_id = creator.get("id") or ""
        if not email or not slug:
            print(f"Skipping incomplete creator: {creator_id or email}")
            continue

        doc_id = email_to_registry_id(email)
        ref = db.collection("creator_registry").document(doc_id)
        batch.set(
            ref,
            {
                "email": email,
                "slug": slug,
                "creatorId": creator_id,
                "status": "active",
                "displayName": creator.get("displayName") or "",
                "handle": creator.get("handle") or "",
                "promoCode": creator.get("promoCode") or "",
                "discountLabel": creator.get("discountLabel") or "",
                "publicPageUrl": creator.get("publicPageUrl") or "",
                "appStoreUrl": creator.get("appStoreUrl") or "",
                "socials": creator.get("socials") or {},
                "updatedAt": firestore.SERVER_TIMESTAMP,
            },
            merge=True,
        )
        count += 1
        print(f"  {doc_id} -> slug={slug}")

    if count:
        batch.commit()
    print(f"Seeded {count} creator_registry document(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
