// Shared map orchestration hook. Both MapHero (website) and
// BroadcastStage (video) consume this so the map setup, ambient mode,
// theme switching, and focus / idle-return logic live in one place.
//
// Returns:
//   mapContainer  — ref to attach to a <div>
//   mapRef        — ref to the Mapbox map (for zoom controls, etc.)
//   flyToLocation — focus-aware fly: pauses ambient rotation, applies
//                   pitch, arms idle timer that returns to ambient
//   enterAmbient  — manual return to globe (rarely needed by caller;
//                   the idle timer will fire it automatically)

import { useEffect, useRef, useCallback } from 'react';
import { createMap } from './kernel.js';
import { applyMapStyle, updateArcs as kernelUpdateArcs, clearArcs, setHighlightPalette } from './layers.js';
import { computeNightPolygon } from './terminator.js';
import { updatePulseMarkerTheme } from './marker.js';
import {
  getMapPadding,
  getMapPaddingBroadcast,
  flyToLocation as kernelFlyTo,
  cinematicFlyTo,
  returnToAmbient,
  startAmbientRotation,
  AMBIENT_IDLE_TIMEOUT_MS,
} from './camera.js';

export function useMeridianMap({ mapEnabled, isDark, focusPitch, cinematic = false, broadcast = false }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const styleLoadCallbackRef = useRef(null);
  const pendingIsDarkRef = useRef(isDark);
  // If a fly-to is requested before the map finishes loading, we stash
  // the target here so the init effect can apply it once ready.
  const pendingFlyRef = useRef(null);
  const currentPolygonRef = useRef(null);
  // Ambient mode (item 0b): the globe rotates slowly until a story is
  // focused; an idle timer flips it back to the wide view 30s after the
  // last focus.
  const rotationRef = useRef(null);
  const idleTimerRef = useRef(null);
  // Cancel function returned by cinematicFlyTo — called when a new fly
  // request arrives to abort any pending step-2 timeout.
  const cinematicCancelRef = useRef(null);
  // Cancel function for the arc draw-on animation.
  const arcsCancelRef = useRef(null);
  // ISO code of the currently focused location — becomes trail on next fly.
  const activeIsoRef = useRef('');
  // Capture focusPitch so the fly callback always sees the latest value
  // without needing to be re-created on every prop change.
  const focusPitchRef = useRef(focusPitch);
  focusPitchRef.current = focusPitch;

  // Init map (skipped entirely when disabled). Mapbox is imported lazily
  // by the kernel so users who never enable the map never pay the cost.
  useEffect(() => {
    if (!mapEnabled) {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
      return;
    }

    if (!mapContainer.current || mapRef.current) return;

    let cancelled = false;
    let mapInstance = null;

    createMap(mapContainer.current, { isDark, broadcast }).then(({ map, marker }) => {
      if (cancelled) {
        map.remove();
        return;
      }
      mapInstance = map;
      mapRef.current = map;
      markerRef.current = marker;

      rotationRef.current = startAmbientRotation(map);

      // Drain any fly-to that was requested while we were loading.
      if (pendingFlyRef.current) {
        const loc = pendingFlyRef.current;
        pendingFlyRef.current = null;
        kernelFlyTo(map, marker, loc, { pitch: focusPitchRef.current });
        currentPolygonRef.current = loc.polygon ?? null;
        rotationRef.current?.setActive(false);
      }
    }).catch((err) => {
      console.warn('Mapbox failed to load:', err);
    });

    return () => {
      cancelled = true;
      rotationRef.current?.stop();
      rotationRef.current = null;
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      if (cinematicCancelRef.current) {
        cinematicCancelRef.current();
        cinematicCancelRef.current = null;
      }
      if (arcsCancelRef.current) {
        arcsCancelRef.current();
        arcsCancelRef.current = null;
      }
      if (mapInstance) {
        mapInstance.remove();
      }
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [mapEnabled]);

  // Night-terminator refresh — update the night polygon every 60 s so the
  // shadow visibly creeps across the globe during a long session.
  useEffect(() => {
    const tick = () => {
      const src = mapRef.current?.getSource('night-overlay');
      if (src) src.setData(computeNightPolygon());
    };
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  // ResizeObserver: keep map sized + padding correct as the container changes.
  useEffect(() => {
    if (!mapContainer.current) return;
    const ro = new ResizeObserver(() => {
      if (!mapRef.current) return;
      mapRef.current.resize();
      const padding = broadcast
        ? getMapPaddingBroadcast(mapContainer.current)
        : getMapPadding(mapContainer.current);
      mapRef.current.setPadding(padding);
    });
    ro.observe(mapContainer.current);
    return () => ro.disconnect();
  }, [broadcast]);

  // Theme switch: re-apply style + restore polygon + retint marker.
  useEffect(() => {
    pendingIsDarkRef.current = isDark;

    if (!mapRef.current) return;
    const map = mapRef.current;

    // Cancel any stale style.load listener from a previous rapid toggle.
    if (styleLoadCallbackRef.current) {
      map.off('style.load', styleLoadCallbackRef.current);
      styleLoadCallbackRef.current = null;
    }

    const newStyle = isDark ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11';
    map.setStyle(newStyle);

    const onStyleLoad = () => {
      styleLoadCallbackRef.current = null;
      applyMapStyle(map, pendingIsDarkRef.current);
      if (currentPolygonRef.current && map.getSource('state-boundary')) {
        map.getSource('state-boundary').setData(currentPolygonRef.current);
      }
    };
    styleLoadCallbackRef.current = onStyleLoad;
    map.once('style.load', onStyleLoad);

    if (markerRef.current) {
      updatePulseMarkerTheme(markerRef.current.getElement(), isDark);
    }
  }, [isDark]);

  const enterAmbient = useCallback(() => {
    if (!mapRef.current) return;
    returnToAmbient(mapRef.current, markerRef.current);
    clearArcs(mapRef.current);
    setHighlightPalette(mapRef.current, { secondary: [], trail: '' });
    activeIsoRef.current = '';
    currentPolygonRef.current = null;
    rotationRef.current?.setActive(true);
  }, []);

  const flyToLocation = useCallback((loc) => {
    if (!mapRef.current) {
      pendingFlyRef.current = loc;
      return;
    }

    // Advance trail: current active ISO becomes the ghost.
    const trailIso = activeIsoRef.current;
    activeIsoRef.current = loc.iso ?? '';
    setHighlightPalette(mapRef.current, { secondary: [], trail: trailIso });

    // Cancel any in-flight cinematic step-2 before starting a new move.
    if (cinematicCancelRef.current) {
      cinematicCancelRef.current();
      cinematicCancelRef.current = null;
    }

    if (cinematic) {
      cinematicCancelRef.current = cinematicFlyTo(
        mapRef.current, markerRef.current, loc, { pitch: focusPitchRef.current }
      );
    } else {
      kernelFlyTo(mapRef.current, markerRef.current, loc, { pitch: focusPitchRef.current });
    }
    currentPolygonRef.current = loc.polygon ?? null;

    rotationRef.current?.setActive(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      idleTimerRef.current = null;
      enterAmbient();
    }, AMBIENT_IDLE_TIMEOUT_MS);
  }, [cinematic, enterAmbient]);

  // Set secondary highlight ISOs (other locations in the current story).
  // Trail is managed automatically by flyToLocation.
  const updateHighlights = useCallback((secondaryIsos) => {
    if (!mapRef.current) return;
    setHighlightPalette(mapRef.current, {
      secondary: secondaryIsos,
      trail: activeIsoRef.current === '' ? '' : activeIsoRef.current,
    });
  }, []);

  // Draw source-to-story arcs for the newly focused story. Called by
  // the component after flyToLocation so arcs and camera move together.
  const updateArcs = useCallback((articles, storyLoc) => {
    if (!mapRef.current) return;
    if (arcsCancelRef.current) {
      arcsCancelRef.current();
      arcsCancelRef.current = null;
    }
    arcsCancelRef.current = kernelUpdateArcs(mapRef.current, articles, storyLoc);
  }, []);

  return { mapContainer, mapRef, flyToLocation, enterAmbient, updateArcs, updateHighlights };
}
