# Copyright (c) 2026 Mr-Aurevo-X. All rights reserved.
# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# SoftTunes ConfirmGate (aligned with SecurityHelpers SoT).
from __future__ import annotations

import hashlib
import hmac
import json
import secrets
import time
from typing import Any

class ConfirmGate:
    """Short-lived host-side confirmation tokens (UI confirm alone is not enough)."""

    def __init__(self, ttl_seconds: float = 60.0) -> None:
        self._ttl = float(ttl_seconds)
        self._secret = secrets.token_bytes(32)
        self._pending: dict[str, tuple[str, str, float]] = {}

    @staticmethod
    def _canonical_payload(payload: Any) -> Any:
        """Normalize pywebview / dict / list payloads for stable digests."""
        if payload is None:
            return None
        if isinstance(payload, (str, int, float, bool)):
            return payload
        if isinstance(payload, (list, tuple)):
            return [ConfirmGate._canonical_payload(x) for x in payload]
        if isinstance(payload, dict):
            return {
                str(k): ConfirmGate._canonical_payload(payload[k])
                for k in sorted(payload.keys(), key=lambda x: str(x))
            }
        # pywebview / Mapping-like objects
        try:
            items = dict(payload)  # type: ignore[arg-type]
            return ConfirmGate._canonical_payload(items)
        except Exception:
            return repr(payload)

    @staticmethod
    def _payload_digest(payload: Any) -> str:
        # Canonical JSON (sorted keys) — stable digests for prepare/consume.
        try:
            raw = json.dumps(
                ConfirmGate._canonical_payload(payload),
                ensure_ascii=False,
                separators=(",", ":"),
                sort_keys=True,
                default=str,
            ).encode("utf-8", errors="replace")
        except Exception:
            raw = repr(payload).encode("utf-8", errors="replace")
        return hashlib.sha256(raw).hexdigest()

    def prepare(self, action: str, payload: Any = None) -> str:
        action_key = str(action or "").strip()
        if not action_key:
            raise ValueError("empty action")
        digest = self._payload_digest(payload)
        nonce = secrets.token_hex(16)
        sig = hmac.new(
            self._secret,
            f"{action_key}|{digest}|{nonce}".encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        token = f"{nonce}.{sig}"
        self._pending[token] = (action_key, digest, time.monotonic() + self._ttl)
        return token

    def consume(self, token: str, action: str, payload: Any = None) -> bool:
        tok = str(token or "").strip()
        entry = self._pending.pop(tok, None)
        if entry is None:
            return False
        action_key, digest, expires = entry
        if time.monotonic() > expires:
            return False
        if action_key != str(action or "").strip():
            return False
        if digest != self._payload_digest(payload):
            return False
        expected = tok.split(".", 1)
        if len(expected) != 2:
            return False
        nonce, sig = expected
        want = hmac.new(
            self._secret,
            f"{action_key}|{digest}|{nonce}".encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(sig, want)
