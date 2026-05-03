// Computes the night-side fill polygon for the day/night terminator overlay.
//
// Algorithm:
//   1. Approximate solar declination from day-of-year.
//   2. Derive subsolar longitude from UTC time.
//   3. For each integer longitude -180…+180, solve for the latitude where
//      the solar zenith angle = 90°:
//        tan(φ) = −cos(H) / tan(δ)     (H = hour angle = lng − subLng)
//   4. Close the ring through the night-side pole (south in northern
//      summer, north in northern winter) to produce a valid GeoJSON polygon.
//
// Called once on map init (from applyMapStyle) and then every 60 s from
// the useMeridianMap hook so the shadow creeps visibly during a session.

const DEG = Math.PI / 180;

function dayOfYear(date) {
  return Math.floor(
    (date.getTime() - Date.UTC(date.getUTCFullYear(), 0, 0)) / 86_400_000
  );
}

export function computeNightPolygon(date = new Date()) {
  const doy = dayOfYear(date);

  // Solar declination (degrees → radians)
  const decl = -23.45 * DEG * Math.cos((2 * Math.PI * (doy + 10)) / 365);

  // Subsolar longitude: sun is overhead at 0° at noon UTC
  const utcS = date.getUTCHours() * 3600 + date.getUTCMinutes() * 60 + date.getUTCSeconds();
  const subLng = 180 - (utcS / 86_400) * 360;

  const coords = [];
  for (let i = 0; i <= 360; i++) {
    const lng = i - 180;
    const H = (lng - subLng) * DEG;
    // Clamp tan(decl) away from zero to avoid blowup at equinox
    const tanDecl = Math.abs(Math.tan(decl)) < 1e-6
      ? (decl >= 0 ? 1e-6 : -1e-6)
      : Math.tan(decl);
    const lat = Math.atan(-Math.cos(H) / tanDecl) / DEG;
    coords.push([lng, lat]);
  }

  // Close through the night-side pole
  const pole = decl >= 0 ? -90 : 90;
  coords.push([180, pole], [-180, pole], coords[0]);

  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [coords] },
    properties: {},
  };
}
