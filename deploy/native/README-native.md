# camera-hub-personal — Installation NATIVE (sans Docker)

systemd + nginx + go2rtc (binaire) + venv Python + build React.
Aucun Docker. Aucune modification de firewall. Même logique que tes services
sqm.quentin-astro.fr / storm-monitor.quentin-astro.fr.

---

## Prérequis (HP Ubuntu Studio 24.04 ET Kimsufi Debian)

```bash
# Python 3.11+, venv, Node 18+/yarn, nginx, git
sudo apt update
sudo apt install -y python3 python3-venv python3-pip git nginx ffmpeg curl

# Node + yarn (si pas déjà là)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm i -g yarn

# MongoDB : soit le paquet distro, soit MongoDB Community (officiel).
# Ubuntu/Debian rapide :
sudo apt install -y mongodb || echo "Sinon suivre https://www.mongodb.com/docs/manual/installation/"
sudo systemctl enable --now mongod 2>/dev/null || sudo systemctl enable --now mongodb
```

> ffmpeg est requis par go2rtc pour transcoder/relayer certains flux.

---

## A. Test rapide en LOCAL sur le HP (sans nginx, sans systemd)

Idéal pour valider avant de déployer. (Le port 3000 est pris par ton SQM-Fork → on utilise 8090.)

```bash
git clone https://github.com/TinQuen22Fr/freebox-hub-stream.git
cd freebox-hub-stream

# 1) go2rtc (détection d'archi automatique)
bash deploy/native/install.sh --go2rtc-only

# 2) Backend
python3 -m venv venv && . venv/bin/activate
pip install -r backend/requirements.txt
GO2RTC_URL=http://127.0.0.1:1984 MONGO_URL=mongodb://127.0.0.1:27017 DB_NAME=camerahub \
RECORDINGS_DIR=$PWD/recordings \
  uvicorn server:app --app-dir backend --host 127.0.0.1 --port 8001 &

# 3) go2rtc
./deploy/native/go2rtc/go2rtc -config deploy/go2rtc.example.yaml &

# 4) Frontend (dev)
cd frontend && yarn install
PORT=8090 REACT_APP_BACKEND_URL=http://localhost:8001 yarn start
```

Ouvre http://localhost:8090 → tu verras les 3 mires de démo + tu pourras ajouter tes
vraies caméras (`rtsp://192.168.0.61:554/main_ch`, etc.).

---

## B. Production sur le KIMSUFI (systemd + nginx + TLS)

```bash
# 1) Récupérer le code et lancer l'installeur guidé
sudo mkdir -p /opt/camera-hub
cd /opt/camera-hub
sudo git clone https://github.com/TinQuen22Fr/freebox-hub-stream.git app
cd app
sudo bash deploy/native/install.sh
```

`install.sh` (idempotent) effectue :
- création de l'utilisateur système `camerahub`,
- téléchargement du **bon binaire go2rtc** selon l'archi (amd64/arm64),
- venv Python + `pip install -r backend/requirements.txt`,
- **build du frontend** avec `REACT_APP_BACKEND_URL=https://surveillance-video.quentin-astro.fr`,
- installation + activation des services `go2rtc.service` et `camera-hub-backend.service`,
- copie de `go2rtc.example.yaml` → `/opt/camera-hub/go2rtc/go2rtc.yaml` (à éditer).

Puis Nginx :
```bash
sudo cp deploy/native/nginx-kimsufi-native.conf /etc/nginx/sites-available/surveillance-video.conf
sudo ln -s /etc/nginx/sites-available/surveillance-video.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d surveillance-video.quentin-astro.fr
```

Vérifs :
```bash
systemctl status go2rtc camera-hub-backend
curl -s http://127.0.0.1:8001/api/health
journalctl -u camera-hub-backend -f      # logs backend
journalctl -u go2rtc -f                   # logs go2rtc
```

---

## C. Brancher tes caméras
- UI du hub → « + Caméra » → `rtsp://IP:554/main_ch`, type *Rotative* pour les 2 PTZ, PTZ = `CGI` port `8080` user `admin`.
- Le backend injecte le flux dans go2rtc automatiquement. (Tu peux aussi pré-remplir `go2rtc.yaml`.)
- **WebRTC faible latence** : décommente `webrtc.candidates` (IP publique Kimsufi) dans `go2rtc.yaml`,
  ouvre `8555/udp`, et règle le lecteur sur `webrtc,mse` dans **Réglages**.

## D. Mises à jour
```bash
cd /opt/camera-hub/app && sudo git pull
sudo /opt/camera-hub/venv/bin/pip install -r backend/requirements.txt
cd frontend && sudo REACT_APP_BACKEND_URL=https://surveillance-video.quentin-astro.fr yarn build
sudo systemctl restart camera-hub-backend go2rtc
```

## E. Accès caméras LAN depuis le Kimsufi
Tes caméras sont derrière la Freebox. Active **WireGuard** sur la Freebox Révolution et
connecte le Kimsufi en client WG → il atteint `192.168.x.x:554`. (Voir deploy/README.md §4.)
