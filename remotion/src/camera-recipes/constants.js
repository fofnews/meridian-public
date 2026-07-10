// Broadcast camera constants for recipe modules.
// Mirrors the relevant values from src/map/camera.js without importing that
// file (which references window.innerWidth and other browser globals).
export const PITCH             = 50;    // FOCUSED_PITCH_BROADCAST
export const BEARING           = -10;   // default story shot bearing
export const AMBIENT_ZOOM      = 1.5;   // globe-level zoom
export const AMBIENT_LAT       = 20;    // globe-level center latitude
export const AMBIENT_LNG       = 0;     // globe-level center longitude
export const SPIN_DEG_PER_SEC  = 1.5;   // bearing drift rate for spin / hover
export const MAX_HOVER_DRIFT   = 30;    // cap on hover bearing drift in degrees
