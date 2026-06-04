// remotion/src/Broadcast.jsx
import './broadcast.css';
import { useEffect, useRef } from 'react';
import { useCurrentFrame, useVideoConfig, AbsoluteFill, Audio, Sequence, delayRender, continueRender } from 'remotion';
import { useRemotionMap } from './useRemotionMap.js';
import { interpolateCameraOnPath, getActiveLocation, getActiveWaypoint } from './camera.js';
import { RemotionFilmGrain, Chyron, Ticker, TopBar, MapAttribution, FadeOverlay, DataCallout, SubtitleBar, QuoteCallout } from './overlays.jsx';

const PRE_ROLL_S  = 1;
const POST_ROLL_S = 1;

export async function calculateMetadata({ props }) {
  const { edition, fps = 30, port = 3002 } = props;
  if (!edition) return { durationInFrames: 1, fps, props: { ...props, shotlist: null, timestamps: [] } };
  const res = await fetch(`http://localhost:${port}/out/shotlists/${edition}.json`);
  if (!res.ok) throw new Error(`Shotlist fetch failed: ${res.status} for edition "${edition}"`);
  const shotlist = await res.json();

  // Fetch per-shot timestamps sidecars so SubtitleBar can render word-by-word subtitles.
  const timestamps = await Promise.all(
    shotlist.shots.map(async (_, i) => {
      try {
        const r = await fetch(`http://localhost:${port}/out/audio/${edition}/shot-${i}.timestamps.json`);
        return r.ok ? await r.json() : null;
      } catch { return null; }
    })
  );

  const durationInFrames = Math.ceil((PRE_ROLL_S + shotlist.duration + POST_ROLL_S) * fps);
  return { durationInFrames, fps, props: { ...props, shotlist, timestamps } };
}

// Build GeoJSON for the dashed story-path line connecting a shot's unique locations.
function shotPathGeoJson(shot) {
  if (!shot?.cameraPath?.length) return { type: 'FeatureCollection', features: [] };
  // Deduplicate consecutive same-position waypoints (hold duplicates).
  const unique = [];
  for (const wp of shot.cameraPath) {
    const last = unique[unique.length - 1];
    if (!last || Math.abs(wp.lng - last.lng) > 0.001 || Math.abs(wp.lat - last.lat) > 0.001) {
      unique.push(wp);
    }
  }
  // Globe-level shots and single-location shots need no path line.
  if (unique.length < 2 || (unique[0].zoom ?? 5) <= 2) {
    return { type: 'FeatureCollection', features: [] };
  }
  return {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: unique.map(wp => [wp.lng, wp.lat]) } }],
  };
}

