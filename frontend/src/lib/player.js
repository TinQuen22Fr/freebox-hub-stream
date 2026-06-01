import { VideoRTC } from "@/vendor/video-rtc.js";

const TAG = "video-stream-rtc";
let defined = false;

export function ensurePlayerDefined() {
  if (defined || customElements.get(TAG)) {
    defined = true;
    return;
  }
  // eslint-disable-next-line no-undef
  customElements.define(TAG, class extends VideoRTC {});
  defined = true;
}

export const PLAYER_TAG = TAG;
