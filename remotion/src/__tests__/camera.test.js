import { describe, it, expect } from 'vitest';
import { interpolateCamera } from '../camera.js';

const PRE_ROLL_S = 1;

// Two shots: first at t=0, second at t=10
const shots = [
  { t: 0,  camera: { lng: 0,   lat: 0,  zoom: 5, pitch: 50, bearing: -10 }, hold: 10 },
  { t: 10, camera: { lng: 100, lat: 50, zoom: 4, pitch: 50, bearing: -10 }, hold: 10 },
];

describe('interpolateCamera', () => {
  it('holds first shot camera before pre-roll ends', () => {
    const cam = interpolateCamera(shots, 0.5, PRE_ROLL_S);
    expect(cam.lng).toBe(0);
    expect(cam.lat).toBe(0);
    expect(cam.zoom).toBe(5);
  });

  it('holds first shot camera at exactly PRE_ROLL_S', () => {
    const cam = interpolateCamera(shots, PRE_ROLL_S, PRE_ROLL_S);
    expect(cam.lng).toBe(0);
  });

  it('starts interpolating toward shot 2 after shot 1 start time', () => {
    // 0.5s into the 2s fly from shot 1 to shot 2
    const cam = interpolateCamera(shots, PRE_ROLL_S + 0.5, PRE_ROLL_S);
    expect(cam.lng).toBeGreaterThan(0);
    expect(cam.lng).toBeLessThan(100);
  });

  it('reaches shot 2 camera after FLY_DURATION_S', () => {
    // FLY_DURATION_S = 2; shot 2 starts at t=10, so at PRE_ROLL_S + 10 + 2 we should be at shot 2
    const cam = interpolateCamera(shots, PRE_ROLL_S + 10 + 2, PRE_ROLL_S);
    expect(cam.lng).toBeCloseTo(100, 1);
    expect(cam.lat).toBeCloseTo(50, 1);
  });

  it('holds last shot camera after its start time + fly duration', () => {
    const cam = interpolateCamera(shots, PRE_ROLL_S + 10 + 5, PRE_ROLL_S);
    expect(cam.lng).toBeCloseTo(100, 1);
  });

  it('easing is monotonically increasing (no overshoot)', () => {
    const values = [0, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0].map(dt =>
      interpolateCamera(shots, PRE_ROLL_S + dt, PRE_ROLL_S).lng
    );
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
    }
  });
});
