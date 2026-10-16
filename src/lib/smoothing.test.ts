import { describe, expect, it } from 'vitest';
import { smoothLandmarks } from './smoothing';

describe('smoothLandmarks', () => {
  it('returns a copy of the new points when there is no history', () => {
    const next = [{ x: 0.2, y: 0.4, z: 0 }];
    expect(smoothLandmarks(null, next)).toEqual(next);
  });

  it('moves part of the way toward the new points', () => {
    const previous = [{ x: 0, y: 0, z: 0 }];
    const next = [{ x: 1, y: 1, z: 0 }];
    const [point] = smoothLandmarks(previous, next, 0.25);
    expect(point.x).toBeCloseTo(0.25);
    expect(point.y).toBeCloseTo(0.25);
  });
});
