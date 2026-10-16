import type { Landmark } from '../types';

/** Blend new landmarks with the previous ones. Lower alpha = smoother but laggier. */
export function smoothLandmarks(
  previous: Landmark[] | null,
  next: Landmark[],
  alpha = 0.5,
): Landmark[] {
  if (!previous || previous.length !== next.length) {
    return next.map(({ x, y, z }) => ({ x, y, z }));
  }
  return next.map((p, i) => ({
    x: previous[i].x + (p.x - previous[i].x) * alpha,
    y: previous[i].y + (p.y - previous[i].y) * alpha,
    z: previous[i].z + (p.z - previous[i].z) * alpha,
  }));
}
