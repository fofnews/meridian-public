// OverlayGallery — visual confirmation reel for all 18 scene-plan overlay treatments.
// Renders treatment components directly (no SceneRenderer) to avoid the Broadcast
// pre-roll offset. Each scene gets a fake Mercator mapRef + ProjectFnContext so
// every geo-anchored treatment projects correctly without a live Mapbox instance.
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import { useRef, useCallback } from 'react';
import { getComponent } from './scene-plan/registry.js';
import { ProjectFnContext } from './scene-plan/projection.jsx';

const FPS          = 30;
const SCENE_S      = 6;
const SCENE_FRAMES = SCENE_S * FPS;

// ── Mercator projection ────────────────────────────────────────────────────────
function makeMercProject(centerLng, centerLat, width, height, zoom) {
  const scale = 256 * Math.pow(2, zoom);
  const toMX  = (lng) => ((lng + 180) / 360) * scale;
  const toMY  = (lat) => {
    const r = lat * Math.PI / 180;
    return (0.5 - Math.log(Math.tan(Math.PI / 4 + r / 2)) / (2 * Math.PI)) * scale;
  };
  const cx = toMX(centerLng);
  const cy = toMY(centerLat);
  return ([lng, lat]) => ({
    x: (toMX(lng) - cx) + width / 2,
    y: (toMY(lat) - cy) + height / 2,
  });
}

