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

export const Treatment = z.discriminatedUnion('type', [
  LowerThirdTreatment,
  StatCardTreatment,
  MapAnnotationTreatment,
  ConnectionArcTreatment,
  CameraMoveTreatment,
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
