# camera-hub-personal — Guide de déploiement (auto-hébergé)

Hub de vidéosurveillance pour caméras **LSC (Tuya / SmartLife)** vendues chez Action.
Deux modes par caméra : **Local (RTSP → go2rtc → WebRTC/MSE)** et **Cloud SmartLife (Tuya)**.

Stack : React + FastAPI + MongoDB + **go2rtc** (moteur de flux). Cible : ton portable **HP**
(Ubuntu Studio 24.04) puis ton **Kimsufi OVH** sur `surveillance-video.quentin-astro.fr`.

---

## 0. Découverte importante — toolkit tasarren & double mode

Sur la carte micro-SD, le toolkit exécute `custom/configs/hack.conf`. Deux flags clés :

| Flag | Défaut | Mets à | Effet |
|------|:------:|:------:|-------|
| `OFFLINE` | `1` | **`0`** | La puce **Anyka** garde le **Cloud SmartLife/Tuya ET le RTSP local** actifs en même temps → **mode `hybrid` (Dual)**. Avec `1`, la caméra apparaît « déconnectée » dans SmartLife. |
| `MUTE_FACTORY_PROMPT` | `1` | **`0`** | Réactive le **prompt sonore** au boot : tu entends si le mode RTSP/factory s'active correctement. |

> Une caméra flashée avec `OFFLINE=0` se déclare en mode **`hybrid`** dans le hub :
> flux RTSP local **et** contrôle/streaming Cloud Tuya disponibles.

RTSP du toolkit : `rtsp://IP:554/main_ch` · ONVIF : port `8080` · PTZ CGI : `http://IP:8080/cgi-bin/motor.cgi?dir=left&dist=10`.

---

## 1. Architecture

```
Navigateur ──HTTPS──> Nginx (Kimsufi) ──/──> frontend (React build)
                                      └──/api──> backend (FastAPI :8001)
                                                    │  REST + proxy WebSocket
                                                    ▼
                                                 go2rtc :1984  ──RTSP──> caméras LSC (LAN)
                                                    │  WebRTC :8555 (faible latence)
                                                    ▼
                                                 MongoDB
```

- **Mode Local** : le backend injecte chaque `rtsp_url` dans go2rtc (`PUT /api/streams`). Le navigateur lit le flux via le proxy WebSocket `/api/ws` (MSE) ou directement en **WebRTC** (latence mini) si exposé.
- **Mode Cloud** : Tuya OpenAPI (Access ID/Secret) — voir §5.

---

## 2. Lancement rapide avec Docker (recommandé)

```bash
cd deploy
cp .env.example .env            # édite PUBLIC_HOST, MONGO, etc.
# Mets ta vraie config caméras dans go2rtc.example.yaml -> go2rtc.yaml
cp go2rtc.example.yaml go2rtc.yaml
docker compose up -d --build
```

- Frontend : http://127.0.0.1:8088
- Backend  : http://127.0.0.1:8001/api/health
- go2rtc UI : http://127.0.0.1:1984 (admin/diagnostic)

> Le build frontend fige `REACT_APP_BACKEND_URL`. Mets-y l'URL publique finale
> (ex. `https://surveillance-video.quentin-astro.fr`) avant `docker compose build`.

---

## 3. Lancement « à la main » (dev sur le HP)

```bash
# go2rtc
./go2rtc -config go2rtc.yaml &
# backend
cd backend && pip install -r requirements.txt
GO2RTC_URL=http://127.0.0.1:1984 MONGO_URL=mongodb://localhost:27017 DB_NAME=camerahub \
  uvicorn server:app --host 0.0.0.0 --port 8001
# frontend
cd frontend && yarn install
REACT_APP_BACKEND_URL=http://localhost:8001 yarn start
```

---

## 4. Déploiement Kimsufi (Nginx + TLS)

1. Pointe le DNS `surveillance-video.quentin-astro.fr` vers ton Kimsufi.
2. Copie `nginx-kimsufi.conf` dans `/etc/nginx/sites-available/` et active-le :
   ```bash
   sudo ln -s /etc/nginx/sites-available/surveillance-video.conf /etc/nginx/sites-enabled/
   sudo certbot --nginx -d surveillance-video.quentin-astro.fr
   sudo nginx -t && sudo systemctl reload nginx
   ```
3. Le bloc gère le **WebSocket** sur `/api/ws` (essentiel pour le live MSE).
4. **WebRTC faible latence (optionnel)** : ouvre le port `8555/udp` du firewall, mets l'IP
   publique dans `webrtc.candidates` de `go2rtc.yaml`, et règle le lecteur sur
   `webrtc,mse` dans **Réglages**.

### Accès aux caméras locales depuis le Kimsufi
Tes caméras sont sur ton LAN (derrière la Freebox). Deux options :
- **WireGuard** (Freebox Révolution : VPN serveur WireGuard) → le Kimsufi (client WG) atteint
  `192.168.x.x:554`. Mets les `rtsp_url` en IP LAN dans le hub.
- Ou héberge le hub **sur le HP/un mini-PC du LAN** et n'expose que l'UI via le Kimsufi (reverse proxy WG).

---

## 5. Activer le Mode Cloud SmartLife (Tuya)

Pour les 5–7 caméras **non flashées** (toujours sur SmartLife) :

1. Va sur **https://iot.tuya.com** → connecte-toi → **Cloud → Development → Create Cloud Project**.
   - Data center : **Central Europe / Western Europe** (selon ton compte SmartLife).
2. Récupère **Access ID** et **Access Secret** (Project → Authorization Key).
3. **Cloud → Devices → Link App Account → Add App Account** → scanne le **QR code** depuis
   l'app **SmartLife** (Moi → … → scanner). Note l'**UID** du compte lié.
4. Active les API : *IoT Core*, *Smart Home Basic Service*, *Device Status Notification*, et
   *IPC* (caméras) si disponible.
5. Dans le hub : **Réglages → Mode Cloud SmartLife** → active, saisis Access ID / Secret /
   Région / App UID → **Tester la connexion** → **Enregistrer**.

> ⚠️ La région du projet **doit** correspondre à celle du compte SmartLife, sinon la liste
> d'appareils revient vide.

---

## 6. Ajouter tes caméras

**Réglages d'une caméra** (bouton « + Caméra ») :
- **Local / Dual** : `rtsp_url = rtsp://192.168.0.61:554/main_ch`, type *Rotative* pour les 2 PTZ.
- **PTZ** : protocole `CGI`, port `8080`, user `admin` (motor.cgi du toolkit).
- **Cloud** : renseigne le *Tuya Device ID*.

Le backend synchronise automatiquement le flux dans go2rtc à chaque ajout/modif.

---

## 7. Notes

- Les flux `demo_*` de `go2rtc.example.yaml` sont des **mires de test** ; supprime-les en prod.
- Enregistrements / instantanés stockés dans `RECORDINGS_DIR` (défaut `/data/recordings`).
- La détection de mouvement avancée (zones, déclenchement go2rtc/ffmpeg `record`) est prévue
  en évolution ; le hub gère déjà les évènements + clips manuels.
