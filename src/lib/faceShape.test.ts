import { describe, expect, it } from 'vitest';
import {
  classifyFromRatios,
  computeFaceRatios,
  createShapeVoter,
  FEATURE_NAMES,
  type FaceRatios,
  type ShapeModel,
} from './faceShape';
import type { Landmark } from '../types';

// Same order MediaPipe uses: top (10) → right side → chin (152) → left side.
const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152,
  148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
];

type Profile = {
  /** Face height (top of outline to chin). */
  h: number;
  /** Widths at the top, forehead, cheekbone and jaw levels. */
  top: number;
  fore: number;
  cheek: number;
  jaw: number;
  noseX?: number;
  rollDeg?: number;
};

/** Width of the synthetic face at fraction `t` of the way down, as a piecewise-linear profile. */
function widthAt(t: number, p: Profile): number {
  const knots: [number, number][] = [
    [0, p.top],
    [0.2, p.fore],
    [0.45, p.cheek],
    [0.78, p.jaw],
    [1, 0],
  ];
  for (let i = 0; i < knots.length - 1; i++) {
    const [t0, w0] = knots[i];
    const [t1, w1] = knots[i + 1];
    if (t <= t1) return w0 + ((t - t0) / (t1 - t0)) * (w1 - w0);
  }
  return 0;
}

/** Build 478 landmarks: a face outline with the given profile, plus eyes and nose tip. */
function makeFace(p: Profile): Landmark[] {
  const cx = 0.5;
  const top = 0.5 - p.h / 2;
  const pts: Landmark[] = Array.from({ length: 478 }, () => ({ x: cx, y: 0.5, z: 0 }));
  const sideCount = (FACE_OVAL.length - 2) / 2; // points strictly between top and chin, per side
  FACE_OVAL.forEach((index, i) => {
    // Right side runs down from the top; left side runs back up from the chin.
    const step = i <= sideCount + 1 ? i : FACE_OVAL.length - i;
    const t = step / (sideCount + 1);
    const half = widthAt(t, p) / 2;
    const side = i === 0 || i === sideCount + 1 ? 0 : i <= sideCount ? 1 : -1;
    pts[index] = { x: cx + side * half, y: top + t * p.h, z: 0 };
  });
  pts[33] = { x: cx - 0.09, y: top + 0.4 * p.h, z: 0 };
  pts[263] = { x: cx + 0.09, y: top + 0.4 * p.h, z: 0 };
  pts[1] = { x: p.noseX ?? cx, y: top + 0.55 * p.h, z: 0 };

  const roll = ((p.rollDeg ?? 0) * Math.PI) / 180;
  if (roll === 0) return pts;
  const cos = Math.cos(roll);
  const sin = Math.sin(roll);
  return pts.map(({ x, y, z }) => ({
    x: cx + (x - cx) * cos - (y - 0.5) * sin,
    y: 0.5 + (x - cx) * sin + (y - 0.5) * cos,
    z,
  }));
}

const face: Profile = { h: 0.55, top: 0.18, fore: 0.3, cheek: 0.4, jaw: 0.32 };

describe('computeFaceRatios', () => {
  it('reads length, jaw and forehead ratios off the face outline', () => {
    const ratios = computeFaceRatios(makeFace(face), 1, 1);
    expect(ratios).not.toBeNull();
    expect(ratios!.lengthRatio).toBeCloseTo(face.h / face.cheek, 1);
    expect(ratios!.jawRatio).toBeCloseTo(face.jaw / face.cheek, 1);
    expect(ratios!.foreheadRatio).toBeCloseTo(face.fore / face.cheek, 1);
  });

  it('reads the width profile at ten heights, relative to the widest width', () => {
    const ratios = computeFaceRatios(makeFace(face), 1, 1)!;
    expect(ratios.width45).toBeCloseTo(1, 1);
    expect(ratios.width5).toBeLessThan(ratios.width25);
    expect(ratios.width95).toBeLessThan(ratios.width75);
    expect(ratios.width75).toBeCloseTo(widthAt(0.75, face) / face.cheek, 1);
  });

  it('reads a smaller chin angle for a pointed chin', () => {
    const broad = computeFaceRatios(makeFace({ ...face, jaw: 0.38 }), 1, 1)!;
    const pointed = computeFaceRatios(makeFace({ ...face, jaw: 0.24 }), 1, 1)!;
    expect(pointed.chinAngle).toBeLessThan(broad.chinAngle);
  });

  it('reads a smaller jaw angle for a squarer jaw', () => {
    const square = computeFaceRatios(makeFace({ ...face, jaw: 0.4 }), 1, 1)!;
    const tapered = computeFaceRatios(makeFace({ ...face, jaw: 0.26 }), 1, 1)!;
    expect(square.jawAngle).toBeLessThan(tapered.jawAngle);
  });

  it('gives the same measurements when the head is tilted', () => {
    const level = computeFaceRatios(makeFace(face), 1, 1)!;
    const tilted = computeFaceRatios(makeFace({ ...face, rollDeg: 15 }), 1, 1)!;
    for (const name of FEATURE_NAMES) {
      // Angles are in degrees, so allow them a proportionally looser match.
      expect(tilted[name], name).toBeCloseTo(level[name], name.endsWith('Angle') ? 0 : 2);
    }
  });

  it('returns null when the head is turned', () => {
    expect(computeFaceRatios(makeFace({ ...face, noseX: 0.62 }), 1, 1)).toBeNull();
  });

  it('returns null when there are too few landmarks', () => {
    expect(computeFaceRatios([], 1, 1)).toBeNull();
  });
});

