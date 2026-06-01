import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import CameraTile from "@/components/CameraTile";
import FullscreenModal from "@/components/FullscreenModal";
import CameraFormDialog from "@/components/CameraFormDialog";
import SettingsDialog from "@/components/SettingsDialog";
import { api } from "@/lib/api";

export default function Dashboard() {
  const [cameras, setCameras] = useState([]);
  const [events, setEvents] = useState([]);
  const [recordings, setRecordings] = useState([]);
  const [status, setStatus] = useState(null);
  const [settings, setSettings] = useState(null);
  const [now, setNow] = useState(new Date());

  const [openCam, setOpenCam] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editCam, setEditCam] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const playerMode = settings?.player_mode || "mse";

  const loadCameras = useCallback(async () => {
    try {
      setCameras(await api.listCameras());
    } catch (e) {
      /* noop */
    }
  }, []);
  const loadEvents = useCallback(async () => setEvents(await api.listMotion()), []);
  const loadRecordings = useCallback(async () => setRecordings(await api.listRecordings()), []);
  const loadStatus = useCallback(async () => setStatus(await api.systemStatus()), []);
  const loadSettings = useCallback(async () => setSettings(await api.getSettings()), []);

  useEffect(() => {
    loadCameras();
    loadEvents();
    loadRecordings();
    loadStatus();
    loadSettings();
  }, [loadCameras, loadEvents, loadRecordings, loadStatus, loadSettings]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(loadStatus, 10000);
    return () => clearInterval(t);
  }, [loadStatus]);

  // --- handlers --- //
  const addCamera = () => {
    setEditCam(null);
    setFormOpen(true);
  };
  const editCamera = (cam) => {
    setEditCam(cam);
    setFormOpen(true);
  };
  const deleteCamera = async (cam) => {
    if (!window.confirm(`Supprimer « ${cam.name} » ?`)) return;
    await api.deleteCamera(cam.id);
    toast.success("Caméra supprimée");
    loadCameras();
    loadStatus();
  };
  const onMove = async (cam, action, dist) => {
    try {
      await api.ptz(cam.id, action, dist);
      if (action !== "stop") toast.message(`PTZ · ${cam.name}`, { description: action });
    } catch (e) {
      if (action !== "stop") toast.error(e?.response?.data?.detail || "Échec PTZ");
    }
  };
  const onRecord = async (cam) => {
    try {
      await api.createRecording(cam.id);
      toast.success(`Clip enregistré · ${cam.name}`);
      loadRecordings();
    } catch (e) {
      toast.error("Échec de l'enregistrement");
    }
  };
  const simulateMotion = async () => {
    try {
      const ev = await api.simulateMotion();
      toast.message("Mouvement détecté", { description: ev.camera_name });
      loadEvents();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Aucune caméra en ligne");
    }
  };
  const ackMotion = async (e) => {
    await api.ackMotion(e.id);
    loadEvents();
  };
  const deleteMotion = async (e) => {
    await api.deleteMotion(e.id);
    loadEvents();
  };
  const deleteRecording = async (r) => {
    await api.deleteRecording(r.id);
    loadRecordings();
  };

  return (
    <div className="h-screen flex flex-col bg-[#0A0C10] overflow-hidden">
      <Header
        status={status}
        onAddCamera={addCamera}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div className="flex flex-1 min-h-0 flex-col md:flex-row">
        <main
          data-testid="camera-grid"
          className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 p-2 auto-rows-min content-start overflow-y-auto custom-scrollbar"
        >
          {cameras.map((cam, i) => (
            <CameraTile
              key={cam.id}
              camera={cam}
              index={i}
              now={now}
              onOpen={setOpenCam}
              playerMode={playerMode}
            />
          ))}
          {cameras.length === 0 && (
            <div className="col-span-full flex items-center justify-center h-64 text-white/30 text-sm font-mono">
              Aucune caméra. Cliquez sur « + Caméra ».
            </div>
          )}
        </main>

        <Sidebar
          cameras={cameras}
          events={events}
          recordings={recordings}
          status={status}
          onOpenCamera={setOpenCam}
          onEditCamera={editCamera}
          onDeleteCamera={deleteCamera}
          onAddCamera={addCamera}
          onSimulateMotion={simulateMotion}
          onAckMotion={ackMotion}
          onDeleteMotion={deleteMotion}
          onDeleteRecording={deleteRecording}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      </div>

      <FullscreenModal
        camera={openCam}
        open={!!openCam}
        onClose={() => setOpenCam(null)}
        onMove={onMove}
        onRecord={onRecord}
        events={events}
        playerMode={playerMode}
      />
      <CameraFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        camera={editCam}
        onSaved={() => {
          loadCameras();
          loadStatus();
        }}
      />
      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSaved={loadSettings}
      />
    </div>
  );
}
