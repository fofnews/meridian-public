// Marker factory — creates the pulsing dot marker used to indicate a story location.

function createMarkerElement(isDark) {
  const dotColor = isDark ? '#e8c547' : '#9A7200';
  const ringColor = isDark ? 'rgba(232,197,71,0.45)' : 'rgba(154,114,0,0.45)';

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position: relative; width: 10px; height: 10px;';

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

/**
 * createMarker(mapboxgl, lngLat, isDark)
 *
 * Constructs a Mapbox Marker and returns it along with an updateTheme()
 * method for live theme switching.
 */
export function createMarker(mapboxgl, lngLat, isDark) {
  const marker = new mapboxgl.Marker({ element: createMarkerElement(isDark), anchor: 'center' })
    .setLngLat(lngLat);

  function updateTheme(newIsDark) {
    const dotColor = newIsDark ? '#e8c547' : '#9A7200';
    const ringColor = newIsDark ? 'rgba(232,197,71,0.45)' : 'rgba(154,114,0,0.45)';
    const el = marker.getElement();
    const dot = el.querySelector('.dot-pulse, .dot-pulse-light');
    const ring = el.querySelector('.marker-ring');
    if (dot) {
      dot.style.background = dotColor;
      dot.className = newIsDark ? 'dot-pulse' : 'dot-pulse-light';
    }
    if (ring) ring.style.borderColor = ringColor;
  }

  return { marker, updateTheme };
}
