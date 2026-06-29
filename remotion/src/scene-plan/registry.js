// remotion/src/scene-plan/registry.js
import { LowerThird }    from './treatments/LowerThird.jsx';
import { StatCard }      from './treatments/StatCard.jsx';
import { MapAnnotation } from './treatments/MapAnnotation.jsx';
import { ConnectionArc } from './treatments/ConnectionArc.jsx';

const REGISTRY = {
  'lower-third':    LowerThird,
  'stat-card':      StatCard,
  'map-annotation': MapAnnotation,
  'connection-arc': ConnectionArc,
};

const OVERLAY_TYPES = new Set(Object.keys(REGISTRY));
const CAMERA_TYPES  = new Set(['camera-move']);

export function isOverlay(type)    { return OVERLAY_TYPES.has(type); }
export function isCameraMove(type) { return CAMERA_TYPES.has(type); }
export function getComponent(type) { return REGISTRY[type] ?? null; }
