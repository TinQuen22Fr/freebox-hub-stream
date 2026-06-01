"""Pydantic models for camera-hub-personal.

Documents are stored with a string UUID ``id`` (no ObjectId) and datetimes as
ISO-8601 strings, so API responses never leak raw Mongo documents.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


CameraType = Literal["rotatable", "indoor"]
CameraMode = Literal["local", "cloud", "hybrid"]
PTZProtocol = Literal["none", "cgi", "onvif", "tuya"]


# --------------------------------------------------------------------------- #
# Sub-configs
# --------------------------------------------------------------------------- #
class PTZConfig(BaseModel):
    protocol: PTZProtocol = "none"
    ip: Optional[str] = None
    port: int = 8080
    username: Optional[str] = None
    password: Optional[str] = None
    # CGI path used by the LSC / tasarren toolkit firmware (motor.cgi)
    cgi_path: str = "/cgi-bin/motor.cgi"
    default_dist: int = 10
    invert_pan: bool = False
    invert_tilt: bool = False
    # Tuya cloud PTZ
    tuya_device_id: Optional[str] = None


class TuyaDeviceConfig(BaseModel):
    device_id: Optional[str] = None
    local_key: Optional[str] = None
    local_ip: Optional[str] = None
    product_category: Optional[str] = None


# --------------------------------------------------------------------------- #
# Camera
# --------------------------------------------------------------------------- #
class CameraBase(BaseModel):
    name: str
    type: CameraType = "indoor"
    mode: CameraMode = "local"
    enabled: bool = True
    location: Optional[str] = None
    rtsp_url: Optional[str] = None
    ip: Optional[str] = None
    ptz: PTZConfig = Field(default_factory=PTZConfig)
    tuya: TuyaDeviceConfig = Field(default_factory=TuyaDeviceConfig)
    order: int = 0


class CameraCreate(CameraBase):
    pass


class CameraUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[CameraType] = None
    mode: Optional[CameraMode] = None
    enabled: Optional[bool] = None
    location: Optional[str] = None
    rtsp_url: Optional[str] = None
    ip: Optional[str] = None
    ptz: Optional[PTZConfig] = None
    tuya: Optional[TuyaDeviceConfig] = None
    order: Optional[int] = None


class Camera(CameraBase):
    id: str = Field(default_factory=new_id)
    stream_name: str
    is_demo: bool = False
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)
    # runtime, enriched by API (not stored)
    live: bool = False


# --------------------------------------------------------------------------- #
# PTZ request
# --------------------------------------------------------------------------- #
PTZAction = Literal["up", "down", "left", "right", "stop", "home"]


class PTZRequest(BaseModel):
    action: PTZAction
    dist: Optional[int] = None


# --------------------------------------------------------------------------- #
# Recording
# --------------------------------------------------------------------------- #
class Recording(BaseModel):
    id: str = Field(default_factory=new_id)
    camera_id: str
    camera_name: str
    started_at: str = Field(default_factory=now_iso)
    ended_at: Optional[str] = None
    duration: Optional[int] = None  # seconds
    trigger: Literal["manual", "motion", "schedule"] = "manual"
    size_bytes: int = 0
    has_thumbnail: bool = False


# --------------------------------------------------------------------------- #
# Motion event
# --------------------------------------------------------------------------- #
class MotionEvent(BaseModel):
    id: str = Field(default_factory=new_id)
    camera_id: str
    camera_name: str
    timestamp: str = Field(default_factory=now_iso)
    level: int = 50  # 0-100 intensity
    acknowledged: bool = False
    has_snapshot: bool = False


# --------------------------------------------------------------------------- #
# Settings (singleton)
# --------------------------------------------------------------------------- #
class TuyaCloudSettings(BaseModel):
    enabled: bool = False
    access_id: Optional[str] = None
    access_secret: Optional[str] = None
    region: str = "eu"  # eu | us | cn | in
    app_uid: Optional[str] = None


class Settings(BaseModel):
    id: str = "app_settings"
    player_mode: str = "mse"  # mse | webrtc,mse | webrtc,mse,hls
    go2rtc_public_url: Optional[str] = None  # set when self-hosting for direct WebRTC
    tuya: TuyaCloudSettings = Field(default_factory=TuyaCloudSettings)
    motion_detection: bool = True
    updated_at: str = Field(default_factory=now_iso)


class SettingsUpdate(BaseModel):
    player_mode: Optional[str] = None
    go2rtc_public_url: Optional[str] = None
    tuya: Optional[TuyaCloudSettings] = None
    motion_detection: Optional[bool] = None
