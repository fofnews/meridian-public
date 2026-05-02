// Pulse marker DOM element used by the Mapbox marker. Shared by all
// map surfaces (website + video) so they look identical.
//
// Item 5: three radar rings on staggered delays give a sweeping
// sonar/radar look rather than a single pulse. Ring sizes and delays
// chosen so the outermost ring is just fading out as the innermost
// fires, keeping the animation continuous.

const RING_DELAYS = ['0s', '0.6s', '1.2s'];

export function createPulseMarker(isDark) {
  const dotColor = isDark ? '#e8c547' : '#9A7200';

  const wrapper = document.createElement('div');
  // Hidden by default — flyToLocation reveals it, returnToAmbient
  // hides it again. Without this the marker would pulse over [0, 20]
  // (somewhere in the Atlantic) at page load and over the previously
  // focused location after the idle return.
  wrapper.style.cssText = 'position: relative; width: 10px; height: 10px; display: none;';

  RING_DELAYS.forEach((delay, i) => {
    const ring = document.createElement('div');
    ring.className = isDark ? 'marker-ring' : 'marker-ring marker-ring--light';
    ring.dataset.ringIndex = i;
    ring.style.cssText = `
      position: absolute;
      width: 10px; height: 10px;
      border-radius: 50%;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
      animation-delay: ${delay};
    `;
    wrapper.appendChild(ring);
  });

  const dot = document.createElement('div');
  dot.className = isDark ? 'dot-pulse' : 'dot-pulse-light';
  dot.style.cssText = `width: 10px; height: 10px; border-radius: 50%; background: ${dotColor};`;

  wrapper.appendChild(dot);
  return wrapper;
}

export function updatePulseMarkerTheme(el, isDark) {
  const dotColor = isDark ? '#e8c547' : '#9A7200';
  const dot = el.querySelector('.dot-pulse, .dot-pulse-light');
  if (dot) {
    dot.style.background = dotColor;
    dot.className = isDark ? 'dot-pulse' : 'dot-pulse-light';
  }
  el.querySelectorAll('[data-ring-index]').forEach(ring => {
    ring.className = isDark ? 'marker-ring' : 'marker-ring marker-ring--light';
  });
}
