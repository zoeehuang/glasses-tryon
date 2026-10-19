import type { FaceShape, Landmark } from '../types';
import defaultModel from './faceShapeModel.json';

// MediaPipe's face outline: 36 points running around the edge of the face,
// top of forehead (10) → right side → chin (152) → left side → back to the top.
const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152,
  148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
] as const;
const TOP = 10;
const CHIN = 152;
const FACE_LEFT = 234;
const FACE_RIGHT = 454;
const NOSE_TIP = 1;
const EYE_LEFT_OUTER = 33;
const EYE_RIGHT_OUTER = 263;

const MIN_LANDMARKS = 468;

// Where each width is taken, as a fraction of the way from the top of the
// outline down to the chin. Exact anatomical accuracy matters less than
// consistency: the reference shapes are learned from faces measured this
// same way, so the definitions only have to be the same everywhere.
const FOREHEAD_LEVEL = 0.2;
const CHEEK_SEARCH_FROM = 0.3;
const CHEEK_SEARCH_TO = 0.6;
const JAW_LEVEL = 0.78;

export type FaceRatios = {
  /** Face height divided by its widest width — how long and narrow the face reads. */
  lengthRatio: number;
  /** Jaw width divided by the widest width — a wide jaw reads close to 1. */
  jawRatio: number;
  /** Forehead width divided by the widest width — a wide forehead reads close to 1. */
  foreheadRatio: number;
};

export type ShapeModel = {
  /** Average ratios for each shape. A shape left out is never predicted. */
  centroids: Partial<Record<FaceShape, FaceRatios>>;
  /** How much each ratio typically varies within one shape; distances are measured in these units. */
  scale: FaceRatios;
  meta?: {
    source: string;
    dataset?: string;
    trainCount?: number;
    testCount?: number;
    testAccuracy?: number;
    createdAt?: string;
  };
};

export const DEFAULT_MODEL = defaultModel as ShapeModel;

type Point = { x: number; y: number };

/** Width of a closed outline along the horizontal line at height `y`. */
function widthAtLevel(outline: Point[], y: number): number {
  const xs: number[] = [];
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % outline.length];
    if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
      xs.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x));
    }
  }
  return xs.length >= 2 ? Math.max(...xs) - Math.min(...xs) : 0;
}

/**
 * Measures the three ratios the classifier uses, or null when there isn't
 * enough data or the head is turned too far for the ratios to be trusted.
 *
 * Every width is read off the same face outline, at fixed heights, after
 * undoing head tilt. (Mixing outline points with points on the cheek's
 * surface — as an earlier version did — made the "cheekbone" width too
 * narrow, which inflated the other ratios and pushed most faces toward
 * square.)
 */
export function computeFaceRatios(lms: Landmark[], width: number, height: number): FaceRatios | null {
  if (lms.length < MIN_LANDMARKS) return null;
  const px = (i: number): Point => ({ x: lms[i].x * width, y: lms[i].y * height });

  // If the nose is far off-centre, the head is turned and the ratios can't be trusted.
  const nose = px(NOSE_TIP);
  const leftGap = Math.abs(nose.x - px(FACE_LEFT).x);
  const rightGap = Math.abs(px(FACE_RIGHT).x - nose.x);
  if (rightGap === 0) return null;
  const turn = leftGap / rightGap;
  if (turn < 0.7 || turn > 1.43) return null;

  // Undo head tilt so "horizontal" runs across the face, not across the frame.
  const a = px(EYE_LEFT_OUTER);
  const b = px(EYE_RIGHT_OUTER);
  let angle = Math.atan2(b.y - a.y, b.x - a.x);
  if (Math.abs(angle) > Math.PI / 2) angle -= Math.sign(angle) * Math.PI;
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  const level = (p: Point): Point => ({ x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos });

  const outline = FACE_OVAL.map((i) => level(px(i)));
  const top = level(px(TOP)).y;
  const faceH = level(px(CHIN)).y - top;
  if (faceH <= 0) return null;
  const widthAt = (fraction: number) => widthAtLevel(outline, top + fraction * faceH);

  let cheekW = 0;
  for (let f = CHEEK_SEARCH_FROM; f <= CHEEK_SEARCH_TO + 1e-9; f += 0.01) {
    cheekW = Math.max(cheekW, widthAt(f));
  }
  if (cheekW === 0) return null;

  return {
    lengthRatio: faceH / cheekW,
    jawRatio: widthAt(JAW_LEVEL) / cheekW,
    foreheadRatio: widthAt(FOREHEAD_LEVEL) / cheekW,
  };
}

const RATIO_KEYS = ['lengthRatio', 'jawRatio', 'foreheadRatio'] as const;

/**
 * Nearest-neighbour classification: whichever shape's average ratios are
 * closest wins, so there's no dead zone that silently defaults to one shape.
 * Each ratio's difference is divided by how much that ratio normally varies
 * within a shape, so no single ratio dominates just because its numbers are
 * bigger.
 */
export function classifyFromRatios(
  ratios: FaceRatios,
  model: ShapeModel = DEFAULT_MODEL,
): FaceShape | null {
  let best: FaceShape | null = null;
  let bestDist = Infinity;
  for (const [shape, centroid] of Object.entries(model.centroids) as [FaceShape, FaceRatios][]) {
    let dist = 0;
    for (const key of RATIO_KEYS) {
      const diff = (ratios[key] - centroid[key]) / model.scale[key];
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
  model: ShapeModel = DEFAULT_MODEL,
): FaceShape | null {
  const ratios = computeFaceRatios(lms, width, height);
  return ratios ? classifyFromRatios(ratios, model) : null;
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
