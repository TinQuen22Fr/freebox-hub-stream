"""Tuya / SmartLife Cloud client (scaffold).

This implements the Tuya OpenAPI token + HMAC-SHA256 request signing so that, as
soon as the user provides Access ID / Access Secret / region / linked app UID
(via Settings), the hub can list devices, read status, allocate live streams and
send PTZ commands to cameras that are NOT flashed with the local RTSP toolkit.

It is intentionally dependency-light (httpx only). Until credentials are
configured, all calls raise TuyaNotConfigured and the UI shows a setup guide.
"""
import hashlib
import hmac
import logging
import time
import uuid
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger("tuya")

REGION_ENDPOINTS = {
    "eu": "https://openapi.tuyaeu.com",
    "us": "https://openapi.tuyaus.com",
    "cn": "https://openapi.tuyacn.com",
    "in": "https://openapi.tuyain.com",
}


class TuyaNotConfigured(Exception):
    pass


class TuyaError(Exception):
    pass


class TuyaClient:
    def __init__(self, access_id: str, access_secret: str, region: str = "eu", app_uid: Optional[str] = None):
        if not access_id or not access_secret:
            raise TuyaNotConfigured("Tuya Access ID / Secret manquants")
        self.access_id = access_id
        self.access_secret = access_secret
        self.base_url = REGION_ENDPOINTS.get(region, REGION_ENDPOINTS["eu"])
        self.app_uid = app_uid
        self._token: Optional[str] = None
        self._token_expire: float = 0.0

    # --- signing ---------------------------------------------------------- #
    def _sign(self, method: str, path: str, body: str = "", token: str = "") -> Dict[str, str]:
        t = str(int(time.time() * 1000))
        nonce = str(uuid.uuid4())
        content_sha = hashlib.sha256(body.encode()).hexdigest()
        string_to_sign = f"{method.upper()}\n{content_sha}\n\n{path}"
        sign_str = self.access_id + token + t + nonce + string_to_sign
        signature = hmac.new(
            self.access_secret.encode(), sign_str.encode(), hashlib.sha256
        ).hexdigest().upper()
        headers = {
            "client_id": self.access_id,
            "sign": signature,
            "sign_method": "HMAC-SHA256",
            "t": t,
            "nonce": nonce,
            "lang": "en",
        }
        if token:
            headers["access_token"] = token
        return headers

    async def _ensure_token(self) -> None:
        if self._token and time.time() < self._token_expire - 60:
            return
        path = "/v1.0/token?grant_type=1"
        headers = self._sign("GET", path)
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.get(f"{self.base_url}{path}", headers=headers)
            data = r.json()
        if not data.get("success"):
            raise TuyaError(f"token error: {data.get('code')} {data.get('msg')}")
        res = data["result"]
        self._token = res["access_token"]
        self._token_expire = time.time() + res.get("expire_time", 3600)

    async def _request(self, method: str, path: str, body: Optional[dict] = None) -> dict:
        await self._ensure_token()
        import json as _json
        body_str = "" if body is None else _json.dumps(body, separators=(",", ":"))
        headers = self._sign(method, path, body_str, self._token or "")
        async with httpx.AsyncClient(timeout=12) as c:
            r = await c.request(method, f"{self.base_url}{path}", headers=headers,
                                content=body_str if body is not None else None)
            data = r.json()
        if not data.get("success"):
            raise TuyaError(f"{data.get('code')}: {data.get('msg')}")
        return data.get("result", {})

    # --- high level ------------------------------------------------------- #
    async def list_devices(self) -> List[dict]:
        if not self.app_uid:
            raise TuyaError("app_uid (compte SmartLife lié) requis")
        res = await self._request("GET", f"/v1.0/users/{self.app_uid}/devices")
        return res if isinstance(res, list) else res.get("devices", [])

    async def device_status(self, device_id: str) -> dict:
        return await self._request("GET", f"/v1.0/devices/{device_id}/status")

    async def allocate_stream(self, device_id: str, stream_type: str = "hls") -> dict:
        return await self._request(
            "POST", f"/v1.0/devices/{device_id}/stream/actions/allocate",
            body={"type": stream_type},
        )

    async def ptz(self, device_id: str, value: str) -> dict:
        return await self._request(
            "POST", f"/v1.0/devices/{device_id}/commands",
            body={"commands": [{"code": "ptz_control", "value": value}]},
        )


def client_from_settings(tuya_settings: Dict[str, Any]) -> TuyaClient:
    if not tuya_settings or not tuya_settings.get("enabled"):
        raise TuyaNotConfigured("Mode Cloud Tuya non activé")
    return TuyaClient(
        access_id=tuya_settings.get("access_id") or "",
        access_secret=tuya_settings.get("access_secret") or "",
        region=tuya_settings.get("region", "eu"),
        app_uid=tuya_settings.get("app_uid"),
    )
