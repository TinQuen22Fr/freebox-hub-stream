import { useEffect, useRef, useState } from "react";
import { ensurePlayerDefined } from "@/lib/player";
import { wsUrl, snapshotUrl } from "@/lib/api";

/**
 * Wraps the go2rtc <video-rtc.js> web component.
 *
 * Live video uses MSE/WebRTC (H.264). Behind that we keep a server-rendered JPEG
 * snapshot poster that refreshes until the <video> paints a real frame. This makes
 * the tile show real imagery even in environments whose browser cannot decode
 * H.264 (e.g. headless Chromium), while real browsers show the smooth live stream.
 */
export default function VideoPlayer({
  streamName,
  snapshotId,
  mode = "mse",
  controls = false,
  muted = true,
}) {
  const ref = useRef(null);
  const [painting, setPainting] = useState(false);
  const [snapTick, setSnapTick] = useState(0);

  useEffect(() => {
    ensurePlayerDefined();
    const el = ref.current;
    if (!el || !streamName) return;

    el.background = false;
    el.mode = mode;
    el.src = wsUrl(streamName);

    const apply = () => {
      if (el.video) {
        el.video.controls = controls;
        el.video.muted = muted;
        el.video.setAttribute("playsinline", "");
        el.video.style.objectFit = "cover";
      }
    };
    apply();
    const t = setTimeout(apply, 250);

    return () => {
      clearTimeout(t);
      const node = el;
      setTimeout(() => {
        if (!node.isConnected) {
          try {
            node.ondisconnect();
          } catch (e) {
            /* noop */
          }
        }
      }, 0);
    };
  }, [streamName, mode, controls, muted]);

  // Detect real frames; refresh snapshot poster until then.
  useEffect(() => {
    if (painting || !snapshotId) return;
    const id = setInterval(() => {
      const v = ref.current?.video;
      if (v && v.videoWidth > 0) {
        setPainting(true);
      } else {
        setSnapTick((n) => n + 1);
      }
    }, 2500);
    return () => clearInterval(id);
  }, [painting, snapshotId]);

  return (
    <div className="tile-player relative w-full h-full bg-black">
      {/* eslint-disable-next-line react/no-unknown-property */}
      <video-stream-rtc
        ref={ref}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
      />
      {!painting && snapshotId && (
        <img
          src={`${snapshotUrl(snapshotId)}?t=${snapTick}`}
          alt=""
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          draggable={false}
          onError={(e) => {
            e.currentTarget.style.opacity = "0";
          }}
          onLoad={(e) => {
            e.currentTarget.style.opacity = "1";
          }}
        />
      )}
    </div>
  );
}