// ── Scene definitions ─────────────────────────────────────────────────────────
// All tStart/tEnd are relative to the scene's own Sequence (frame 0 = scene start).
const SCENES = [
  {
    type: 'lower-third',
    center: [2.35, 48.86], zoom: 8,
    desc: 'Screen-space chyron strip with label chip and headline',
    treatment: { type: 'lower-third', tStart: 0.5, tEnd: 5.5, label: 'BREAKING', headline: 'Ceasefire talks collapse in Geneva' },
  },
  {
    type: 'stat-card',
    center: [0, 20], zoom: 2,
    desc: 'Giant centered number card for data emphasis',
    treatment: { type: 'stat-card', tStart: 0.5, tEnd: 5.5, value: '34,000', label: 'CONFIRMED DEAD' },
  },
  {
    type: 'label-bloom',
    center: [30.52, 50.45], zoom: 9,
    desc: 'Rising geo-anchored text label as camera lands on Kyiv',
    treatment: { type: 'label-bloom', tStart: 0.3, tEnd: 5.5, lat: 50.45, lng: 30.52, text: 'Kyiv' },
  },
  {
    type: 'ripple-expand',
    center: [40.23, 37.91], zoom: 7,
    desc: 'Three expanding rings at earthquake epicenter near Diyarbakır',
    treatment: { type: 'ripple-expand', tStart: 0, tEnd: 5.5, lat: 37.91, lng: 40.23 },
  },
  {
    type: 'magnitude-bubble',
    center: [51.39, 35.69], zoom: 7,
    desc: 'Log-scaled circle — "GDP contracted 78 billion" over Tehran',
    treatment: { type: 'magnitude-bubble', tStart: 0.5, tEnd: 5.5, lat: 35.69, lng: 51.39, value: 78, unit: 'B' },
  },
  {
    type: 'impact-radius',
    center: [35.49, 33.88], zoom: 7,
    desc: 'Zoom-aware concentric rings — 150 km missile range from Beirut',
    treatment: { type: 'impact-radius', tStart: 0, tEnd: 5.5, lat: 33.88, lng: 35.49, radiusKm: 150, label: '150 km' },
  },
  {
    type: 'spotlight-mask',
    center: [34.49, 31.39], zoom: 9,
    desc: 'Cinematic vignette with soft geo-anchored cutout at Be\'eri kibbutz',
    treatment: { type: 'spotlight-mask', tStart: 0, tEnd: 5.5, lat: 31.39, lng: 34.49 },
  },
  {
    type: 'hatched-zone',
    center: [120.5, 24.0], zoom: 6,
    desc: 'SVG diagonal-hatch polygon projected over Taiwan Strait ADIZ',
    treatment: {
      type: 'hatched-zone', tStart: 0, tEnd: 5.5,
      polygon: { type: 'Polygon', coordinates: [[[119, 22], [122, 22], [122, 26], [119, 26], [119, 22]]] },
      pattern: 'contested',
    },
  },
  {
    type: 'flow-arrow',
    center: [36.4, 51.0], zoom: 7,
    desc: 'March-dash animated arrows — Russian advance axis south from Kursk',
    treatment: {
      type: 'flow-arrow', tStart: 0, tEnd: 5.5, style: 'march',
      flows: [{ path: [{ lng: 36.2, lat: 51.7 }, { lng: 36.5, lat: 50.9 }, { lng: 36.8, lat: 50.4 }], color: '#ff6600', label: 'Advance axis' }],
    },
  },
  {
    type: 'particle-trail',
    center: [10.0, 25.0], zoom: 3,
    desc: 'Streaming dots — fentanyl precursor route: China → Mexico → US border',
    treatment: {
      type: 'particle-trail', tStart: 0, tEnd: 5.5,
      path: [{ lat: 31.2, lng: 121.5 }, { lat: 24.8, lng: -107.4 }, { lat: 29.4, lng: -100.5 }],
      particleCount: 6, speed: 0.25, color: '#f5a623',
    },
  },
  {
    type: 'arc-token',
    center: [25.5, 51.3], zoom: 5,
    desc: 'Sliding dot arcs between endpoints — arms shipments Warsaw → Kyiv',
    treatment: {
      type: 'arc-token', tStart: 0, tEnd: 5.5,
      arcs: [{ from: { lat: 52.2, lng: 21.0 }, to: { lat: 50.4, lng: 30.5 } }],
    },
  },
  {
    type: 'route-reveal',
    center: [12.9, 34.0], zoom: 6,
    desc: 'Progressive line reveal — migrant route Tripoli → Lampedusa',
    treatment: {
      type: 'route-reveal', tStart: 0.5, tEnd: 5.5,
      from: { lat: 32.9, lng: 13.2 }, to: { lat: 35.5, lng: 12.6 },
      revealDuration: 3, style: 'dashed',
    },
  },
  {
    type: 'connection-arc',
    center: [-9.0, 37.0], zoom: 3,
    desc: 'Curved geodesic arc — back-channel diplomacy Washington → Tehran via Oman',
    treatment: {
      type: 'connection-arc', tStart: 0.5, tEnd: 5.5,
      fromLat: 38.9, fromLng: -77.0, toLat: 23.6, toLng: 58.6,
    },
  },
  {
    type: 'map-annotation',
    center: [34.59, 47.51], zoom: 8,
    desc: 'Geo-pinned text label with dot anchor — Zaporizhzhia Nuclear Plant',
    treatment: { type: 'map-annotation', tStart: 0.5, tEnd: 5.5, lat: 47.51, lng: 34.59, text: 'ZNPP' },
  },
  {
    type: 'side-by-side-callout',
    center: [0, 30], zoom: 2,
    desc: 'Two stat cards — US ($886B) vs China ($225B) defense spending',
    treatment: {
      type: 'side-by-side-callout', tStart: 0.5, tEnd: 5.5,
      labelA: 'UNITED STATES', valueA: '$886B', labelB: 'CHINA', valueB: '$225B',
    },
  },
  {
    type: 'escalation-warning',
    center: [53.6, 32.4], zoom: 5,
    desc: 'Red-bordered escalation pill — Iran launches ballistic missiles toward Israel',
    treatment: { type: 'escalation-warning', tStart: 0.5, tEnd: 5.5, text: 'Escalating situation' },
  },
  {
    type: 'context-strip',
    center: [37.3, 15.6], zoom: 6,
    desc: 'Left-anchored gold-border blurb — background on Port Sudan\'s role',
    treatment: {
      type: 'context-strip', tStart: 0.5, tEnd: 5.5,
      text: 'Displaced capital since fall of Khartoum — population 800,000',
    },
  },
  {
    type: 'location-bug',
    center: [32.5, 47.0], zoom: 5,
    desc: 'Active-location chip list cycling through Odesa → Mykolaiv → Kherson',
    treatment: {
      type: 'location-bug', tStart: 0, tEnd: SCENE_S,
      locations: [
        { name: 'Odesa',    tActive: 0 },
        { name: 'Mykolaiv', tActive: 2 },
        { name: 'Kherson',  tActive: 4 },
      ],
    },
  },
];

