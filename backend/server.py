"""camera-hub-personal — FastAPI backend.

Unified hub for LSC (Tuya) IP cameras with two modes:
  * Local  : RTSP via the tasarren toolkit -> go2rtc -> WebRTC/MSE in the browser
  * Cloud  : Tuya/SmartLife API (scaffold, enabled from Settings)

Live video reaches the browser through a WebSocket proxy to go2rtc so it works
behind the Kubernetes ingress on the /api path.
"""
import asyncio
import logging
import os
import re
from pathlib import Path
from typing import List, Optional

import httpx
import websockets
from fastapi import APIRouter, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, Response
from starlette.middleware.cors import CORSMiddleware

import go2rtc_service as g2
import tuya_service
from db import (
    RECORDINGS_DIR,
    cameras_col,
    client,
    motion_col,
    recordings_col,
    settings_col,
)
from models import (
    Camera,
    CameraCreate,
    CameraUpdate,
    MotionEvent,
    PTZRequest,
    Recording,
    Settings,
    SettingsUpdate,
    now_iso,
)

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("hub")

app = FastAPI(title="camera-hub-personal")
api = APIRouter(prefix="/api")


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
    return s or "cam"


async def get_settings_doc() -> dict:
    doc = await settings_col.find_one({"id": "app_settings"}, {"_id": 0})
    if not doc:
        doc = Settings().model_dump()
        await settings_col.insert_one(doc)
    return doc


async def live_stream_names() -> set:
    return set((await g2.list_streams()).keys())


async def enrich_camera(doc: dict, live_names: set) -> dict:
    doc = {k: v for k, v in doc.items() if k != "_id"}
    doc["live"] = doc.get("stream_name") in live_names
    return doc


async def sync_camera_stream(cam: dict) -> None:
    """Push/update or remove the camera's go2rtc stream based on its config."""
    name = cam["stream_name"]
    if cam.get("is_demo"):
        return  # demo streams are defined statically in go2rtc.yaml
    enabled = cam.get("enabled", True)
    mode = cam.get("mode", "local")
    rtsp = cam.get("rtsp_url")
    if enabled and mode in ("local", "hybrid") and rtsp:
        await g2.put_stream(name, rtsp)
    else:
        await g2.delete_stream(name)


# --------------------------------------------------------------------------- #
# PTZ execution
# --------------------------------------------------------------------------- #
async def execute_ptz(cam: dict, action: str, dist: Optional[int]) -> dict:
    if cam.get("is_demo"):
        return {"ok": True, "simulated": True, "action": action}

    ptz = cam.get("ptz") or {}
    proto = ptz.get("protocol", "none")
    d = dist or ptz.get("default_dist", 10)

    if proto == "cgi":
        ip = ptz.get("ip") or cam.get("ip")
        if not ip:
            raise HTTPException(400, "IP de la caméra manquante pour le PTZ CGI")
        direction = action
        if ptz.get("invert_pan") and action in ("left", "right"):
            direction = "right" if action == "left" else "left"
        if ptz.get("invert_tilt") and action in ("up", "down"):
            direction = "down" if action == "up" else "up"
        port = ptz.get("port", 8080)
        path = ptz.get("cgi_path", "/cgi-bin/motor.cgi")
        url = f"http://{ip}:{port}{path}"
        params = {"dir": direction, "dist": d}
        auth = None
        if ptz.get("username"):
            auth = (ptz.get("username"), ptz.get("password") or "")
        try:
            async with httpx.AsyncClient(timeout=5) as c:
                r = await c.get(url, params=params, auth=auth)
            return {"ok": r.status_code < 400, "status": r.status_code, "url": url}
        except Exception as e:  # noqa: BLE001
            raise HTTPException(502, f"PTZ CGI injoignable: {e}")

    if proto == "tuya":
        settings = await get_settings_doc()
        try:
            tc = tuya_service.client_from_settings(settings.get("tuya", {}))
            dev = ptz.get("tuya_device_id") or (cam.get("tuya") or {}).get("device_id")
            if not dev:
                raise HTTPException(400, "tuya_device_id manquant")
            res = await tc.ptz(dev, action)
            return {"ok": True, "tuya": res}
        except tuya_service.TuyaNotConfigured as e:
            raise HTTPException(400, f"Tuya non configuré: {e}")
        except tuya_service.TuyaError as e:
            raise HTTPException(502, f"Erreur Tuya: {e}")

    if proto == "onvif":
        raise HTTPException(
            501,
            "PTZ ONVIF pas encore implémenté. Utilise le mode CGI (motor.cgi du "
            "toolkit tasarren) ou Tuya pour le moment.",
        )

    raise HTTPException(400, "Cette caméra n'a pas de contrôle PTZ configuré")


