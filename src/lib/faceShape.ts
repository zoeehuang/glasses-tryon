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

/**
 * Guess the face shape from face landmarks.
 * Returns null when there is not enough data or the head is turned too far.
 */
export function classifyFaceShape(
  lms: Landmark[],
  width: number,
  height: number,
): FaceShape | null {
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

  const lengthRatio = faceH / faceW;
  const jawRatio = jawW / cheekW;
  const foreheadRatio = foreheadW / cheekW;

  if (lengthRatio > 1.55) return 'oblong';
  if (jawRatio > 0.85 && foreheadRatio > 0.85 && lengthRatio < 1.15) return 'square';
  if (lengthRatio < 1.1 && jawRatio > 0.75) return 'round';
  if (foreheadRatio > 0.92 && jawRatio < 0.72) return 'heart';
  if (foreheadRatio < 0.78 && jawRatio < 0.78) return 'diamond';
  return 'oval';
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
