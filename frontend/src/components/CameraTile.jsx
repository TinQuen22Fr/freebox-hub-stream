import { Maximize2, Rotate3d, RadioTower, Cloud, Video } from "lucide-react";
import VideoPlayer from "./VideoPlayer";
import { placeholderFor } from "@/constants/cameraAssets";

function ModeBadge({ mode }) {
  const base =
    "flex items-center gap-1 px-1.5 py-0.5 bg-black/75 backdrop-blur-sm border text-[10px] font-mono uppercase tracking-wider rounded-sm";
  if (mode === "local")
    return (
      <span className={`${base} border-status-rtsp/40 text-status-rtsp`}>
        <RadioTower className="h-3 w-3" /> RTSP
      </span>
    );
  if (mode === "cloud")
    return (
      <span className={`${base} border-status-cloud/40 text-status-cloud`}>
        <Cloud className="h-3 w-3" /> SmartLife
      </span>
    );
  return (
    <span className={`${base} border-white/20 text-white/80`}>
      <RadioTower className="h-3 w-3 text-status-rtsp" />
      <Cloud className="h-3 w-3 text-status-cloud" /> Dual
    </span>
  );
}

export default function CameraTile({ camera, index, now, onOpen, playerMode }) {
  const time = now
    ? now.toLocaleTimeString("fr-FR", { hour12: false })
    : "--:--:--";

  return (
    <div
      data-testid={`camera-feed-${camera.id}`}
      onClick={() => onOpen(camera)}
      className="relative aspect-video bg-[#0A0C10] border border-[#222731] overflow-hidden group rounded-sm cursor-pointer hover:border-white/30 transition-colors duration-150"
    >
      {camera.live ? (
        <VideoPlayer streamName={camera.stream_name} snapshotId={camera.id} mode={playerMode} />
      ) : (
        <div className="absolute inset-0">
          <img
            src={placeholderFor(index)}
            alt={camera.name}
            className="w-full h-full object-cover opacity-20 grayscale"
            draggable={false}
          />
          <div className="absolute inset-0 grain opacity-30" />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
            <Video className="h-6 w-6 text-white/30" />
            <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-white/40">
              {camera.mode === "cloud" ? "Cloud — en veille" : "Hors ligne"}
            </span>
          </div>
        </div>
      )}

      {/* Top gradient + meta */}
      <div className="absolute top-0 inset-x-0 h-14 bg-gradient-to-b from-black/80 to-transparent pointer-events-none" />
      <div className="absolute top-2 left-2 right-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={`h-2 w-2 rounded-full flex-shrink-0 ${
              camera.live ? "bg-status-rtsp shadow-[0_0_6px] shadow-status-rtsp" : "bg-status-offline/70"
            }`}
          />
          <span className="font-heading font-bold text-sm text-white truncate drop-shadow">
            {camera.name}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {camera.type === "rotatable" && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 bg-black/75 border border-white/15 text-[10px] font-mono uppercase tracking-wider rounded-sm text-white/70">
              <Rotate3d className="h-3 w-3" /> PTZ
            </span>
          )}
          <ModeBadge mode={camera.mode} />
        </div>
      </div>

      {/* Bottom gradient + meta */}
      <div className="absolute bottom-0 inset-x-0 h-12 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
      <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {camera.live && (
            <span className="flex items-center gap-1 text-[10px] font-mono font-semibold text-status-offline">
              <span className="h-1.5 w-1.5 rounded-full bg-status-offline animate-pulse-rec" />
              LIVE
            </span>
          )}
          <span className="text-[11px] font-mono text-white/60 truncate">
            {time}
            {camera.location ? ` · ${camera.location}` : ""}
          </span>
        </div>
        <button
          data-testid={`camera-expand-${camera.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onOpen(camera);
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 p-1.5 bg-black/70 border border-white/15 rounded-sm hover:border-white/40 text-white/80"
          aria-label="Plein écran"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
