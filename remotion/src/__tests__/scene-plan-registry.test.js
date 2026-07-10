import { describe, it, expect } from 'vitest';
import { isOverlay, isCameraMove, getComponent } from '../scene-plan/registry.js';

describe('isOverlay', () => {
  it('returns true for lower-third', () => expect(isOverlay('lower-third')).toBe(true));
  it('returns true for stat-card',   () => expect(isOverlay('stat-card')).toBe(true));
  it('returns true for map-annotation', () => expect(isOverlay('map-annotation')).toBe(true));
  it('returns true for connection-arc', () => expect(isOverlay('connection-arc')).toBe(true));
  it('returns false for camera-move',  () => expect(isOverlay('camera-move')).toBe(false));
  it('returns false for unknown type', () => expect(isOverlay('unknown')).toBe(false));
});

describe('isCameraMove', () => {
  it('returns true for camera-move',   () => expect(isCameraMove('camera-move')).toBe(true));
  it('returns false for lower-third',  () => expect(isCameraMove('lower-third')).toBe(false));
  it('returns false for unknown type', () => expect(isCameraMove('unknown')).toBe(false));
});

describe('getComponent', () => {
  it('returns a function for lower-third', () => expect(typeof getComponent('lower-third')).toBe('function'));
  it('returns a function for stat-card',   () => expect(typeof getComponent('stat-card')).toBe('function'));
  it('returns a function for map-annotation', () => expect(typeof getComponent('map-annotation')).toBe('function'));
  it('returns a function for connection-arc', () => expect(typeof getComponent('connection-arc')).toBe('function'));
  it('returns a function for flow-arrow',     () => expect(typeof getComponent('flow-arrow')).toBe('function'));
  it('returns null for camera-move (not rendered)', () => expect(getComponent('camera-move')).toBeNull());
  it('returns null for unknown type',               () => expect(getComponent('unknown')).toBeNull());
});

describe('isOverlay flow-arrow', () => {
  it('returns true for flow-arrow', () => expect(isOverlay('flow-arrow')).toBe(true));
});
