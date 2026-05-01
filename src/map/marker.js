// Pulse marker DOM element used by the Mapbox marker. Shared by all
// map surfaces (website + video) so they look identical.

export function createPulseMarker(isDark) {
  const dotColor = isDark ? '#e8c547' : '#9A7200';
  const ringColor = isDark ? 'rgba(232,197,71,0.45)' : 'rgba(154,114,0,0.45)';

  const wrapper = document.createElement('div');
  // Hidden by default — flyToLocation reveals it, returnToAmbient
  // hides it again. Without this the marker would pulse over [0, 20]
  // (somewhere in the Atlantic) at page load and over the previously
  // focused location after the idle return.
  wrapper.style.cssText = 'position: relative; width: 10px; height: 10px; display: none;';

  const ring = document.createElement('div');
  ring.className = 'marker-ring';
  ring.style.cssText = `
    position: absolute;
    width: 28px; height: 28px;
    border-radius: 50%;
    border: 1px solid ${ringColor};
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
  `;

  const dot = document.createElement('div');
  dot.className = isDark ? 'dot-pulse' : 'dot-pulse-light';
  dot.style.cssText = `width: 10px; height: 10px; border-radius: 50%; background: ${dotColor};`;

  wrapper.appendChild(ring);
  wrapper.appendChild(dot);
  return wrapper;
}

export function updatePulseMarkerTheme(el, isDark) {
  const dotColor = isDark ? '#e8c547' : '#9A7200';
  const ringColor = isDark ? 'rgba(232,197,71,0.45)' : 'rgba(154,114,0,0.45)';
  const dot = el.querySelector('.dot-pulse, .dot-pulse-light');
  const ring = el.querySelector('.marker-ring');
  if (dot) {
    dot.style.background = dotColor;
    dot.className = isDark ? 'dot-pulse' : 'dot-pulse-light';
  }
  if (ring) ring.style.borderColor = ringColor;
}
