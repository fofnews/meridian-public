// Camera utilities — padding, ambient rotation, easing presets.

export function getMapPadding(containerEl) {
  const w = containerEl?.offsetWidth ?? window.innerWidth;
  if (w < 640) return { top: 20, bottom: 80, left: 0, right: 0 };
  if (w < 900) return { top: 30, bottom: 100, left: 0, right: 100 };
  return { top: 40, bottom: 110, left: 0, right: 160 };
}

export const AMBIENT_BEARING_RATE = 0.5;    // degrees per second
export const AMBIENT_IDLE_TIMEOUT_MS = 30_000; // 30s before ambient rotation starts

let animFrameId = null;

export function startAmbientRotation(map) {
  if (animFrameId) return;
  let lastTs = null;
  function step(ts) {
    if (lastTs !== null) {
      const delta = (ts - lastTs) / 1000;
      map.setBearing((map.getBearing() + AMBIENT_BEARING_RATE * delta) % 360);
    }
    lastTs = ts;
    animFrameId = requestAnimationFrame(step);
  }
  animFrameId = requestAnimationFrame(step);
}

export function stopAmbientRotation() {
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
}
