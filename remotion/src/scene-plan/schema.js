// remotion/src/scene-plan/schema.js
import { z } from 'zod';

const LowerThirdTreatment = z.object({
  type: z.literal('lower-third'),
  tStart: z.number(),
  tEnd: z.number(),
  headline: z.string(),
  label: z.string().optional(),
});

const StatCardTreatment = z.object({
  type: z.literal('stat-card'),
  tStart: z.number(),
  tEnd: z.number(),
  value: z.string(),
  label: z.string().optional(),
});

const MapAnnotationTreatment = z.object({
  type: z.literal('map-annotation'),
  tStart: z.number(),
  tEnd: z.number(),
  lat: z.number(),
  lng: z.number(),
  text: z.string(),
});

const ConnectionArcTreatment = z.object({
  type: z.literal('connection-arc'),
  tStart: z.number(),
  tEnd: z.number(),
  fromLat: z.number(),
  fromLng: z.number(),
  toLat: z.number(),
  toLng: z.number(),
});

const CameraMoveTreatment = z.object({
  type: z.literal('camera-move'),
  tStart: z.number(),
  tEnd: z.number(),
  lat: z.number(),
  lng: z.number(),
  zoom: z.number(),
  pitch: z.number(),
  bearing: z.number(),
});

const LocationBugTreatment = z.object({
  type: z.literal('location-bug'),
  tStart: z.number(),
  tEnd: z.number(),
  locations: z.array(z.object({
    name: z.string(),
    tActive: z.number(), // shot-relative time when this location becomes highlighted
  })),
});

const FlowArrowFlow = z.object({
  path: z.array(z.object({ lng: z.number(), lat: z.number() })).min(2),
  label: z.string().optional(),
  color: z.string().optional(),          // hex color, defaults to accent yellow
  weight: z.number().positive().optional(), // line-width multiplier, default 1
  revealDuration: z.number().positive().optional(), // seconds to draw the line, default 1.5
  revealDelay: z.number().nonnegative().optional(),  // delay before reveal starts, default 0
});

const FlowArrowTreatment = z.object({
  type: z.literal('flow-arrow'),
  tStart: z.number(),
  tEnd: z.number(),
  flows: z.array(FlowArrowFlow).min(1),
  style: z.enum(['arrow', 'march']).optional(), // default 'arrow' (bold line + arrowhead)
});

const RippleExpandTreatment = z.object({
  type:   z.literal('ripple-expand'),
  tStart: z.number(),
  tEnd:   z.number(),
  lat:    z.number(),
  lng:    z.number(),
});

const LabelBloomTreatment = z.object({
  type:   z.literal('label-bloom'),
  tStart: z.number(),
  tEnd:   z.number(),
  lat:    z.number(),
  lng:    z.number(),
  text:   z.string(),
});

// ── Overlay library treatments ────────────────────────────────────────────────

const ParticleTrailTreatment = z.object({
  type:          z.literal('particle-trail'),
  tStart:        z.number(),
  tEnd:          z.number(),
  path:          z.array(z.object({ lat: z.number(), lng: z.number() })).min(2),
  particleCount: z.number().int().positive().optional(),
  speed:         z.number().positive().optional(),
  color:         z.string().optional(),
});

const RouteRevealTreatment = z.object({
  type:           z.literal('route-reveal'),
  tStart:         z.number(),
  tEnd:           z.number(),
  from:           z.object({ lat: z.number(), lng: z.number() }),
  to:             z.object({ lat: z.number(), lng: z.number() }),
  revealDuration: z.number().positive().optional(),
  style:          z.enum(['dashed', 'solid']).optional(),
});

const ImpactRadiusTreatment = z.object({
  type:     z.literal('impact-radius'),
  tStart:   z.number(),
  tEnd:     z.number(),
  lat:      z.number(),
  lng:      z.number(),
  radiusKm: z.number().positive(),
  label:    z.string().optional(),
});

const SpotlightMaskTreatment = z.object({
  type:     z.literal('spotlight-mask'),
  tStart:   z.number(),
  tEnd:     z.number(),
  lat:      z.number(),
  lng:      z.number(),
  radiusPx: z.number().positive().optional(),
});

const HatchedZoneTreatment = z.object({
  type:    z.literal('hatched-zone'),
  tStart:  z.number(),
  tEnd:    z.number(),
  polygon: z.any(),
  pattern: z.enum(['contested', 'exclusion']).optional(),
});

const MagnitudeBubbleTreatment = z.object({
  type:   z.literal('magnitude-bubble'),
  tStart: z.number(),
  tEnd:   z.number(),
  lat:    z.number(),
  lng:    z.number(),
  value:  z.number(),
  unit:   z.string().optional(),
  minPx:  z.number().positive().optional(),
  maxPx:  z.number().positive().optional(),
});

const ArcTokenTreatment = z.object({
  type:   z.literal('arc-token'),
  tStart: z.number(),
  tEnd:   z.number(),
  arcs:   z.array(z.object({
    from: z.object({ lat: z.number(), lng: z.number() }),
    to:   z.object({ lat: z.number(), lng: z.number() }),
  })).min(1),
});

const SideBySideCalloutTreatment = z.object({
  type:   z.literal('side-by-side-callout'),
  tStart: z.number(),
  tEnd:   z.number(),
  labelA: z.string(),
  valueA: z.string(),
  labelB: z.string(),
  valueB: z.string(),
});

const EscalationWarningTreatment = z.object({
  type:   z.literal('escalation-warning'),
  tStart: z.number(),
  tEnd:   z.number(),
  text:   z.string(),
});

const ContextStripTreatment = z.object({
  type:   z.literal('context-strip'),
  tStart: z.number(),
  tEnd:   z.number(),
  text:   z.string(),
});

export const Treatment = z.discriminatedUnion('type', [
  LowerThirdTreatment,
  StatCardTreatment,
  MapAnnotationTreatment,
  ConnectionArcTreatment,
  CameraMoveTreatment,
  LocationBugTreatment,
  FlowArrowTreatment,
  RippleExpandTreatment,
  LabelBloomTreatment,
  ParticleTrailTreatment,
  RouteRevealTreatment,
  ImpactRadiusTreatment,
  SpotlightMaskTreatment,
  HatchedZoneTreatment,
  MagnitudeBubbleTreatment,
  ArcTokenTreatment,
  SideBySideCalloutTreatment,
  EscalationWarningTreatment,
  ContextStripTreatment,
]);

const Scene = z.object({
  shotIndex: z.number().int().nonnegative(),
  tStart: z.number(),
  tEnd: z.number(),
  treatments: z.array(Treatment),
});

export const ScenePlan = z.object({
  version: z.literal('1'),
  edition: z.string(),
  fps: z.number().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  scenes: z.array(Scene),
});
