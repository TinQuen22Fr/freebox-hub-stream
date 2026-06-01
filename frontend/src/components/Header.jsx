import { Cctv, Plus, Settings, Activity } from "lucide-react";

export default function Header({ status, onAddCamera, onOpenSettings }) {
  const live = status?.cameras?.live ?? 0;
  const total = status?.cameras?.total ?? 0;
  const g2online = status?.go2rtc?.online;

  return (
    <header className="flex items-center justify-between h-14 px-4 border-b border-[#222731] bg-[#0A0C10] flex-shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-9 w-9 flex items-center justify-center border border-[#222731] bg-[#12151A] rounded-sm">
          <Cctv className="h-5 w-5 text-status-cloud" />
        </div>
        <div className="min-w-0">
          <h1 className="font-heading font-black uppercase tracking-tighter text-white leading-none text-base sm:text-lg">
            Surveillance-Vidéo
          </h1>
          <p className="text-[10px] font-mono text-white/40 truncate">
            camera-hub-personal · surveillance-video.quentin-astro.fr
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 border border-[#222731] bg-[#12151A] rounded-sm">
          <span
            className={`h-2 w-2 rounded-full ${
              g2online ? "bg-status-rtsp animate-pulse-rec" : "bg-status-offline"
            }`}
          />
          <span className="text-[11px] font-mono text-white/70">
            go2rtc {status?.go2rtc?.version || "—"}
          </span>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 border border-[#222731] bg-[#12151A] rounded-sm">
          <Activity className="h-3.5 w-3.5 text-status-cloud" />
          <span className="text-[11px] font-mono text-white/80" data-testid="header-live-count">
            <span className="text-status-rtsp font-semibold">{live}</span>
            <span className="text-white/30">/{total}</span> en ligne
          </span>
        </div>

        <button
          data-testid="add-camera-button"
          onClick={onAddCamera}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-[#0A0C10] text-xs font-semibold uppercase tracking-wide rounded-sm hover:bg-white/85 transition-colors"
        >
          <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Caméra</span>
        </button>

        <button
          data-testid="settings-toggle"
          onClick={onOpenSettings}
          className="p-2 border border-[#222731] bg-[#12151A] rounded-sm text-white/70 hover:text-white hover:border-white/30 transition-colors"
          aria-label="Réglages"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