# --------------------------------------------------------------------------- #
# Routes : meta / system
# --------------------------------------------------------------------------- #
@api.get("/")
async def root():
    return {"app": "camera-hub-personal", "status": "ok"}


@api.get("/health")
async def health():
    return {"status": "ok", "time": now_iso()}


@api.get("/system/status")
async def system_status():
    g2info = await g2.info()
    streams = await g2.list_streams()
    total = await cameras_col.count_documents({})
    live = sum(1 for c in await cameras_col.find({}, {"stream_name": 1, "_id": 0}).to_list(1000)
               if c.get("stream_name") in streams)
    settings = await get_settings_doc()
    return {
        "go2rtc": {
            "online": g2info is not None,
            "version": (g2info or {}).get("version"),
            "streams": list(streams.keys()),
        },
        "cameras": {"total": total, "live": live, "offline": total - live},
        "tuya_cloud": {"enabled": bool(settings.get("tuya", {}).get("enabled"))},
        "time": now_iso(),
    }


# --------------------------------------------------------------------------- #
# Routes : cameras
# --------------------------------------------------------------------------- #
@api.get("/cameras", response_model=List[Camera])
async def list_cameras():
    live_names = await live_stream_names()
    docs = await cameras_col.find({}).sort("order", 1).to_list(1000)
    return [await enrich_camera(d, live_names) for d in docs]


