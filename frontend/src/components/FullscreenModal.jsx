import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import VideoPlayer from "./VideoPlayer";
import PTZController from "./PTZController";
import { placeholderFor } from "@/constants/cameraAssets";
import { motionSnapshotUrl } from "@/lib/api";
import { Rotate3d, RadioTower, Cloud, Video, CircleDot } from "lucide-react";

function Badge({ children, color }) {
  return (
    <span
      className="flex items-center gap-1 px-2 py-0.5 bg-black/60 border text-[10px] font-mono uppercase tracking-wider rounded-sm"
      style={{ borderColor: `${color}55`, color }}
    >
      {children}
    </span>
  );
}

export default function FullscreenModal({
  camera,
  open,
  onClose,
  onMove,
  onRecord,
  events = [],
  playerMode = "mse",
}) {
  if (!camera) return null;
  const isRot = camera.type === "rotatable";
  const camEvents = events.filter((e) => e.camera_id === camera.id).slice(0, 6);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        data-testid="fullscreen-modal"
        className="max-w-6xl w-[96vw] p-0 gap-0 bg-[#0A0C10] border-[#222731] rounded-sm overflow-hidden"
      >
        <DialogTitle className="sr-only">{camera.name}</DialogTitle>

        <div className="flex items-center justify-between px-4 h-12 border-b border-[#222731]">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`h-2 w-2 rounded-full ${
                camera.live ? "bg-status-rtsp" : "bg-status-offline/70"
              }`}
            />
            <span className="font-heading font-bold text-white truncate">{camera.name}</span>
            <span className="text-xs font-mono text-white/40">{camera.location}</span>
          </div>
          <div className="flex items-center gap-1.5 pr-8">
            {isRot && (
              <Badge color="#ffffff">
                <Rotate3d className="h-3 w-3" /> PTZ
              </Badge>
            )}
            {camera.mode === "local" && (
              <Badge color="#10B981">
                <RadioTower className="h-3 w-3" /> RTSP
              </Badge>
            )}
            {camera.mode === "cloud" && (
              <Badge color="#3B82F6">
                <Cloud className="h-3 w-3" /> SmartLife
              </Badge>
            )}
            {camera.mode === "hybrid" && (
              <Badge color="#ffffff">
                <RadioTower className="h-3 w-3" /> Dual
              </Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3">
          <div className="lg:col-span-2 bg-black aspect-video relative">
            {camera.live ? (
              <VideoPlayer streamName={camera.stream_name} snapshotId={camera.id} mode={playerMode} controls muted={false} />
            ) : (
              <div className="absolute inset-0">
                <img
                  src={placeholderFor(camera.order || 0)}
                  alt={camera.name}
                  className="w-full h-full object-cover opacity-20 grayscale"
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <Video className="h-8 w-8 text-white/30" />
                  <span className="text-xs font-mono uppercase tracking-[0.2em] text-white/40">
                    {camera.mode === "cloud"
                      ? "Mode Cloud — configurer Tuya dans Réglages"
                      : "Flux hors ligne"}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="bg-[#0A0C10] border-l border-[#222731] p-4 space-y-5 max-h-[70vh] overflow-y-auto custom-scrollbar">
            {isRot && (
              <div>
                <h3 className="text-xs uppercase tracking-[0.2em] text-white/50 font-mono mb-3">
                  Contrôle PTZ
                </h3>
                <PTZController onMove={(a, d) => onMove(camera, a, d)} disabled={false} />
              </div>
            )}

            <div>
              <h3 className="text-xs uppercase tracking-[0.2em] text-white/50 font-mono mb-2">
                Actions
              </h3>
              <button
                data-testid="record-button"
                onClick={() => onRecord(camera)}
                className="w-full flex items-center justify-center gap-2 bg-[#1A1D24] hover:bg-status-offline/20 border border-[#222731] hover:border-status-offline text-white/90 text-sm py-2 rounded-md transition-colors"
              >
                <CircleDot className="h-4 w-4 text-status-offline" /> Enregistrer un clip
              </button>
            </div>

            <div>
              <h3 className="text-xs uppercase tracking-[0.2em] text-white/50 font-mono mb-2">
                Détails
              </h3>
              <dl className="text-xs font-mono space-y-1 text-white/70">
                <div className="flex justify-between gap-2">
                  <dt className="text-white/40">flux</dt>
                  <dd className="truncate">{camera.stream_name}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-white/40">ip</dt>
                  <dd>{camera.ip || "—"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-white/40">type</dt>
                  <dd>{camera.type}</dd>
                </div>
              </dl>
            </div>

            {camEvents.length > 0 && (
              <div>
                <h3 className="text-xs uppercase tracking-[0.2em] text-white/50 font-mono mb-2">
                  Mouvements récents
                </h3>
                <div className="grid grid-cols-3 gap-1.5">
                  {camEvents.map((e) => (
                    <img
                      key={e.id}
                      src={motionSnapshotUrl(e.id)}
                      alt="motion"
                      className="aspect-video object-cover rounded-sm border border-[#222731]"
                      onError={(ev) => (ev.currentTarget.style.opacity = "0.15")}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
