// remotion/src/useRemotionMap.js
import { useEffect, useRef, useState } from 'react';
import { delayRender, continueRender } from 'remotion';
import { createMap } from '../../src/map/kernel.js';

/**
 * Initialised Mapbox map for headless Remotion rendering.
 * Returns { mapContainer, mapRef, mapReady }.
 *
 * On mount: creates the map and calls continueRender once it loads.
 * Callers drive the camera via mapRef.current.jumpTo() each frame,
 * wrapped in a delayRender/continueRender pair around map.once('idle').
 */
export function useRemotionMap() {
  const mapContainer = useRef(null);
  const mapRef       = useRef(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!mapContainer.current) return;

    // Pause Remotion rendering until the map loads.
    const initHandle = delayRender('map init');
    let cancelled = false;

    createMap(mapContainer.current, { isDark: true, broadcast: true }).then(({ map }) => {
      if (cancelled) { map.remove(); return; }
      mapRef.current = map;
      setMapReady(true);
      continueRender(initHandle);
    }).catch(err => {
      console.error('[useRemotionMap] Mapbox failed to load:', err);
      continueRender(initHandle);  // unblock even on error
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return { mapContainer, mapRef, mapReady };
}
