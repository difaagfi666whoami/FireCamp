"""
tavily_research_service.py — Tavily Research API integration for Pro Mode.

Calls POST https://api.tavily.com/research with the user's raw query,
polls until completed, and returns the markdown content + sources.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

RESEARCH_URL = "https://api.tavily.com/research"
POLL_INTERVAL = 8   # seconds between polls
MAX_POLLS     = 38  # max ~300 seconds (5 minutes) total


async def run_tavily_research(query: str) -> dict[str, Any]:
    """
    Submit a research task to Tavily Research API and poll until done.

    Args:
        query: Free-form research query. Can be URL only, or URL + directives.
               e.g. "https://javaplas.com/ company profile, pricing, pain points"

    Returns:
        dict with keys:
          - content: str  — full markdown report from Tavily
          - sources: list — list of {url, title} dicts
          - request_id: str
    """
    api_key = settings.TAVILY_API_KEY
    if not api_key:
        raise ValueError("TAVILY_API_KEY is not configured")

    auth_headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type":  "application/json",
    }

    # --- Submit research task ---
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            RESEARCH_URL,
            headers=auth_headers,
            json={"input": query, "model": "mini", "max_results": 5},
        )
        resp.raise_for_status()
        task = resp.json()

    request_id = task.get("request_id")
    if not request_id:
        raise ValueError(f"Tavily did not return request_id: {task}")

    logger.info("[tavily_research] submitted | request_id=%s", request_id)

    # --- Poll until completed ---
    poll_url = f"{RESEARCH_URL}/{request_id}"
    params   = {}

    for attempt in range(MAX_POLLS):
        await asyncio.sleep(POLL_INTERVAL)
        async with httpx.AsyncClient(timeout=30) as client:
            poll = await client.get(poll_url, headers=auth_headers, params=params)
            poll.raise_for_status()
            result = poll.json()

        status = result.get("status", "")
        logger.info("[tavily_research] poll %d | status=%s", attempt + 1, status)

        if status == "completed":
            content = result.get("content", "")
            sources = result.get("sources", [])
            logger.info(
                "[tavily_research] DONE | chars=%d sources=%d",
                len(content), len(sources),
            )
            return {"content": content, "sources": sources, "request_id": request_id}

        if status in ("failed", "error"):
            raise RuntimeError(f"Tavily research failed: {result}")

    raise TimeoutError(f"Tavily research did not complete after {MAX_POLLS * POLL_INTERVAL}s")