describe('classifyFromRatios', () => {
  const features: ShapeModel['features'] = ['lengthRatio', 'jawRatio', 'foreheadRatio'];
  const model: ShapeModel = {
    features,
    centroids: {
      oval: [1.3, 0.8, 0.8],
      round: [1.0, 0.85, 0.8],
      heart: [1.3, 0.65, 0.95],
    },
    scale: [0.1, 0.05, 0.05],
  };

  it('picks the nearest shape', () => {
    const nearRound: Partial<FaceRatios> = { lengthRatio: 1.04, jawRatio: 0.84, foreheadRatio: 0.79 };
    expect(classifyFromRatios(nearRound, model)).toBe('round');
  });

  it('always picks some shape — there is no fallback default', () => {
    const farFromEverything: Partial<FaceRatios> = { lengthRatio: 3, jawRatio: 0.1, foreheadRatio: 2 };
    expect(classifyFromRatios(farFromEverything, model)).not.toBeNull();
  });

  it('weighs each ratio by how much it varies within a shape', () => {
    const twoShapes: ShapeModel = {
      features,
      centroids: { round: [1.0, 0.8, 0.8], oval: [1.25, 0.86, 0.8] },
      scale: [0.1, 0.05, 0.05],
    };
    // Unweighted, this sample is nearer round (0.12 away vs 0.15). But jaw
    // width varies less within a shape than length does, so its 0.06 jaw gap
    // from round outweighs its larger length gap from oval.
    const sample: Partial<FaceRatios> = { lengthRatio: 1.1, jawRatio: 0.86, foreheadRatio: 0.8 };
    expect(classifyFromRatios(sample, twoShapes)).toBe('oval');
  });

  it('counts measurements that move together once, given their correlation', () => {
    // Two copies of the same measurement (jaw) against one length measurement.
    // Treated as independent, the copies outvote length; with the correlation
    // known, they count once and length decides.
    const base: ShapeModel = {
      features: ['lengthRatio', 'jawRatio', 'width75'],
      centroids: { round: [1.0, 0.8, 0.8], oval: [1.25, 1.03, 1.03] },
      scale: [0.1, 0.1, 0.1],
    };
    const sample: Partial<FaceRatios> = { lengthRatio: 1.2, jawRatio: 0.85, width75: 0.85 };
    expect(classifyFromRatios(sample, base)).toBe('round');
    // Inverse of [[1, 0, 0], [0, 1, 0.99], [0, 0.99, 1]].
    const k = 1 / (1 - 0.99 ** 2);
    const correlated = { ...base, precision: [[1, 0, 0], [0, k, -0.99 * k], [0, -0.99 * k, k]] };
    expect(classifyFromRatios(sample, correlated)).toBe('oval');
  });

  it('never predicts a shape the model has no data for', () => {
    const shapes = new Set<string>();
    for (let l = 0.8; l <= 2; l += 0.1) {
      for (let j = 0.5; j <= 1; j += 0.1) {
        shapes.add(classifyFromRatios({ lengthRatio: l, jawRatio: j, foreheadRatio: 0.8 }, model)!);
      }
    }
    expect([...shapes].every((s) => s in model.centroids)).toBe(true);
  });
});

describe('createShapeVoter', () => {
  it('returns the most common recent shape', () => {
    const voter = createShapeVoter(5);
    voter.push('oval');
    voter.push('oval');
    voter.push('oval');
    expect(voter.push('round')).toBe('oval');
  });

  it('forgets old votes once the window is full', () => {
    const voter = createShapeVoter(3);
    voter.push('oval');
    voter.push('round');
    voter.push('round');
    expect(voter.push('round')).toBe('round');
  });
});
