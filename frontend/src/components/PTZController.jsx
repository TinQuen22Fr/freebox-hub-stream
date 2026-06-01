import { useState } from "react";
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Crosshair,
} from "lucide-react";

const KEY =
  "flex items-center justify-center bg-[#1A1D24] border border-[#222731] text-white/80 " +
  "hover:bg-[#222731] hover:border-white/30 hover:text-white transition-colors duration-150 " +
  "active:scale-95 active:border-status-cloud rounded-md shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] " +
  "disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-status-cloud";

function PadButton({ action, dir, onMove, disabled, icon: Icon, testid }) {
  const press = () => onMove(action);
  const release = () => onMove("stop");
  return (
    <button
      data-testid={testid}
      aria-label={action}
      disabled={disabled}
      className={`${KEY} h-12 w-12`}
      onPointerDown={press}
      onPointerUp={release}
      onPointerLeave={release}
      onClick={(e) => e.preventDefault()}
    >
      <Icon className="h-5 w-5" strokeWidth={2.5} />
    </button>
  );
}

export default function PTZController({ onMove, disabled = false }) {
  const [dist, setDist] = useState(10);

  const move = (action) => {
    if (disabled) return;
    onMove(action, dist);
  };

  return (
    <div className="space-y-4" data-testid="ptz-controller">
      <div className="grid grid-cols-3 gap-2 w-fit mx-auto">
        <div />
        <PadButton action="up" onMove={move} disabled={disabled} icon={ChevronUp} testid="ptz-control-up" />
        <div />
        <PadButton action="left" onMove={move} disabled={disabled} icon={ChevronLeft} testid="ptz-control-left" />
        <button
          data-testid="ptz-control-home"
          aria-label="home"
          disabled={disabled}
          onClick={() => move("home")}
          className={`${KEY} h-12 w-12`}
        >
          <Crosshair className="h-5 w-5" strokeWidth={2.5} />
        </button>
        <PadButton action="right" onMove={move} disabled={disabled} icon={ChevronRight} testid="ptz-control-right" />
        <div />
        <PadButton action="down" onMove={move} disabled={disabled} icon={ChevronDown} testid="ptz-control-down" />
        <div />
      </div>

      <div className="px-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-mono">
            Amplitude
          </span>
          <span className="text-xs font-mono text-white/70">{dist}</span>
        </div>
        <input
          data-testid="ptz-distance-slider"
          type="range"
          min="1"
          max="50"
          value={dist}
          disabled={disabled}
          onChange={(e) => setDist(Number(e.target.value))}
          className="w-full accent-status-cloud cursor-pointer"
        />
      </div>
    </div>
  );
}
