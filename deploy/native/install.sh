#!/usr/bin/env bash
# Native installer for camera-hub-personal (NO Docker).
# Usage:
#   sudo bash deploy/native/install.sh            # full install (systemd + build)
#   bash deploy/native/install.sh --go2rtc-only   # just fetch the go2rtc binary
#
# Run from the repository root (the folder containing backend/ frontend/ deploy/).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PREFIX="${PREFIX:-/opt/camera-hub}"
PUBLIC_ORIGIN="${PUBLIC_ORIGIN:-https://surveillance-video.quentin-astro.fr}"
SERVICE_USER="${SERVICE_USER:-camerahub}"
GO2RTC_DIR="$REPO_ROOT/deploy/native/go2rtc"

detect_arch() {
  case "$(uname -m)" in
    x86_64|amd64) echo "amd64" ;;
    aarch64|arm64) echo "arm64" ;;
    armv7l|armv6l) echo "armv7" ;;
    *) echo "amd64" ;;
  esac
}

fetch_go2rtc() {
  local arch; arch="$(detect_arch)"
  mkdir -p "$GO2RTC_DIR"
  if [ ! -x "$GO2RTC_DIR/go2rtc" ]; then
    echo ">> Downloading go2rtc (linux_${arch})..."
    curl -fsSL -o "$GO2RTC_DIR/go2rtc" \
      "https://github.com/AlexxIT/go2rtc/releases/latest/download/go2rtc_linux_${arch}"
    chmod +x "$GO2RTC_DIR/go2rtc"
  fi
  "$GO2RTC_DIR/go2rtc" --version | head -1 || true
}

if [ "${1:-}" = "--go2rtc-only" ]; then
  fetch_go2rtc
  exit 0
fi

echo "== camera-hub-personal — native install =="
echo "Repo: $REPO_ROOT | Prefix: $PREFIX | Origin: $PUBLIC_ORIGIN"

# 1) service user
id -u "$SERVICE_USER" >/dev/null 2>&1 || sudo useradd --system --no-create-home --shell /usr/sbin/nologin "$SERVICE_USER"

# 2) layout
sudo mkdir -p "$PREFIX/go2rtc" "$PREFIX/recordings"
fetch_go2rtc
sudo cp "$GO2RTC_DIR/go2rtc" "$PREFIX/go2rtc/go2rtc"
[ -f "$PREFIX/go2rtc/go2rtc.yaml" ] || sudo cp "$REPO_ROOT/deploy/go2rtc.example.yaml" "$PREFIX/go2rtc/go2rtc.yaml"

# 3) link app (so /opt/camera-hub/app points at the repo)
if [ "$REPO_ROOT" != "$PREFIX/app" ]; then
  sudo ln -sfn "$REPO_ROOT" "$PREFIX/app"
fi

# 4) python venv + backend deps
if [ ! -d "$PREFIX/venv" ]; then
  sudo python3 -m venv "$PREFIX/venv"
fi
sudo "$PREFIX/venv/bin/pip" install --upgrade pip
sudo "$PREFIX/venv/bin/pip" install -r "$REPO_ROOT/backend/requirements.txt"

# 5) env file
if [ ! -f "$PREFIX/camera-hub.env" ]; then
  sudo cp "$REPO_ROOT/deploy/native/camera-hub.env.example" "$PREFIX/camera-hub.env"
  sudo sed -i "s#__PUBLIC_ORIGIN__#$PUBLIC_ORIGIN#g" "$PREFIX/camera-hub.env"
  sudo sed -i "s#__RECORDINGS__#$PREFIX/recordings#g" "$PREFIX/camera-hub.env"
fi

# 6) build frontend
echo ">> Building frontend (REACT_APP_BACKEND_URL=$PUBLIC_ORIGIN)..."
( cd "$REPO_ROOT/frontend" && yarn install --frozen-lockfile && REACT_APP_BACKEND_URL="$PUBLIC_ORIGIN" yarn build )

# 7) permissions
sudo chown -R "$SERVICE_USER:$SERVICE_USER" "$PREFIX/go2rtc" "$PREFIX/recordings"

# 8) systemd units
echo ">> Installing systemd units..."
sudo cp "$REPO_ROOT/deploy/native/go2rtc.service" /etc/systemd/system/go2rtc.service
sudo cp "$REPO_ROOT/deploy/native/camera-hub-backend.service" /etc/systemd/system/camera-hub-backend.service
sudo sed -i "s#__PREFIX__#$PREFIX#g; s#__USER__#$SERVICE_USER#g" \
  /etc/systemd/system/go2rtc.service /etc/systemd/system/camera-hub-backend.service
sudo systemctl daemon-reload
sudo systemctl enable --now go2rtc.service
sudo systemctl enable --now camera-hub-backend.service

echo
echo "== Done. Next steps =="
echo "  1) Edit $PREFIX/go2rtc/go2rtc.yaml with your cameras (remove demo_*)"
echo "  2) sudo cp deploy/native/nginx-kimsufi-native.conf /etc/nginx/sites-available/surveillance-video.conf"
echo "  3) sudo ln -s .../sites-available/surveillance-video.conf /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx"
echo "  4) sudo certbot --nginx -d surveillance-video.quentin-astro.fr"
echo "  Health: curl -s http://127.0.0.1:8001/api/health"
