import { describe, expect, it } from 'vitest';
import { classifyFaceShape, classifyFromRatios, createShapeVoter } from './faceShape';
import type { FaceShape, Landmark } from '../types';

type Dims = { h: number; w: number; cheek: number; jaw: number; fore: number; noseX?: number };

/** Build 478 landmarks where only the points the classifier reads are meaningful. */
function makeFace({ h, w, cheek, jaw, fore, noseX = 0.5 }: Dims): Landmark[] {
  const pts: Landmark[] = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  const put = (i: number, x: number, y: number) => {
    pts[i] = { x, y, z: 0 };
  };
  put(10, 0.5, 0.5 - h / 2); // top of forehead
  put(152, 0.5, 0.5 + h / 2); // chin
  put(234, 0.5 - w / 2, 0.5); // left edge of face
  put(454, 0.5 + w / 2, 0.5); // right edge of face
  put(116, 0.5 - cheek / 2, 0.5);
  put(345, 0.5 + cheek / 2, 0.5);
  put(172, 0.5 - jaw / 2, 0.5);
  put(397, 0.5 + jaw / 2, 0.5);
  put(70, 0.5 - fore / 2, 0.5);
  put(300, 0.5 + fore / 2, 0.5);
  put(1, noseX, 0.5); // nose tip
  return pts;
}

const oval: Dims = { h: 0.55, w: 0.4, cheek: 0.38, jaw: 0.31, fore: 0.31 };

const cases: Array<[FaceShape, Dims]> = [
  ['oval', oval],
  ['round', { h: 0.46, w: 0.45, cheek: 0.4, jaw: 0.32, fore: 0.3 }],
  ['square', { h: 0.5, w: 0.45, cheek: 0.4, jaw: 0.36, fore: 0.36 }],
  ['heart', { h: 0.55, w: 0.4, cheek: 0.38, jaw: 0.24, fore: 0.37 }],
  ['oblong', { h: 0.7, w: 0.4, cheek: 0.36, jaw: 0.3, fore: 0.3 }],
  ['diamond', { h: 0.55, w: 0.4, cheek: 0.4, jaw: 0.28, fore: 0.28 }],
];

describe('classifyFaceShape', () => {
  it.each(cases)('classifies a %s face', (expected, dims) => {
    expect(classifyFaceShape(makeFace(dims), 1, 1)).toBe(expected);
  });

  it('returns null when the head is turned', () => {
    expect(classifyFaceShape(makeFace({ ...oval, noseX: 0.62 }), 1, 1)).toBeNull();
  });

  it('returns null when there are too few landmarks', () => {
    expect(classifyFaceShape([], 1, 1)).toBeNull();
  });

  it('classifies a borderline face as its nearest shape instead of defaulting to oval', () => {
    // These ratios sit just outside the old square branch's strict
    // "lengthRatio < 1.15" condition (it's exactly 1.15), which used to fall
    // through every remaining branch and land on the oval default even
    // though the measurements are clearly closest to square.
    const dims: Dims = { h: 0.46, w: 0.4, cheek: 0.4, jaw: 0.352, fore: 0.348 };
    expect(classifyFaceShape(makeFace(dims), 1, 1)).toBe('square');
  });
});

describe('classifyFromRatios', () => {
  it('matches the real face-shape examples exactly', () => {
    for (const [expected, dims] of cases) {
      const ratios = {
        lengthRatio: dims.h / dims.w,
        jawRatio: dims.jaw / dims.cheek,
        foreheadRatio: dims.fore / dims.cheek,
      };
      expect(classifyFromRatios(ratios)).toBe(expected);
    }
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