@api.get("/cameras/{camera_id}", response_model=Camera)
async def get_camera(camera_id: str):
    doc = await cameras_col.find_one({"id": camera_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Caméra introuvable")
    doc["live"] = doc.get("stream_name") in await live_stream_names()
    return doc


@api.post("/cameras", response_model=Camera, status_code=201)
async def create_camera(payload: CameraCreate):
    count = await cameras_col.count_documents({})
    stream_name = f"{slugify(payload.name)}_{count + 1}"
    cam = Camera(**payload.model_dump(), stream_name=stream_name)
    doc = cam.model_dump()
    doc.pop("live", None)
    await cameras_col.insert_one(dict(doc))
    await sync_camera_stream(doc)
    doc["live"] = doc["stream_name"] in await live_stream_names()
    return doc


@api.put("/cameras/{camera_id}", response_model=Camera)
async def update_camera(camera_id: str, payload: CameraUpdate):
    doc = await cameras_col.find_one({"id": camera_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Caméra introuvable")
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
    updates["updated_at"] = now_iso()
    doc.update(updates)
    await cameras_col.update_one({"id": camera_id}, {"$set": updates})
    await sync_camera_stream(doc)
    doc["live"] = doc.get("stream_name") in await live_stream_names()
    return doc


@api.delete("/cameras/{camera_id}")
async def delete_camera(camera_id: str):
    doc = await cameras_col.find_one({"id": camera_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Caméra introuvable")
    if not doc.get("is_demo"):
        await g2.delete_stream(doc["stream_name"])
    await cameras_col.delete_one({"id": camera_id})
    return {"ok": True}


@api.get("/cameras/{camera_id}/snapshot")
async def camera_snapshot(camera_id: str):
    doc = await cameras_col.find_one({"id": camera_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Caméra introuvable")
    jpeg = await g2.get_snapshot(doc["stream_name"])
    if not jpeg:
        raise HTTPException(503, "Flux indisponible (hors-ligne ou non configuré)")
    return Response(content=jpeg, media_type="image/jpeg",
                    headers={"Cache-Control": "no-store"})


@api.post("/cameras/{camera_id}/test")
async def test_camera(camera_id: str):
    doc = await cameras_col.find_one({"id": camera_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Caméra introuvable")
    if not doc.get("is_demo"):
        await sync_camera_stream(doc)
    jpeg = await g2.get_snapshot(doc["stream_name"])
    return {"ok": jpeg is not None, "bytes": len(jpeg) if jpeg else 0}


@api.post("/cameras/{camera_id}/ptz")
async def ptz(camera_id: str, req: PTZRequest):
    doc = await cameras_col.find_one({"id": camera_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Caméra introuvable")
    if doc.get("type") != "rotatable":
        raise HTTPException(400, "Cette caméra n'est pas rotative")
    return await execute_ptz(doc, req.action, req.dist)


# --------------------------------------------------------------------------- #
# Routes : recordings
# --------------------------------------------------------------------------- #
@api.get("/recordings", response_model=List[Recording])
async def list_recordings(camera_id: Optional[str] = None):
    q = {"camera_id": camera_id} if camera_id else {}
    docs = await recordings_col.find(q, {"_id": 0}).sort("started_at", -1).to_list(500)
    return docs


@api.post("/cameras/{camera_id}/recordings", response_model=Recording, status_code=201)
async def create_recording(camera_id: str):
    doc = await cameras_col.find_one({"id": camera_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Caméra introuvable")
    rec = Recording(camera_id=camera_id, camera_name=doc["name"], trigger="manual",
                    duration=12, size_bytes=12 * 1024 * 384)
    jpeg = await g2.get_snapshot(doc["stream_name"])
    if jpeg:
        Path(f"{RECORDINGS_DIR}/{rec.id}.jpg").write_bytes(jpeg)
        rec.has_thumbnail = True
    rec.ended_at = now_iso()
    await recordings_col.insert_one(rec.model_dump())
    return rec


@api.get("/recordings/{rec_id}/thumbnail")
async def recording_thumbnail(rec_id: str):
    path = Path(f"{RECORDINGS_DIR}/{rec_id}.jpg")
    if path.exists():
        return FileResponse(str(path), media_type="image/jpeg")
    raise HTTPException(404, "Pas de vignette")


@api.delete("/recordings/{rec_id}")
async def delete_recording(rec_id: str):
    await recordings_col.delete_one({"id": rec_id})
    Path(f"{RECORDINGS_DIR}/{rec_id}.jpg").unlink(missing_ok=True)
    return {"ok": True}


# --------------------------------------------------------------------------- #
# Routes : motion events
# --------------------------------------------------------------------------- #
@api.get("/motion-events", response_model=List[MotionEvent])
async def list_motion(camera_id: Optional[str] = None):
    q = {"camera_id": camera_id} if camera_id else {}
    docs = await motion_col.find(q, {"_id": 0}).sort("timestamp", -1).to_list(500)
    return docs


@api.post("/motion-events/simulate", response_model=MotionEvent, status_code=201)
async def simulate_motion(camera_id: Optional[str] = None):
    if camera_id:
        cam = await cameras_col.find_one({"id": camera_id}, {"_id": 0})
    else:
        live = await live_stream_names()
        cam = await cameras_col.find_one({"stream_name": {"$in": list(live)}}, {"_id": 0})
    if not cam:
        raise HTTPException(404, "Aucune caméra en ligne pour simuler le mouvement")
    import random
    ev = MotionEvent(camera_id=cam["id"], camera_name=cam["name"],
                     level=random.randint(40, 95))
    jpeg = await g2.get_snapshot(cam["stream_name"])
    if jpeg:
        Path(f"{RECORDINGS_DIR}/motion_{ev.id}.jpg").write_bytes(jpeg)
        ev.has_snapshot = True
    await motion_col.insert_one(ev.model_dump())
    return ev


@api.get("/motion-events/{event_id}/snapshot")
async def motion_snapshot(event_id: str):
    ev = await motion_col.find_one({"id": event_id}, {"_id": 0})
    if not ev:
        raise HTTPException(404, "Évènement introuvable")
    path = Path(f"{RECORDINGS_DIR}/motion_{event_id}.jpg")
    if not path.exists():
        cam = await cameras_col.find_one({"id": ev["camera_id"]}, {"_id": 0})
        jpeg = await g2.get_snapshot(cam["stream_name"]) if cam else None
        if jpeg:
            path.write_bytes(jpeg)
    if path.exists():
        return FileResponse(str(path), media_type="image/jpeg")
    raise HTTPException(404, "Pas d'instantané")


@api.put("/motion-events/{event_id}/ack", response_model=MotionEvent)
async def ack_motion(event_id: str):
    await motion_col.update_one({"id": event_id}, {"$set": {"acknowledged": True}})
    ev = await motion_col.find_one({"id": event_id}, {"_id": 0})
    if not ev:
        raise HTTPException(404, "Évènement introuvable")
    return ev


@api.delete("/motion-events/{event_id}")
async def delete_motion(event_id: str):
    await motion_col.delete_one({"id": event_id})
    Path(f"{RECORDINGS_DIR}/motion_{event_id}.jpg").unlink(missing_ok=True)
    return {"ok": True}


# --------------------------------------------------------------------------- #
# Routes : settings
# --------------------------------------------------------------------------- #
@api.get("/settings", response_model=Settings)
async def get_settings():
    return await get_settings_doc()


@api.put("/settings", response_model=Settings)
async def update_settings(payload: SettingsUpdate):
    cur = await get_settings_doc()
    updates = payload.model_dump(exclude_unset=True)
    if "tuya" in updates and updates["tuya"] is not None:
        merged = {**cur.get("tuya", {}), **updates["tuya"]}
        updates["tuya"] = merged
    updates["updated_at"] = now_iso()
    cur.update(updates)
    await settings_col.update_one({"id": "app_settings"}, {"$set": updates}, upsert=True)
    return cur


# --------------------------------------------------------------------------- #
# Routes : Tuya cloud (scaffold)
# --------------------------------------------------------------------------- #
@api.get("/tuya/status")
async def tuya_status():
    s = (await get_settings_doc()).get("tuya", {})
    return {
        "enabled": bool(s.get("enabled")),
        "configured": bool(s.get("access_id") and s.get("access_secret")),
        "region": s.get("region", "eu"),
        "app_uid_set": bool(s.get("app_uid")),
    }


@api.post("/tuya/test")
async def tuya_test():
    s = (await get_settings_doc()).get("tuya", {})
    try:
        tc = tuya_service.client_from_settings(s)
        devices = await tc.list_devices()
        cams = [d for d in devices if "ipc" in str(d.get("category", "")).lower()]
        return {"ok": True, "device_count": len(devices), "camera_count": len(cams),
                "devices": devices[:20]}
    except tuya_service.TuyaNotConfigured as e:
        raise HTTPException(400, str(e))
    except tuya_service.TuyaError as e:
        raise HTTPException(502, f"Erreur Tuya: {e}")
    except Exception as e:  # noqa: BLE001
        raise HTTPException(500, f"Echec test Tuya: {e}")


# --------------------------------------------------------------------------- #
# WebSocket proxy to go2rtc (carries WebRTC signaling + MSE media)
# --------------------------------------------------------------------------- #
@app.websocket("/api/ws")
async def go2rtc_ws_proxy(ws: WebSocket):
    src = ws.query_params.get("src", "")
    await ws.accept()
    url = f"{g2.ws_base()}/api/ws?src={src}"
    try:
        async with websockets.connect(url, max_size=None, open_timeout=10) as upstream:

            async def client_to_upstream():
                try:
                    while True:
                        msg = await ws.receive()
                        if msg.get("type") == "websocket.disconnect":
                            break
                        if msg.get("text") is not None:
                            await upstream.send(msg["text"])
                        elif msg.get("bytes") is not None:
                            await upstream.send(msg["bytes"])
                except (WebSocketDisconnect, Exception):  # noqa: BLE001
                    pass

            async def upstream_to_client():
                try:
                    async for message in upstream:
                        if isinstance(message, (bytes, bytearray)):
                            await ws.send_bytes(bytes(message))
                        else:
                            await ws.send_text(message)
                except Exception:  # noqa: BLE001
                    pass

            await asyncio.gather(client_to_upstream(), upstream_to_client())
    except Exception as e:  # noqa: BLE001
        logger.warning("WS proxy error for src=%s: %s", src, e)
    finally:
        try:
            await ws.close()
        except Exception:  # noqa: BLE001
            pass


# --------------------------------------------------------------------------- #
# Startup : seed demo + sync streams
# --------------------------------------------------------------------------- #
DEMO_CAMERAS = [
    {"name": "Caméra Entrée", "type": "rotatable", "mode": "hybrid", "location": "Extérieur",
     "stream_name": "demo_entrance", "ip": "192.168.0.61",
     "ptz": {"protocol": "cgi", "ip": "192.168.0.61", "port": 8080, "username": "admin",
             "cgi_path": "/cgi-bin/motor.cgi", "default_dist": 10}},
    {"name": "Caméra Allée", "type": "rotatable", "mode": "local", "location": "Extérieur",
     "stream_name": "demo_garage", "ip": "192.168.0.62",
     "ptz": {"protocol": "cgi", "ip": "192.168.0.62", "port": 8080, "username": "admin",
             "cgi_path": "/cgi-bin/motor.cgi", "default_dist": 10}},
    {"name": "Salon", "type": "indoor", "mode": "local", "location": "RDC",
     "stream_name": "demo_garden", "ip": "192.168.0.63"},
    {"name": "Cuisine", "type": "indoor", "mode": "cloud", "location": "RDC",
     "stream_name": "cam_cuisine", "tuya": {"device_id": "bf-cuisine-xxxx"}},
    {"name": "Garage", "type": "indoor", "mode": "cloud", "location": "Sous-sol",
     "stream_name": "cam_garage", "tuya": {"device_id": "bf-garage-xxxx"}},
    {"name": "Chambre", "type": "indoor", "mode": "cloud", "location": "Étage",
     "stream_name": "cam_chambre", "tuya": {"device_id": "bf-chambre-xxxx"}},
    {"name": "Bureau", "type": "indoor", "mode": "cloud", "location": "Étage",
     "stream_name": "cam_bureau", "tuya": {"device_id": "bf-bureau-xxxx"}},
    {"name": "Couloir", "type": "indoor", "mode": "cloud", "location": "Étage",
     "stream_name": "cam_couloir", "tuya": {"device_id": "bf-couloir-xxxx"}},
]


async def seed_demo():
    if await cameras_col.count_documents({}) > 0:
        return
    logger.info("Seeding demo cameras...")
    for i, c in enumerate(DEMO_CAMERAS):
        cam = Camera(name=c["name"], type=c["type"], mode=c["mode"],
                     location=c.get("location"), ip=c.get("ip"),
                     stream_name=c["stream_name"], order=i, is_demo=True)
        d = cam.model_dump()
        d.pop("live", None)
        if "ptz" in c:
            d["ptz"].update(c["ptz"])
        if "tuya" in c:
            d["tuya"].update(c["tuya"])
        await cameras_col.insert_one(d)

    # a couple of seed motion events on live cameras
    import random
    live = ["demo_entrance", "demo_garage", "demo_garden"]
    cams = await cameras_col.find({"stream_name": {"$in": live}}, {"_id": 0}).to_list(10)
    for cam in cams:
        ev = MotionEvent(camera_id=cam["id"], camera_name=cam["name"],
                         level=random.randint(45, 90), has_snapshot=True)
        await motion_col.insert_one(ev.model_dump())


@app.on_event("startup")
async def on_startup():
    await get_settings_doc()
    await seed_demo()
    # sync all non-demo cameras into go2rtc
    try:
        for cam in await cameras_col.find({"is_demo": {"$ne": True}}, {"_id": 0}).to_list(1000):
            await sync_camera_stream(cam)
    except Exception as e:  # noqa: BLE001
        logger.warning("startup stream sync failed: %s", e)
    logger.info("camera-hub-personal backend ready")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
