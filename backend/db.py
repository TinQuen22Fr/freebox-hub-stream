"""MongoDB connection and collection handles for camera-hub-personal."""
import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# Collections
cameras_col = db.cameras
recordings_col = db.recordings
motion_col = db.motion_events
settings_col = db.settings

# Filesystem
RECORDINGS_DIR = os.environ.get("RECORDINGS_DIR", "/app/go2rtc/recordings")
Path(RECORDINGS_DIR).mkdir(parents=True, exist_ok=True)
