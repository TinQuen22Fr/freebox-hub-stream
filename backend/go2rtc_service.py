"""Thin async client for the go2rtc streaming engine.

The backend is the single source of truth (MongoDB). On startup and on every
camera mutation it pushes the corresponding stream into go2rtc via its REST API
(``PUT /api/streams``). Live video is delivered to the browser through a
WebSocket proxy (see server.py) so it traverses the Kubernetes ingress on the
``/api`` path.
"""
import logging
import os
from typing import Dict, Optional

import httpx

logger = logging.getLogger("go2rtc")

GO2RTC_URL = os.environ.get("GO2RTC_URL", "http://127.0.0.1:1984").rstrip("/")


def ws_base() -> str:
    """ws:// or wss:// base derived from GO2RTC_URL (used by the WS proxy)."""
    if GO2RTC_URL.startswith("https://"):
        return "wss://" + GO2RTC_URL[len("https://"):]
    return "ws://" + GO2RTC_URL[len("http://"):]


async def info() -> Optional[dict]:
    try:
        async with httpx.AsyncClient(timeout=4) as c:
            r = await c.get(f"{GO2RTC_URL}/api")
            if r.status_code == 200:
                return r.json()
    except Exception as e:  # noqa: BLE001
        logger.warning("go2rtc info failed: %s", e)
    return None


async def list_streams() -> Dict[str, dict]:
    try:
        async with httpx.AsyncClient(timeout=4) as c:
            r = await c.get(f"{GO2RTC_URL}/api/streams")
            if r.status_code == 200:
                return r.json() or {}
    except Exception as e:  # noqa: BLE001
        logger.warning("go2rtc list_streams failed: %s", e)
    return {}


async def put_stream(name: str, src: str) -> bool:
    try:
        async with httpx.AsyncClient(timeout=6) as c:
            r = await c.put(f"{GO2RTC_URL}/api/streams", params={"name": name, "src": src})
            return r.status_code in (200, 201, 204)
    except Exception as e:  # noqa: BLE001
        logger.warning("go2rtc put_stream %s failed: %s", name, e)
        return False


async def delete_stream(name: str) -> bool:
    try:
        async with httpx.AsyncClient(timeout=6) as c:
            r = await c.delete(f"{GO2RTC_URL}/api/streams", params={"src": name})
            return r.status_code in (200, 204)
    except Exception as e:  # noqa: BLE001
        logger.warning("go2rtc delete_stream %s failed: %s", name, e)
        return False


async def get_snapshot(name: str) -> Optional[bytes]:
    """Return a JPEG snapshot for a stream (triggers the producer on demand)."""
    try:
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.get(f"{GO2RTC_URL}/api/frame.jpeg", params={"src": name})
            if r.status_code == 200 and r.content:
                return r.content
    except Exception as e:  # noqa: BLE001
        logger.warning("go2rtc snapshot %s failed: %s", name, e)
    return None