export function Broadcast({ edition, aspect = '16:9', port = 3002, shotlist, fps: propFps = 30, mapboxToken = '', timestamps = [] }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;

  const { mapContainer, mapRef, markerRef, mapReady } = useRemotionMap({ mapboxToken, port });
  // Track active shot index so story-path source is only updated on shot changes.
  const activeShotIdxRef = useRef(-1);
  // Track active waypoint so highlight polygon is only swapped on waypoint changes.
  const activeWaypointKeyRef = useRef(null);

  // Per-frame camera update: jumpTo computed position, delay Remotion
  // until Mapbox reports idle (all tiles rendered for this position).

  useEffect(() => {
    if (!mapReady || !mapRef.current || !shotlist) return;

    const handle = delayRender(`cam-frame-${frame}`);
    let resolved = false;

    const cam = interpolateCameraOnPath(shotlist.shots, t, PRE_ROLL_S);
    mapRef.current.jumpTo({
      center:  [cam.lng, cam.lat],
      zoom:     cam.zoom,
      pitch:    cam.pitch,
      bearing:  cam.bearing,
    });

    // Highlight the active shot's country on the map.
    let activeShot = shotlist.shots[0];
    let activeShotIdx = 0;
    for (let si = 0; si < shotlist.shots.length; si++) {
      if (shotlist.shots[si].t + PRE_ROLL_S <= t) { activeShot = shotlist.shots[si]; activeShotIdx = si; }
    }
    // Update story-path dashed line only when shot changes (not every frame).
    if (activeShotIdx !== activeShotIdxRef.current) {
      activeShotIdxRef.current = activeShotIdx;
      try { mapRef.current.getSource('story-path')?.setData(shotPathGeoJson(activeShot)); } catch {}
    }

    // Move location marker to the current story's primary place.
    // Hide it during globe shots (isoCode null = intro/outro).
    const loc = getActiveLocation(shotlist.shots, t, PRE_ROLL_S);
    if (markerRef.current) {
      if (loc && activeShot?.isoCode != null) {
        markerRef.current.getElement().style.display = '';
        markerRef.current.setLngLat([loc.lng, loc.lat]);
      } else {
        markerRef.current.getElement().style.display = 'none';
      }
    }
    // Per-waypoint highlight: swap state-boundary polygon + country filter when
    // the active waypoint changes (not just on shot boundaries).
    const activeWpResult = getActiveWaypoint(shotlist.shots, t, PRE_ROLL_S);
    const wpKey = activeWpResult
      ? `${activeWpResult.shotIdx}:${activeWpResult.waypointIdx}`
      : null;
    if (wpKey !== activeWaypointKeyRef.current) {
      activeWaypointKeyRef.current = wpKey;
      const hl = activeWpResult?.waypoint?.highlight ?? null;
      const poly = hl?.polygon ?? null;
      const iso  = hl?.iso    ?? '';
      const emptyFC = { type: 'FeatureCollection', features: [] };
      const polyFC  = poly
        ? { type: 'FeatureCollection', features: [poly] }
        : emptyFC;
      try { mapRef.current.getSource('state-boundary')?.setData(polyFC); } catch {}
      try {
        if (mapRef.current.getLayer('country-highlight-glow')) {
          mapRef.current.setFilter('country-highlight-glow', ['==', 'iso_3166_1', iso]);
          mapRef.current.setFilter('country-highlight-edge', ['==', 'iso_3166_1', iso]);
        }
      } catch {}

      // Update location pin label — show for state/city shots, hide for country/globe.
      const showLabel = hl?.type === 'state' || hl?.type === 'city';
      const labelFC = showLabel && activeWpResult?.waypoint
        ? {
            type: 'FeatureCollection',
            features: [{
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [activeWpResult.waypoint.lng, activeWpResult.waypoint.lat] },
              properties: { name: hl.name },
            }],
          }
        : emptyFC;
      try { mapRef.current.getSource('location-label')?.setData(labelFC); } catch {}
    }

    const onIdle = () => { resolved = true; continueRender(handle); };
    mapRef.current.once('idle', onIdle);

    return () => {
      mapRef.current?.off('idle', onIdle);
      if (!resolved) continueRender(handle);
    };
  }, [frame, mapReady]);

  if (!shotlist) return <AbsoluteFill style={{ background: '#000' }} />;

  // Overlay sequences shared between both layouts.
  const overlaySequences = shotlist.shots.flatMap((shot, i) =>
    (shot.overlays ?? []).map((ov, j) => {
      const fromFrame    = Math.round((PRE_ROLL_S + shot.t + ov.tOffset) * fps);
      const shotEndFrame = Math.round((PRE_ROLL_S + shot.t + shot.hold) * fps);
      const durFrames    = Math.min(
        Math.round((ov.durationMs / 1000) * fps),
        shotEndFrame - fromFrame,
      );
      if (durFrames <= 0) return null;
      return (
        <Sequence key={`${i}-${j}`} from={fromFrame} durationInFrames={durFrames}>
          {ov.type === 'data-callout' && (
            <DataCallout text={ov.text} fromFrame={fromFrame} durationFrames={durFrames} />
          )}
          {ov.type === 'quote-callout' && (
            <QuoteCallout text={ov.text} fromFrame={fromFrame} durationFrames={durFrames} aspect={aspect} />
          )}
        </Sequence>
      );
    })
  );

  const audioSequences = shotlist.shots.map((shot, i) => (
    <Sequence key={i} from={Math.round((PRE_ROLL_S + shot.t) * fps)} durationInFrames={Math.round(shot.hold * fps)}>
      <Audio src={`http://localhost:${port}/out/audio/${edition}/shot-${i}.wav`} />
    </Sequence>
  ));

  const fadeOverlay = (
    <FadeOverlay
      durationInFrames={durationInFrames}
      preRollS={PRE_ROLL_S}
      postRollS={POST_ROLL_S}
    />
  );

  // ── 9:16 full-bleed layout ────────────────────────────────────────────────
  if (aspect === '9:16') {
    return (
      <AbsoluteFill style={{ background: '#000' }}>
        <div ref={mapContainer} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        <TopBar edition={edition} t={t} />
        <MapAttribution aspect={aspect} />
        <RemotionFilmGrain opacity={0.055} />
        <SubtitleBar shots={shotlist.shots} timestamps={timestamps} t={t} preRollS={PRE_ROLL_S} aspect={aspect} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
          <Ticker shots={shotlist.shots} />
          <Chyron
            shots={shotlist.shots}
            t={t}
            preRollS={PRE_ROLL_S}
            durationInFrames={durationInFrames}
          />
        </div>
        {overlaySequences}
        {fadeOverlay}
        {audioSequences}
      </AbsoluteFill>
    );
  }

  // ── 16:9 layout (unchanged) ───────────────────────────────────────────────
  return (
    <AbsoluteFill style={{ background: '#000', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'relative', width: '100%', flex: 1, overflow: 'hidden' }}>
        <div
          ref={mapContainer}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        />
        <TopBar edition={edition} t={t} />
        <MapAttribution aspect={aspect} />
        <RemotionFilmGrain opacity={0.055} />
        <SubtitleBar shots={shotlist.shots} timestamps={timestamps} t={t} preRollS={PRE_ROLL_S} aspect={aspect} />
      </div>
      <div style={{ flexShrink: 0 }}>
        <Ticker shots={shotlist.shots} />
        <Chyron
          shots={shotlist.shots}
          t={t}
          preRollS={PRE_ROLL_S}
          durationInFrames={durationInFrames}
        />
      </div>
      {overlaySequences}
      {fadeOverlay}
      {audioSequences}
    </AbsoluteFill>
  );
}
