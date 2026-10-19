import type { FaceShape, Landmark } from '../types';

// The MediaPipe face mesh point numbers used for measuring.
const LM = {
  foreheadTop: 10,
  chin: 152,
  faceLeft: 234,
  faceRight: 454,
  cheekLeft: 116,
  cheekRight: 345,
  jawLeft: 172,
  jawRight: 397,
  foreheadLeft: 70,
  foreheadRight: 300,
  noseTip: 1,
} as const;

const MIN_LANDMARKS = 468;

export type FaceRatios = {
  /** Face height divided by face width — how long and narrow the face reads. */
  lengthRatio: number;
  /** Jaw width divided by cheekbone width — a wide jaw reads close to 1. */
  jawRatio: number;
  /** Forehead width divided by cheekbone width — a wide forehead reads close to 1. */
  foreheadRatio: number;
};

/**
 * Measures the three ratios the classifier uses, or null when there isn't
 * enough data or the head is turned too far for the ratios to be trusted.
 * Exposed on its own so the raw numbers can be shown in the UI — useful for
 * seeing exactly where a real face lands relative to the reference shapes
 * below, instead of only the final label.
 */
export function computeFaceRatios(lms: Landmark[], width: number, height: number): FaceRatios | null {
  if (lms.length < MIN_LANDMARKS) return null;

  const x = (i: number) => lms[i].x * width;
  const y = (i: number) => lms[i].y * height;

  // If the nose is far off-centre, the head is turned and the ratios can't be trusted.
  const leftGap = Math.abs(x(LM.noseTip) - x(LM.faceLeft));
  const rightGap = Math.abs(x(LM.faceRight) - x(LM.noseTip));
  if (rightGap === 0) return null;
  const turn = leftGap / rightGap;
  if (turn < 0.7 || turn > 1.43) return null;

  const faceH = Math.abs(y(LM.chin) - y(LM.foreheadTop));
  const faceW = Math.abs(x(LM.faceRight) - x(LM.faceLeft));
  const cheekW = Math.abs(x(LM.cheekRight) - x(LM.cheekLeft));
  const jawW = Math.abs(x(LM.jawRight) - x(LM.jawLeft));
  const foreheadW = Math.abs(x(LM.foreheadRight) - x(LM.foreheadLeft));

  if (faceW === 0 || cheekW === 0) return null;

  return {
    lengthRatio: faceH / faceW,
    jawRatio: jawW / cheekW,
    foreheadRatio: foreheadW / cheekW,
  };
}

// Reference ratios for each shape. Rather than hand-tuned threshold windows
// (which left gaps that nearly every real face fell through, always landing
// on the last "else" branch), classification is nearest-neighbour: whichever
// reference shape is closest in ratio-space wins, so there's no dead zone
// that silently defaults to one shape. These starting points describe each
// shape's textbook proportions; calibrate them against real measurements
// (visible in the UI) once you have more than a handful of test faces.
const REFERENCE_SHAPES: Record<FaceShape, FaceRatios> = {
  oval: { lengthRatio: 1.38, jawRatio: 0.82, foreheadRatio: 0.82 },
  round: { lengthRatio: 1.02, jawRatio: 0.8, foreheadRatio: 0.75 },
  square: { lengthRatio: 1.11, jawRatio: 0.9, foreheadRatio: 0.9 },
  heart: { lengthRatio: 1.38, jawRatio: 0.63, foreheadRatio: 0.97 },
  oblong: { lengthRatio: 1.75, jawRatio: 0.83, foreheadRatio: 0.83 },
  diamond: { lengthRatio: 1.38, jawRatio: 0.7, foreheadRatio: 0.7 },
};

// Each ratio is normalized by its spread across the reference shapes before
// computing distance, so lengthRatio (which naturally spans a wider numeric
// range than the other two) doesn't dominate the match just because its
// numbers are bigger.
const RATIO_KEYS = ['lengthRatio', 'jawRatio', 'foreheadRatio'] as const;
const RATIO_SCALE: Record<(typeof RATIO_KEYS)[number], number> = (() => {
  const scale = {} as Record<(typeof RATIO_KEYS)[number], number>;
  for (const key of RATIO_KEYS) {
    const values = Object.values(REFERENCE_SHAPES).map((r) => r[key]);
    const spread = Math.max(...values) - Math.min(...values);
    scale[key] = spread || 1;
  }
  return scale;
})();

/** Classifies already-measured ratios by nearest reference shape. */
export function classifyFromRatios(ratios: FaceRatios): FaceShape {
  let best: FaceShape = 'oval';
  let bestDist = Infinity;
  for (const [shape, ref] of Object.entries(REFERENCE_SHAPES) as [FaceShape, FaceRatios][]) {
    let dist = 0;
    for (const key of RATIO_KEYS) {
      const diff = (ratios[key] - ref[key]) / RATIO_SCALE[key];
      dist += diff * diff;
    }
    if (dist < bestDist) {
      bestDist = dist;
      best = shape;
    }
  }
  return best;
}

/**
 * Guess the face shape from face landmarks.
 * Returns null when there is not enough data or the head is turned too far.
 */
export function classifyFaceShape(
  lms: Landmark[],
  width: number,
  height: number,
): FaceShape | null {
  const ratios = computeFaceRatios(lms, width, height);
  return ratios ? classifyFromRatios(ratios) : null;
}

/**
 * Remembers the last few guesses and returns the most common one,
 * so the label doesn't flicker from frame to frame.
 */
export function createShapeVoter(windowSize = 25) {
  const history: FaceShape[] = [];
  return {
    push(shape: FaceShape): FaceShape {
      history.push(shape);
      if (history.length > windowSize) history.shift();
      const counts = new Map<FaceShape, number>();
      for (const s of history) counts.set(s, (counts.get(s) ?? 0) + 1);
      let best = shape;
      let bestCount = 0;
      for (const [s, count] of counts) {
        if (count > bestCount) {
          best = s;
          bestCount = count;
        }
      }
      return best;
    },
  };
}
