import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { motionSnapshotUrl, recordingThumbUrl } from "@/lib/api";
import {
  Pencil,
  Trash2,
  Rotate3d,
  RadioTower,
  Cloud,
  Plus,
  Zap,
  Check,
  Film,
  Activity,
  Server,
  Info,
} from "lucide-react";

function CameraRow({ cam, onOpen, onEdit, onDelete }) {
  return (
    <div
      data-testid={`sidebar-camera-${cam.id}`}
      className="group flex items-center gap-2 px-2 py-2 border border-transparent hover:border-[#222731] hover:bg-[#12151A] rounded-sm cursor-pointer transition-colors"
      onClick={() => onOpen(cam)}
    >
      <span
        className={`h-2 w-2 rounded-full flex-shrink-0 ${
          cam.live ? "bg-status-rtsp" : "bg-status-offline/60"
        }`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-white truncate">{cam.name}</span>
          {cam.type === "rotatable" && <Rotate3d className="h-3 w-3 text-white/40 flex-shrink-0" />}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-white/40">
          {cam.mode === "cloud" ? (
            <Cloud className="h-2.5 w-2.5 text-status-cloud" />
          ) : (
            <RadioTower className="h-2.5 w-2.5 text-status-rtsp" />
          )}
          <span>{cam.location || cam.stream_name}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          data-testid={`edit-camera-${cam.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onEdit(cam);
          }}
          className="p-1 text-white/50 hover:text-white"
          aria-label="Éditer"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          data-testid={`delete-camera-${cam.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(cam);
          }}
          className="p-1 text-white/50 hover:text-status-offline"
          aria-label="Supprimer"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function Sidebar({
  cameras,
  events,
  recordings,
  status,
  onOpenCamera,
  onEditCamera,
  onDeleteCamera,
  onAddCamera,
  onSimulateMotion,
  onAckMotion,
  onDeleteMotion,
  onDeleteRecording,
  onOpenSettings,
}) {
  return (
    <aside className="w-full md:w-80 flex-shrink-0 border-l border-[#222731] bg-[#12151A] flex flex-col h-full">
      <Tabs defaultValue="cameras" className="flex flex-col h-full">
        <TabsList className="grid grid-cols-3 m-2 bg-[#0A0C10] border border-[#222731] rounded-sm h-9">
          <TabsTrigger value="cameras" data-testid="tab-cameras" className="text-xs data-[state=active]:bg-[#1A1D24]">
            Caméras
          </TabsTrigger>
          <TabsTrigger value="events" data-testid="tab-events" className="text-xs data-[state=active]:bg-[#1A1D24]">
            Évènements
          </TabsTrigger>
          <TabsTrigger value="system" data-testid="tab-system" className="text-xs data-[state=active]:bg-[#1A1D24]">
            Système
          </TabsTrigger>
        </TabsList>

        {/* CAMERAS */}
        <TabsContent value="cameras" className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-2 mt-0 space-y-0.5">
          <button
            data-testid="sidebar-add-camera"
            onClick={onAddCamera}
            className="w-full flex items-center justify-center gap-2 mb-2 py-2 border border-dashed border-[#222731] hover:border-status-cloud text-white/60 hover:text-white text-xs rounded-sm transition-colors"
          >
            <Plus className="h-4 w-4" /> Ajouter une caméra
          </button>
          {cameras.map((cam) => (
            <CameraRow
              key={cam.id}
              cam={cam}
              onOpen={onOpenCamera}
              onEdit={onEditCamera}
              onDelete={onDeleteCamera}
            />
          ))}
        </TabsContent>

        {/* EVENTS */}
        <TabsContent value="events" className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-2 mt-0">
          <button
            data-testid="simulate-motion-button"
            onClick={onSimulateMotion}
            className="w-full flex items-center justify-center gap-2 mb-3 py-2 border border-[#222731] bg-[#1A1D24] hover:border-status-motion text-white/80 text-xs rounded-sm transition-colors"
          >
            <Zap className="h-3.5 w-3.5 text-status-motion" /> Simuler un mouvement
          </button>

          <h3 className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-mono mb-2 px-1">
            Détections de mouvement
          </h3>
          <div className="space-y-1.5">
            {events.length === 0 && (
              <p className="text-xs text-white/30 px-1 py-2">Aucun évènement.</p>
            )}
            {events.map((e) => (
              <div
                key={e.id}
                data-testid={`timeline-event-${e.id}`}
                className="flex gap-2 p-1.5 border-l-2 border-status-motion bg-[#0A0C10] rounded-sm"
              >
                <img
                  src={motionSnapshotUrl(e.id)}
                  alt="motion"
                  className="h-12 w-16 object-cover rounded-sm bg-black flex-shrink-0"
                  onError={(ev) => (ev.currentTarget.style.opacity = "0.12")}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs text-white truncate">{e.camera_name}</span>
                    {e.acknowledged && <Check className="h-3 w-3 text-status-rtsp flex-shrink-0" />}
                  </div>
                  <span className="text-[10px] font-mono text-white/40">
                    {new Date(e.timestamp).toLocaleTimeString("fr-FR")}
                  </span>
                  <div className="h-1 bg-[#222731] rounded-full mt-1 overflow-hidden">
                    <div
                      className="h-full bg-status-motion"
                      style={{ width: `${e.level}%` }}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  {!e.acknowledged && (
                    <button
                      onClick={() => onAckMotion(e)}
                      className="p-0.5 text-white/40 hover:text-status-rtsp"
                      aria-label="Acquitter"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => onDeleteMotion(e)}
                    className="p-0.5 text-white/40 hover:text-status-offline"
                    aria-label="Supprimer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <h3 className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-mono mb-2 mt-4 px-1">
            Enregistrements
          </h3>
          <div className="space-y-1.5">
            {recordings.length === 0 && (
              <p className="text-xs text-white/30 px-1 py-2">Aucun clip enregistré.</p>
            )}
            {recordings.map((r) => (
              <div
                key={r.id}
                data-testid={`recording-${r.id}`}
                className="flex gap-2 p-1.5 border-l-2 border-status-cloud bg-[#0A0C10] rounded-sm"
              >
                {r.has_thumbnail ? (
                  <img
                    src={recordingThumbUrl(r.id)}
                    alt="rec"
                    className="h-12 w-16 object-cover rounded-sm bg-black flex-shrink-0"
                    onError={(ev) => (ev.currentTarget.style.opacity = "0.12")}
                  />
                ) : (
                  <div className="h-12 w-16 flex items-center justify-center bg-black rounded-sm flex-shrink-0">
                    <Film className="h-4 w-4 text-white/30" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <span className="text-xs text-white truncate block">{r.camera_name}</span>
                  <span className="text-[10px] font-mono text-white/40">
                    {new Date(r.started_at).toLocaleString("fr-FR")} · {r.duration}s
                  </span>
                </div>
                <button
                  onClick={() => onDeleteRecording(r)}
                  className="p-0.5 text-white/40 hover:text-status-offline self-center"
                  aria-label="Supprimer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* SYSTEM */}
        <TabsContent value="system" className="flex-1 overflow-y-auto custom-scrollbar px-3 pb-3 mt-0 space-y-4">
          <div className="border border-[#222731] bg-[#0A0C10] rounded-sm p-3 space-y-2">
            <div className="flex items-center gap-2 text-white/70">
              <Server className="h-4 w-4 text-status-cloud" />
              <span className="text-xs uppercase tracking-wider font-mono">Moteur de flux</span>
            </div>
            <dl className="text-xs font-mono space-y-1 text-white/60">
              <div className="flex justify-between">
                <dt>go2rtc</dt>
                <dd className={status?.go2rtc?.online ? "text-status-rtsp" : "text-status-offline"}>
                  {status?.go2rtc?.online ? "EN LIGNE" : "HORS LIGNE"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>version</dt>
                <dd>{status?.go2rtc?.version || "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt>flux actifs</dt>
                <dd>{status?.go2rtc?.streams?.length ?? 0}</dd>
              </div>
            </dl>
          </div>

          <div className="border border-[#222731] bg-[#0A0C10] rounded-sm p-3 space-y-2">
            <div className="flex items-center gap-2 text-white/70">
              <Activity className="h-4 w-4 text-status-rtsp" />
              <span className="text-xs uppercase tracking-wider font-mono">Caméras</span>
            </div>
            <dl className="text-xs font-mono space-y-1 text-white/60">
              <div className="flex justify-between"><dt>total</dt><dd>{status?.cameras?.total ?? 0}</dd></div>
              <div className="flex justify-between"><dt>en ligne</dt><dd className="text-status-rtsp">{status?.cameras?.live ?? 0}</dd></div>
              <div className="flex justify-between"><dt>hors ligne</dt><dd className="text-white/40">{status?.cameras?.offline ?? 0}</dd></div>
            </dl>
          </div>

          <div className="border border-[#222731] bg-[#0A0C10] rounded-sm p-3 space-y-2">
            <div className="flex items-center gap-2 text-white/70">
              <Cloud className="h-4 w-4 text-status-cloud" />
              <span className="text-xs uppercase tracking-wider font-mono">Cloud SmartLife</span>
            </div>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-white/60">Tuya Cloud</span>
              <span className={status?.tuya_cloud?.enabled ? "text-status-rtsp" : "text-white/40"}>
                {status?.tuya_cloud?.enabled ? "ACTIVÉ" : "DÉSACTIVÉ"}
              </span>
            </div>
            <button
              data-testid="open-settings-from-system"
              onClick={onOpenSettings}
              className="w-full mt-1 py-1.5 border border-[#222731] hover:border-status-cloud text-white/70 hover:text-white text-xs rounded-sm transition-colors"
            >
              Configurer le Mode Cloud
            </button>
          </div>

          <div className="flex gap-2 text-[11px] text-white/40 leading-relaxed px-1">
            <Info className="h-4 w-4 flex-shrink-0 text-white/30 mt-0.5" />
            <p>
              Aperçu cloud Emergent : les flux <span className="text-white/60">demo_*</span> sont
              synthétiques (ffmpeg). En auto-hébergement (HP / Kimsufi), pointez chaque caméra sur son
              RTSP local et activez WebRTC.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </aside>
  );
}
