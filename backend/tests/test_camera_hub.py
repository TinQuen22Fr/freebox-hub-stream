"""Backend regression tests for camera-hub-personal."""
import asyncio
import os
import time

import pytest
import requests
import websockets

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# --- system / health ---
class TestSystem:
    def test_health(self, s):
        r = s.get(f"{API}/health", timeout=15)
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    def test_system_status(self, s):
        r = s.get(f"{API}/system/status", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["go2rtc"]["online"] is True
        assert d["go2rtc"]["version"]
        assert d["cameras"]["total"] == 8
        assert d["cameras"]["live"] == 3
        assert d["cameras"]["offline"] == 5


# --- cameras list/seed ---
class TestCamerasSeed:
    def test_list_cameras(self, s):
        r = s.get(f"{API}/cameras", timeout=15)
        assert r.status_code == 200
        cams = r.json()
        assert len(cams) == 8
        by_stream = {c["stream_name"]: c for c in cams}
        for name in ("demo_entrance", "demo_garage", "demo_garden"):
            assert by_stream[name]["live"] is True
        # mode badges present
        modes = {c["mode"] for c in cams}
        assert {"local", "cloud", "hybrid"} <= modes


# --- CRUD for cameras ---
class TestCameraCRUD:
    created_id = None

    def test_create(self, s):
        payload = {
            "name": "TEST_Cam_RTSP",
            "type": "rotatable",
            "mode": "local",
            "location": "TestLab",
            "rtsp_url": "rtsp://127.0.0.1:9999/no",
        }
        r = s.post(f"{API}/cameras", json=payload, timeout=15)
        assert r.status_code == 201, r.text
        d = r.json()
        assert d["name"] == "TEST_Cam_RTSP"
        assert d["type"] == "rotatable"
        assert d["stream_name"].startswith("test_cam_rtsp")
        TestCameraCRUD.created_id = d["id"]

        r2 = s.get(f"{API}/cameras/{d['id']}", timeout=15)
        assert r2.status_code == 200
        assert r2.json()["name"] == "TEST_Cam_RTSP"

    def test_update(self, s):
        cid = TestCameraCRUD.created_id
        assert cid
        r = s.put(f"{API}/cameras/{cid}",
                  json={"name": "TEST_Cam_RTSP_2", "location": "Other"}, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["name"] == "TEST_Cam_RTSP_2"
        assert d["location"] == "Other"

    def test_delete(self, s):
        cid = TestCameraCRUD.created_id
        assert cid
        r = s.delete(f"{API}/cameras/{cid}", timeout=15)
        assert r.status_code == 200
        assert r.json().get("ok") is True
        r2 = s.get(f"{API}/cameras/{cid}", timeout=15)
        assert r2.status_code == 404


# --- snapshot ---
class TestSnapshot:
    def test_snapshot_live(self, s):
        cams = s.get(f"{API}/cameras").json()
        live = next(c for c in cams if c["stream_name"] == "demo_entrance")
        # streams may need a couple of seconds to fully be ready
        ok = False
        for _ in range(5):
            r = s.get(f"{API}/cameras/{live['id']}/snapshot", timeout=15)
            if r.status_code == 200 and len(r.content) > 1000 and r.headers.get("content-type", "").startswith("image/jpeg"):
                ok = True
                break
            time.sleep(2)
        assert ok, f"snapshot failed status={r.status_code} bytes={len(r.content)}"

    def test_snapshot_offline_cloud(self, s):
        cams = s.get(f"{API}/cameras").json()
        cloud = next(c for c in cams if c["mode"] == "cloud")
        r = s.get(f"{API}/cameras/{cloud['id']}/snapshot", timeout=15)
        assert r.status_code == 503


# --- PTZ ---
class TestPTZ:
    def test_ptz_rotatable_demo(self, s):
        cams = s.get(f"{API}/cameras").json()
        rot = next(c for c in cams if c["stream_name"] == "demo_entrance")
        r = s.post(f"{API}/cameras/{rot['id']}/ptz",
                   json={"action": "left"}, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("ok") is True
        assert d.get("simulated") is True

    def test_ptz_indoor_rejected(self, s):
        cams = s.get(f"{API}/cameras").json()
        ind = next(c for c in cams if c["type"] == "indoor")
        r = s.post(f"{API}/cameras/{ind['id']}/ptz",
                   json={"action": "left"}, timeout=15)
        assert r.status_code == 400


# --- recordings ---
class TestRecordings:
    rec_id = None

    def test_create_recording(self, s):
        cams = s.get(f"{API}/cameras").json()
        live = next(c for c in cams if c["stream_name"] == "demo_entrance")
        r = s.post(f"{API}/cameras/{live['id']}/recordings", timeout=20)
        assert r.status_code == 201, r.text
        d = r.json()
        assert d["camera_id"] == live["id"]
        assert d.get("has_thumbnail") is True
        TestRecordings.rec_id = d["id"]

    def test_list_recordings(self, s):
        r = s.get(f"{API}/recordings", timeout=15)
        assert r.status_code == 200
        ids = [x["id"] for x in r.json()]
        assert TestRecordings.rec_id in ids

    def test_delete_recording(self, s):
        rid = TestRecordings.rec_id
        r = s.delete(f"{API}/recordings/{rid}", timeout=15)
        assert r.status_code == 200
        assert r.json().get("ok") is True


# --- motion events ---
class TestMotion:
    ev_id = None

    def test_list_seed(self, s):
        r = s.get(f"{API}/motion-events", timeout=15)
        assert r.status_code == 200
        assert len(r.json()) >= 3

    def test_simulate(self, s):
        r = s.post(f"{API}/motion-events/simulate", timeout=20)
        assert r.status_code == 201, r.text
        d = r.json()
        assert d["id"]
        TestMotion.ev_id = d["id"]

    def test_ack(self, s):
        r = s.put(f"{API}/motion-events/{TestMotion.ev_id}/ack", timeout=15)
        assert r.status_code == 200
        assert r.json().get("acknowledged") is True

    def test_snapshot(self, s):
        r = s.get(f"{API}/motion-events/{TestMotion.ev_id}/snapshot", timeout=15)
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("image/jpeg")
        assert len(r.content) > 1000

    def test_delete(self, s):
        r = s.delete(f"{API}/motion-events/{TestMotion.ev_id}", timeout=15)
        assert r.status_code == 200


# --- settings ---
class TestSettings:
    def test_get(self, s):
        r = s.get(f"{API}/settings", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["player_mode"] == "mse"
        assert d["tuya"]["enabled"] is False

    def test_put_persists(self, s):
        r = s.put(f"{API}/settings",
                  json={"player_mode": "webrtc", "motion_detection": False},
                  timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["player_mode"] == "webrtc"
        assert d["motion_detection"] is False
        # reset
        s.put(f"{API}/settings",
              json={"player_mode": "mse", "motion_detection": True}, timeout=15)


# --- tuya ---
class TestTuya:
    def test_status(self, s):
        r = s.get(f"{API}/tuya/status", timeout=15)
        assert r.status_code == 200
        assert r.json()["enabled"] is False

    def test_test_unconfigured(self, s):
        r = s.post(f"{API}/tuya/test", timeout=15)
        assert r.status_code == 400


# --- WebSocket proxy ---
class TestWebSocket:
    def test_ws_proxy_demo_entrance(self):
        async def run():
            ws_url = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")
            url = f"{ws_url}/api/ws?src=demo_entrance"
            text_count = 0
            binary_bytes = 0
            async with websockets.connect(url, max_size=None, open_timeout=15) as ws:
                # Send MSE negotiation
                await ws.send('{"type":"mse","value":"avc1.640029,mp4a.40.2"}')
                start = time.time()
                while time.time() - start < 12:
                    try:
                        msg = await asyncio.wait_for(ws.recv(), timeout=10)
                    except asyncio.TimeoutError:
                        break
                    if isinstance(msg, (bytes, bytearray)):
                        binary_bytes += len(msg)
                        if binary_bytes > 100_000:
                            break
                    else:
                        text_count += 1
            return text_count, binary_bytes

        tc, bb = asyncio.get_event_loop().run_until_complete(run()) \
            if hasattr(asyncio, "get_event_loop") and not asyncio.get_event_loop().is_closed() \
            else asyncio.run(run())
        assert tc >= 1, f"no text negotiation msg (text={tc}, bin={bb})"
        assert bb > 100_000, f"insufficient binary fmp4 data: {bb}"
