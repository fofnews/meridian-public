// remotion/src/Broadcast.jsx
import './broadcast.css';
import { useEffect, useRef } from 'react';
import { useCurrentFrame, useVideoConfig, AbsoluteFill, Audio, delayRender, continueRender } from 'remotion';
import { useRemotionMap } from './useRemotionMap.js';
import { interpolateCamera } from './camera.js';
import { RemotionFilmGrain, Chyron, Ticker, TopBar, MapAttribution, FadeOverlay } from './overlays.jsx';

const PRE_ROLL_S  = 1;
const POST_ROLL_S = 1;

export async function calculateMetadata({ props }) {
  const { edition, fps = 30, port = 3002 } = props;
  const res = await fetch(`http://localhost:${port}/out/shotlists/${edition}.json`);
  if (!res.ok) throw new Error(`Shotlist fetch failed: ${res.status} for edition "${edition}"`);
  const shotlist = await res.json();
  const durationInFrames = Math.ceil((PRE_ROLL_S + shotlist.duration + POST_ROLL_S) * fps);
  return {
    durationInFrames,
    fps,
    props: { ...props, shotlist },
  };
}

export function Broadcast({ edition, aspect = '16:9', port = 3002, shotlist, fps: propFps = 30 }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;

  const { mapContainer, mapRef, mapReady } = useRemotionMap();

  // Per-frame camera update: jumpTo computed position, delay Remotion
  // until Mapbox reports idle (all tiles rendered for this position).
  const frameHandleRef = useRef(null);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !shotlist) return;

    const handle = delayRender(`cam-frame-${frame}`);
    frameHandleRef.current = handle;

    const cam = interpolateCamera(shotlist.shots, t, PRE_ROLL_S);
    mapRef.current.jumpTo({
      center:  [cam.lng, cam.lat],
      zoom:     cam.zoom,
      pitch:    cam.pitch,
      bearing:  cam.bearing,
    });

    const onIdle = () => continueRender(handle);
    mapRef.current.once('idle', onIdle);

    return () => {
      mapRef.current?.off('idle', onIdle);
    };
  }, [frame, mapReady]);

  if (!shotlist) return <AbsoluteFill style={{ background: '#000' }} />;

  // Calculate the ticker height + chyron height so the map fills the rest.
  // Ticker: ~28px, chyron upper: ~38px, chyron lower: ~28px → total ~94px.
  // These are approximate; the actual heights are set by the flex layout.
  const overlayHeight = 166;
  const mapHeight = `calc(100% - ${overlayHeight}px)`;

  return (
    <AbsoluteFill style={{ background: '#000', display: 'flex', flexDirection: 'column' }}>

      {/* Map area */}
      <div style={{ position: 'relative', width: '100%', height: mapHeight, overflow: 'hidden' }}>
        <div
          ref={mapContainer}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        />
        <TopBar edition={edition} t={t} />
        <MapAttribution />
        <RemotionFilmGrain opacity={0.055} />
      </div>

      {/* Ticker + chyron below map */}
      <div style={{ flexShrink: 0 }}>
        <Ticker shots={shotlist.shots} />
        <Chyron
          shots={shotlist.shots}
          t={t}
          preRollS={PRE_ROLL_S}
          durationInFrames={durationInFrames}
        />
      </div>

      {/* Pre-roll / post-roll black fade — sits on top of everything */}
      <FadeOverlay
        durationInFrames={durationInFrames}
        preRollS={PRE_ROLL_S}
        postRollS={POST_ROLL_S}
      />

      {/* Per-shot narration audio */}
      {shotlist.shots.map((shot, i) => (
        <Audio
          key={i}
          src={`http://localhost:${port}/out/audio/${edition}/shot-${i}.wav`}
          startFrom={Math.round((PRE_ROLL_S + shot.t) * fps)}
        />
      ))}

    </AbsoluteFill>
  );
}
