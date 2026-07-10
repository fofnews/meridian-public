// remotion/src/scene-plan/SceneRenderer.jsx
// Validates a ScenePlan and renders each overlay treatment in its own Sequence.
// Camera-move treatments are filtered out (handled by existing camera system).
import { Sequence, useVideoConfig } from 'remotion';
import { ScenePlan } from './schema.js';
import { isOverlay, getComponent } from './registry.js';
import { ProjectFnContext } from './projection.jsx';

const PRE_ROLL_S = 1; // must stay in sync with Broadcast.jsx

export function SceneRenderer({ plan, mapRef }) {
  const { fps } = useVideoConfig();

  const parsed = ScenePlan.parse(plan); // throws ZodError on invalid plan

  const projectFn = mapRef?.current
    ? (p) => {
        const pt = mapRef.current.project([p.lng, p.lat]);
        return { x: pt.x, y: pt.y };
      }
    : null;

  const sequences = [];
  for (const scene of parsed.scenes) {
    for (let ti = 0; ti < scene.treatments.length; ti++) {
      const t = scene.treatments[ti];
      if (!isOverlay(t.type)) continue;

      const Component = getComponent(t.type);
      if (!Component) continue;

      const fromFrame = Math.round((PRE_ROLL_S + t.tStart) * fps);
      const durFrames = Math.round((t.tEnd - t.tStart) * fps);
      if (durFrames <= 0) continue;

      sequences.push(
        <Sequence
          key={`${scene.shotIndex}-${ti}`}
          from={fromFrame}
          durationInFrames={durFrames}>
          <Component treatment={t} mapRef={mapRef} />
        </Sequence>
      );
    }
  }

  return (
    <ProjectFnContext.Provider value={projectFn}>
      {sequences}
    </ProjectFnContext.Provider>
  );
}
