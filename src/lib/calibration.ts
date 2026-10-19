import { classifyFromRatios, type FaceRatios, type ShapeModel } from './faceShape';
import type { FaceShape } from '../types';

export type Split = 'train' | 'test';

export type Sample = {
  label: FaceShape;
  split: Split;
  ratios: FaceRatios;
};

const KNOWN_SHAPES: FaceShape[] = ['oval', 'round', 'square', 'heart', 'oblong', 'diamond'];
const RATIO_KEYS = ['lengthRatio', 'jawRatio', 'foreheadRatio'] as const;

/** The face shape named by an image's folder, e.g. "train/Heart/img01.jpg" → "heart". */
export function labelFromPath(path: string): FaceShape | null {
  const parts = path.split(/[\\/]/);
  const folder = parts[parts.length - 2]?.toLowerCase();
  return KNOWN_SHAPES.find((s) => s === folder) ?? null;
}

/**
 * Which split an image belongs to. Datasets exported as train/valid/test
 * folders keep their own split (valid is used for training here, since
 * nothing is tuned against it separately); anything else gets a stable
 * 80/20 split from a hash of its path, so re-running gives the same split.
 */
export function splitFromPath(path: string): Split {
  const parts = path.toLowerCase().split(/[\\/]/);
  // Matches "test", "testing_set", "test-set", "train", "training_set", "valid", "validation", ...
  if (parts.some((p) => /^test(ing)?([_-]?set)?$/.test(p))) return 'test';
  if (parts.some((p) => /^(train(ing)?|valid(ation)?)([_-]?set)?$/.test(p))) return 'train';
  let hash = 5381;
  for (let i = 0; i < path.length; i++) hash = (hash * 33 + path.charCodeAt(i)) >>> 0;
  return hash % 5 === 0 ? 'test' : 'train';
}

/**
 * Learns a model from the training samples: each shape's centroid is the
 * average of its faces' ratios, and each ratio's scale is how much it
 * typically varies within a shape (pooled standard deviation). Shapes with no
 * training faces are left out, so they're never predicted.
 */
export function fitModel(samples: Sample[]): ShapeModel {
  const groups = new Map<FaceShape, FaceRatios[]>();
  for (const s of samples) {
    if (s.split !== 'train') continue;
    const group = groups.get(s.label) ?? [];
    group.push(s.ratios);
    groups.set(s.label, group);
  }

  const centroids: Partial<Record<FaceShape, FaceRatios>> = {};
  for (const [label, rs] of groups) {
    centroids[label] = {
      lengthRatio: average(rs.map((r) => r.lengthRatio)),
      jawRatio: average(rs.map((r) => r.jawRatio)),
      foreheadRatio: average(rs.map((r) => r.foreheadRatio)),
    };
  }

  const trainCount = [...groups.values()].reduce((n, rs) => n + rs.length, 0);
  const degreesOfFreedom = trainCount - groups.size;
  const scale = {} as FaceRatios;
  for (const key of RATIO_KEYS) {
    let sumSquares = 0;
    for (const [label, rs] of groups) {
      for (const r of rs) sumSquares += (r[key] - centroids[label]![key]) ** 2;
    }
    scale[key] = degreesOfFreedom > 0 ? Math.sqrt(sumSquares / degreesOfFreedom) || 1 : 1;
  }

  return { centroids, scale };
}

export type Evaluation = {
  total: number;
  correct: number;
  accuracy: number;
  perShape: Partial<Record<FaceShape, { total: number; correct: number }>>;
  /** confusion[actual][predicted] = count */
  confusion: Partial<Record<FaceShape, Partial<Record<FaceShape, number>>>>;
};

/** Scores a model on the given samples (normally the held-out test split). */
export function evaluate(model: ShapeModel, samples: Sample[]): Evaluation {
  const perShape: Evaluation['perShape'] = {};
  const confusion: Evaluation['confusion'] = {};
  let correct = 0;
  for (const s of samples) {
    const predicted = classifyFromRatios(s.ratios, model);
    const stats = (perShape[s.label] ??= { total: 0, correct: 0 });
    stats.total += 1;
    if (predicted === s.label) {
      stats.correct += 1;
      correct += 1;
    }
    if (predicted) {
      const row = (confusion[s.label] ??= {});
      row[predicted] = (row[predicted] ?? 0) + 1;
    }
  }
  return {
    total: samples.length,
    correct,
    accuracy: samples.length ? correct / samples.length : 0,
    perShape,
    confusion,
  };
}

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}
