// remotion/src/scene-plan/registry.js
import { LowerThird }           from './treatments/LowerThird.jsx';
import { StatCard }             from './treatments/StatCard.jsx';
import { MapAnnotation }        from './treatments/MapAnnotation.jsx';
import { ConnectionArc }        from './treatments/ConnectionArc.jsx';
import { LocationBug }          from './treatments/LocationBug.jsx';
import { FlowArrow }            from './treatments/FlowArrow.jsx';
import { RippleExpand }         from './treatments/RippleExpand.jsx';
import { LabelBloom }           from './treatments/LabelBloom.jsx';
import { ParticleTrail }        from './treatments/ParticleTrail.jsx';
import { RouteReveal }          from './treatments/RouteReveal.jsx';
import { ImpactRadius }         from './treatments/ImpactRadius.jsx';
import { SpotlightMask }        from './treatments/SpotlightMask.jsx';
import { HatchedZone }          from './treatments/HatchedZone.jsx';
import { MagnitudeBubble }      from './treatments/MagnitudeBubble.jsx';
import { ArcToken }             from './treatments/ArcToken.jsx';
import { SideBySideCallout }    from './treatments/SideBySideCallout.jsx';
import { EscalationWarning }    from './treatments/EscalationWarning.jsx';
import { ContextStrip }         from './treatments/ContextStrip.jsx';

const REGISTRY = {
  'lower-third':          LowerThird,
  'stat-card':            StatCard,
  'map-annotation':       MapAnnotation,
  'connection-arc':       ConnectionArc,
  'location-bug':         LocationBug,
  'flow-arrow':           FlowArrow,
  'ripple-expand':        RippleExpand,
  'label-bloom':          LabelBloom,
  'particle-trail':       ParticleTrail,
  'route-reveal':         RouteReveal,
  'impact-radius':        ImpactRadius,
  'spotlight-mask':       SpotlightMask,
  'hatched-zone':         HatchedZone,
  'magnitude-bubble':     MagnitudeBubble,
  'arc-token':            ArcToken,
  'side-by-side-callout': SideBySideCallout,
  'escalation-warning':   EscalationWarning,
  'context-strip':        ContextStrip,
};

const OVERLAY_TYPES = new Set(Object.keys(REGISTRY));
const CAMERA_TYPES  = new Set(['camera-move']);

export function isOverlay(type)    { return OVERLAY_TYPES.has(type); }
export function isCameraMove(type) { return CAMERA_TYPES.has(type); }
export function getComponent(type) { return REGISTRY[type] ?? null; }
