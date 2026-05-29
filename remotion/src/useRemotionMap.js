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
export function useRemotionMap({ mapboxToken = '', port = 3002 } = {}) {
  const mapContainer = useRef(null);
  const mapRef       = useRef(null);
  const markerRef    = useRef(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!mapContainer.current) return;

    // Pause Remotion rendering until the map loads.
    const initHandle = delayRender('map init');
    let cancelled = false;

    // Fetch style from Express server (port=3002) so it's reliably accessible.
    // Remotion's webpack server (port=3003) does not serve publicDir files.
    const styleBaseUrl = `http://localhost:${port}`;
    createMap(mapContainer.current, { isDark: true, broadcast: true, mapboxToken: mapboxToken || undefined, styleBaseUrl }).then(({ map, marker }) => {
      if (cancelled) { map.remove(); return; }
      mapRef.current    = map;
      markerRef.current = marker;
      map.on('error', (e) => console.error('[useRemotionMap] map error:', e.error?.message ?? e));

      const onStyleReady = () => {
        if (cancelled) return;
        setMapReady(true);
        continueRender(initHandle);
      };

      // isStyleLoaded() guards against the race where style.load fires between
      // createMap() resolving and our once() listener being registered.
      if (map.isStyleLoaded()) {
        onStyleReady();
      } else {
        map.once('style.load', onStyleReady);
      }
    }).catch(err => {
      console.error('[useRemotionMap] createMap catch:', err?.message ?? err);
      continueRender(initHandle);  // unblock even on error
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current    = null;
      markerRef.current = null;
    };
  }, []);

  return { mapContainer, mapRef, markerRef, mapReady };
}
