# PRD — camera-hub-personal

## Problème / Contexte (utilisateur)
Hub de vidéosurveillance personnel pour **8 caméras LSC (Tuya/SmartLife, Action)** :
2 rotatives bi-bandes (LSC Smart Rotatable, PTZ) + 6 fixes (LSC Smart Indoor IP).
Environnement : **Ubuntu Studio 24.04**, Freebox Révolution (WireGuard activable),
Kimsufi OVH Roubaix (Nginx + APIs sqm/storm-monitor existantes), portable HP (SQM-Fork :3000).
Toolkit **tasarren** sur 1 rotative → RTSP local OK (`rtsp://IP:554/main_ch`).
Objectif : gérer les **2 modes** par caméra — **Local (RTSP)** et **Cloud SmartLife (Tuya)**.

## Choix utilisateur (session 1)
- Architecture validée : **go2rtc + FastAPI + React + MongoDB**, auto-hébergée.
- Mode **Local d'abord**, **Mode Cloud Tuya scaffoldé** (guider la création projet Tuya IoT plus tard).
- Vidéo : **RTSP → WebRTC** (le plus robuste) ; MSE en repli (utilisé en preview cloud).
- Sous-domaine cible : **surveillance-video.quentin-astro.fr** (Kimsufi).
- Découverte `hack.conf` : `OFFLINE=0` → dual-mode natif puce Anyka ; `MUTE_FACTORY_PROMPT=0` → prompt sonore.

## Architecture
- **go2rtc** (binaire arm64, supervisor) : ingestion RTSP → WebRTC/MSE/HLS. Flux gérés dynamiquement par le backend (`PUT/DELETE /api/streams`). 3 flux `demo_*` synthétiques (ffmpeg) pour la preview.
- **FastAPI** (`/app/backend`) : registre caméras (Mongo), sync go2rtc, **proxy WebSocket `/api/ws`** (live), PTZ (CGI/Tuya/ONVIF), snapshots, enregistrements, évènements mouvement, réglages, scaffold Tuya Cloud (signature HMAC).
- **React** (`/app/frontend`) : dashboard mosaïque, lecteur (`video-rtc.js` + overlay snapshot JPEG), PTZ, sidebar (Caméras/Évènements/Système), formulaire caméra, réglages. Thème sombre « Control Room » (Chivo / IBM Plex).
- **MongoDB** : cameras, motion_events, recordings, settings.

## Personas
- Utilisateur unique avancé (Linux/réseau) auto-hébergeant sa surveillance domestique.

## Implémenté (Session 1 — Jan 2026) ✅
- Dashboard mosaïque 8 caméras + états (live/offline, local/cloud/dual, rotative).
- Lecteur live (WebRTC/MSE via proxy WS) + **fallback snapshot JPEG** (imagerie réelle même sans décodeur H264).
- Contrôle **PTZ** (D-pad + amplitude) pour rotatives ; CGI motor.cgi + Tuya implémentés, demo simulé.
- CRUD caméras, snapshots, enregistrements (clips + vignettes), évènements de mouvement (simulate/ack/snapshot/delete).
- Réglages (mode lecteur, détection mouvement, URL publique go2rtc) + **Mode Cloud Tuya** (UI + test, scaffold backend).
- **Paquet de déploiement** `/app/deploy` : docker-compose, Dockerfiles, Nginx (Kimsufi + frontend), `go2rtc.example.yaml`, `.env.example`, README (guide hack.conf + Tuya + WireGuard).
- Tests : **23/23 backend** + frontend = 100% (iteration_1.json).

## Limitations connues
- Chromium headless (sandbox/preview) ne décode pas H264 → tuiles affichent l'instantané JPEG (pipeline prouvé via WS). Vidéo fluide dans un vrai navigateur.
- Preview cloud n'atteint pas le LAN → flux réels actifs uniquement en auto-hébergement.
- Mode Cloud Tuya non testé bout-en-bout (nécessite Access ID/Secret/UID utilisateur).

## Backlog priorisé
- **P1** : Brancher les 8 vraies caméras (RTSP local) + WebRTC faible latence sur Kimsufi.
- **P1** : Finaliser Mode Cloud Tuya (allocate stream HLS + import auto des devices) une fois les clés fournies.
- **P2** : Détection de mouvement réelle (zones, déclenchement go2rtc `record`/ffmpeg), notifications.
- **P2** : Enregistrement continu/planifié + lecture des clips (player VOD).
- **P2** : Multi-utilisateur / auth (si exposition publique) — passer par integration_playbook_expert.
- **P3** : Presets PTZ persistés, patrouille, plein écran mosaïque, mode mur d'images.

## Prochaines actions
1. Tester l'auto-hébergement sur le HP (`deploy/docker-compose.yml`) avec 1–2 caméras réelles.
2. Créer le projet Tuya IoT pour activer le Mode Cloud (voir deploy/README §5).
3. Déployer sur Kimsufi (Nginx + certbot) sur surveillance-video.quentin-astro.fr.