export const galleryDurationInFrames = SCENES.length * SCENE_FRAMES;

// ── Component ──────────────────────────────────────────────────────────────────
export function OverlayGallery() {
  const frame              = useCurrentFrame();
  const { width, height }  = useVideoConfig();

  const sceneIndex = Math.min(Math.floor(frame / SCENE_FRAMES), SCENES.length - 1);
  const scene      = SCENES[sceneIndex];

  // fakeMapRef — same object every render; .current updated every frame so
  // geo-anchored treatments always call the right projection for the current scene.
  const fakeMapRef = useRef(null);
  const projectXY  = makeMercProject(scene.center[0], scene.center[1], width, height, scene.zoom);
  fakeMapRef.current = {
    project:  ([lng, lat]) => projectXY([lng, lat]),
    getZoom:  () => scene.zoom,
  };

  // ProjectFnContext for treatments that use useProject() (MapAnnotation, ConnectionArc).
  // Closure reads fakeMapRef.current at call time so it always uses the latest scene.
  const contextFn = useCallback(
    (p) => fakeMapRef.current.project([p.lng, p.lat]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sceneIndex],
  );

  const frameInScene = frame % SCENE_FRAMES;
  const progressPct  = (frameInScene / SCENE_FRAMES) * 100;

  return (
    <AbsoluteFill style={{ background: '#0d1117', fontFamily: 'monospace' }}>

      {/* Subtle grid lines — simulates map surface */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: [
          'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px)',
          'linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
        ].join(', '),
        backgroundSize: '80px 80px',
      }} />

      {/* Center crosshair */}
      <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.10 }} width={width} height={height}>
        <line x1={width / 2} y1={0} x2={width / 2} y2={height} stroke="white" strokeWidth={1} />
        <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke="white" strokeWidth={1} />
      </svg>

      {/* ── Treatments — one Sequence per scene ────────────────────────── */}
      <ProjectFnContext.Provider value={contextFn}>
        {SCENES.map((s, i) => {
          const Component = getComponent(s.type);
          if (!Component) return null;
          return (
            <Sequence key={i} from={i * SCENE_FRAMES} durationInFrames={SCENE_FRAMES}>
              <Component treatment={s.treatment} mapRef={fakeMapRef} />
            </Sequence>
          );
        })}
      </ProjectFnContext.Provider>

      {/* ── HUD ────────────────────────────────────────────────────────── */}

      {/* Top-left: scene counter */}
      <div style={{
        position: 'absolute', top: 28, left: 40,
        color: 'rgba(255,255,255,0.28)', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase',
        pointerEvents: 'none',
      }}>
        {sceneIndex + 1}&thinsp;/&thinsp;{SCENES.length}
      </div>

      {/* Top-right: treatment type name — swaps each scene */}
      {SCENES.map((s, i) => (
        <Sequence key={`lbl-${i}`} from={i * SCENE_FRAMES} durationInFrames={SCENE_FRAMES}>
          <div style={{
            position: 'absolute', top: 24, right: 40,
            color: '#e8c84a', fontSize: 17, fontWeight: 700, letterSpacing: 2,
            textTransform: 'uppercase', pointerEvents: 'none',
          }}>
            {s.type}
          </div>
        </Sequence>
      ))}

      {/* Bottom-center: one-line description */}
      {SCENES.map((s, i) => (
        <Sequence key={`desc-${i}`} from={i * SCENE_FRAMES} durationInFrames={SCENE_FRAMES}>
          <div style={{
            position: 'absolute', bottom: 44, left: 40, right: 40,
            color: 'rgba(255,255,255,0.40)', fontSize: 13, lineHeight: 1.55, pointerEvents: 'none',
          }}>
            {s.desc}
          </div>
        </Sequence>
      ))}

      {/* Progress bar */}
      <div style={{
        position: 'absolute', bottom: 24, left: 40, right: 40,
        height: 2, background: 'rgba(255,255,255,0.08)', borderRadius: 1, pointerEvents: 'none',
      }}>
        <div style={{
          height: '100%', width: `${progressPct}%`,
          background: '#e8c84a', borderRadius: 1,
        }} />
      </div>

    </AbsoluteFill>
  );
}
