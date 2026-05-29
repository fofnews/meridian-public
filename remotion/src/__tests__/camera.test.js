import { describe, it, expect } from 'vitest';
import { interpolateCameraOnPath } from '../camera.js';

const PRE_ROLL_S = 1;

// Two shots: shot[0] at t=0 hold=10, shot[1] at t=10 hold=10.
// cameraPath: two waypoints with bearing drift (single-location pattern).
const shots = [
  {
    t: 0, hold: 10,
    cameraPath: [
      { tOffset: 0,  lng: 0,   lat: 0,  zoom: 5, pitch: 50, bearing: -10 },
      { tOffset: 10, lng: 0,   lat: 0,  zoom: 5, pitch: 50, bearing: 2   },
    ],
  },
  {
    t: 10, hold: 10,
    cameraPath: [
      { tOffset: 0,  lng: 100, lat: 50, zoom: 4, pitch: 50, bearing: -10 },
      { tOffset: 10, lng: 100, lat: 50, zoom: 4, pitch: 50, bearing: 2   },
    ],
  },
];

// Legacy shots (bare camera, no cameraPath) — for backward-compat tests.
const legacyShots = [
  { t: 0,  camera: { lng: 0,   lat: 0,  zoom: 5, pitch: 50, bearing: -10 }, hold: 10 },
  { t: 10, camera: { lng: 100, lat: 50, zoom: 4, pitch: 50, bearing: -10 }, hold: 10 },
];

describe('interpolateCameraOnPath — cameraPath shots', () => {
  it('holds first shot camera during pre-roll', () => {
    const cam = interpolateCameraOnPath(shots, 0.5, PRE_ROLL_S);
    expect(cam.lng).toBe(0);
    expect(cam.lat).toBe(0);
    expect(cam.zoom).toBe(5);
  });

  it('holds first shot camera within shot (no fly yet)', () => {
    // At t = PRE_ROLL_S + 5 we are mid-shot[0]; no cross-shot fly until shot boundary
    const cam = interpolateCameraOnPath(shots, PRE_ROLL_S + 5, PRE_ROLL_S);
    expect(cam.lng).toBe(0);
    expect(cam.lat).toBe(0);
  });

  it('camera path drifts bearing within a shot', () => {
    // At the end of shot[0] the camera should have drifted toward bearing=2
    const camStart = interpolateCameraOnPath(shots, PRE_ROLL_S + 0, PRE_ROLL_S);
    const camEnd   = interpolateCameraOnPath(shots, PRE_ROLL_S + 10, PRE_ROLL_S);
    // bearing drifts from -10 toward 2 over hold=10s (but shot[1] starts at t=10 — clamp)
    expect(camStart.bearing).toBeLessThan(camEnd.bearing);
  });

  it('starts cross-shot fly at shot boundary', () => {
    // 0.5 s into shot[1] (boundary at PRE_ROLL_S + 10) → mid-fly
    const cam = interpolateCameraOnPath(shots, PRE_ROLL_S + 10 + 0.5, PRE_ROLL_S);
    expect(cam.lng).toBeGreaterThan(0);
    expect(cam.lng).toBeLessThan(100);
  });

  it('reaches shot[1] first waypoint after FLY_DURATION_S from boundary', () => {
    // 2 s into shot[1] → fly complete
    const cam = interpolateCameraOnPath(shots, PRE_ROLL_S + 10 + 2, PRE_ROLL_S);
    expect(cam.lng).toBeCloseTo(100, 1);
    expect(cam.lat).toBeCloseTo(50, 1);
  });

  it('holds last shot camera after fly completes', () => {
    const cam = interpolateCameraOnPath(shots, PRE_ROLL_S + 10 + 8, PRE_ROLL_S);
    expect(cam.lng).toBeCloseTo(100, 1);
  });

  it('cross-shot fly easing is monotonically increasing (no overshoot)', () => {
    const flyStart = PRE_ROLL_S + 10; // shot boundary
    const values = [0, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0].map(dt =>
      interpolateCameraOnPath(shots, flyStart + dt, PRE_ROLL_S).lng
    );
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
    }
  });
});

describe('interpolateCameraOnPath — multi-waypoint shots (tour within shot)', () => {
  const tourShots = [
    {
      t: 0, hold: 20,
      cameraPath: [
        { tOffset: 0,  lng: 0,   lat: 0,  zoom: 5, pitch: 50, bearing: -10 },
        { tOffset: 10, lng: 50,  lat: 25, zoom: 5, pitch: 50, bearing: 2   },
        { tOffset: 20, lng: 100, lat: 50, zoom: 5, pitch: 50, bearing: -10 },
      ],
    },
  ];

  it('starts at first waypoint', () => {
    const cam = interpolateCameraOnPath(tourShots, PRE_ROLL_S, PRE_ROLL_S);
    expect(cam.lng).toBe(0);
  });

  it('reaches second waypoint at tOffset=10', () => {
    const cam = interpolateCameraOnPath(tourShots, PRE_ROLL_S + 10, PRE_ROLL_S);
    expect(cam.lng).toBeCloseTo(50, 1);
  });

  it('reaches third waypoint at end of shot', () => {
    const cam = interpolateCameraOnPath(tourShots, PRE_ROLL_S + 20, PRE_ROLL_S);
    expect(cam.lng).toBeCloseTo(100, 1);
  });

  it('interpolates smoothly between waypoints', () => {
    const values = [0, 5, 10, 15, 20].map(dt =>
      interpolateCameraOnPath(tourShots, PRE_ROLL_S + dt, PRE_ROLL_S).lng
    );
    // Should move from 0 → 50 → 100 monotonically
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
    }
  });
});

describe('interpolateCameraOnPath — legacy shot.camera fallback', () => {
  it('holds legacy shot camera within shot', () => {
    const cam = interpolateCameraOnPath(legacyShots, PRE_ROLL_S + 3, PRE_ROLL_S);
    expect(cam.lng).toBe(0);
  });

  it('flies to next legacy shot at boundary', () => {
    const cam = interpolateCameraOnPath(legacyShots, PRE_ROLL_S + 10 + 0.5, PRE_ROLL_S);
    expect(cam.lng).toBeGreaterThan(0);
    expect(cam.lng).toBeLessThan(100);
  });
});
