"""
rate_limit.py — Minimal in-process per-user rate limiter.

Sliding-window counter keyed by user_id. Zero new dependencies. Defaults are
tuned conservatively for AI / paid-API routes so a single user can't burn
through the company's external-API budget.

NOTE: in-process state does not survive deploys, and does not coordinate across
multiple uvicorn workers / hosts. For production scale, replace with Upstash
Redis + slowapi. This is a "good-enough" defense-in-depth layer that closes
the most obvious abuse path until then.
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections import deque
from typing import Deque, Dict, Tuple

from fastapi import HTTPException

logger = logging.getLogger(__name__)

# (events_deque, lock) per user_id+bucket key
_buckets: Dict[str, Tuple[Deque[float], asyncio.Lock]] = {}
_global_lock = asyncio.Lock()


async def _get_bucket(key: str) -> Tuple[Deque[float], asyncio.Lock]:
    async with _global_lock:
        existing = _buckets.get(key)
        if existing is None:
            existing = (deque(), asyncio.Lock())
            _buckets[key] = existing
        return existing


async def enforce(
    user_id: str,
    bucket: str,
    max_events: int,
    window_seconds: float,
) -> None:
    """
    Raise HTTPException(429) if `user_id` has exceeded `max_events` within the
    last `window_seconds` for the named bucket.

    Args:
        user_id: identity from JWT (never trust body input)
        bucket:  logical operation name e.g. "recon", "match", "craft", "pdf"
        max_events:   how many calls allowed in the rolling window
        window_seconds: window size in seconds
    """
    if not user_id:
        return  # fail open for unauthenticated paths — auth gate handles it elsewhere

    key = f"{bucket}:{user_id}"
    events, lock = await _get_bucket(key)
    now = time.monotonic()
    cutoff = now - window_seconds

    async with lock:
        # drop expired timestamps
        while events and events[0] < cutoff:
            events.popleft()

        if len(events) >= max_events:
            retry_after = max(1, int(events[0] + window_seconds - now))
            logger.warning(
                "[rate_limit] DENY bucket=%s user=%s count=%d/%d retry_after=%ds",
                bucket, user_id, len(events), max_events, retry_after,
            )
            raise HTTPException(
                status_code=429,
                detail=(
                    "Terlalu banyak permintaan. Coba lagi dalam "
                    f"{retry_after} detik."
                ),
                headers={"Retry-After": str(retry_after)},
            )

        events.append(now)
