import {
  classifyFromRatios,
  FEATURE_NAMES,
  type FaceRatios,
  type FeatureName,
  type ShapeModel,
} from './faceShape';
import type { FaceShape } from '../types';

export type Split = 'train' | 'test';

export type Sample = {
  label: FaceShape;
  split: Split;
  ratios: FaceRatios;
};

const KNOWN_SHAPES: FaceShape[] = ['oval', 'round', 'square', 'heart', 'oblong', 'diamond'];

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

export type FitOptions = {
  /** Which measurements to use (default: all of them). */
  features?: FeatureName[];
  /**
   * Account for measurements that vary together (default: true). Without it,
   * each measurement is treated as independent, so ten near-identical widths
   * would outvote everything else.
   */
  correlated?: boolean;
};

/** How far the correlation matrix is pulled toward "independent" before inverting, for stability. */
const SHRINKAGE = 0.05;

/**
 * Learns a model from the training samples: each shape's centroid is the
 * average of its faces' measurements, and each measurement's scale is how
 * much it typically varies within a shape (pooled standard deviation).
 * Shapes with no training faces are left out, so they're never predicted.
 */
export function fitModel(samples: Sample[], options: FitOptions = {}): ShapeModel {
  const features = options.features ?? FEATURE_NAMES;
  const correlated = options.correlated ?? true;
  const groups = new Map<FaceShape, number[][]>();
  for (const s of samples) {
    if (s.split !== 'train') continue;
    const group = groups.get(s.label) ?? [];
    group.push(features.map((f) => s.ratios[f]));
    groups.set(s.label, group);
  }

  const centroids: Partial<Record<FaceShape, number[]>> = {};
  for (const [label, rows] of groups) {
    centroids[label] = features.map((_, i) => average(rows.map((r) => r[i])));
  }

  // Each face's offset from its own shape's average.
  const residuals: number[][] = [];
  for (const [label, rows] of groups) {
    for (const r of rows) residuals.push(r.map((v, i) => v - centroids[label]![i]));
  }
  const degreesOfFreedom = residuals.length - groups.size;
  const scale = features.map((_, i) => {
    if (degreesOfFreedom <= 0) return 1;
    const sumSquares = residuals.reduce((sum, r) => sum + r[i] ** 2, 0);
    return Math.sqrt(sumSquares / degreesOfFreedom) || 1;
  });

  const model: ShapeModel = { features, centroids, scale };
  if (correlated && degreesOfFreedom > 0) {
    const n = features.length;
    const correlation = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => {
        if (i === j) return 1;
        const sum = residuals.reduce((acc, r) => acc + (r[i] / scale[i]) * (r[j] / scale[j]), 0);
        return (1 - SHRINKAGE) * (sum / degreesOfFreedom);
      }),
    );
    model.precision = invert(correlation);
  }
  return model;
}

/** Inverse of a symmetric positive-definite matrix, by Gauss–Jordan elimination. */
export function invert(matrix: number[][]): number[][] {
  const n = matrix.length;
  const a = matrix.map((row, i) => [...row, ...row.map((_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const p = a[col][col];
    if (Math.abs(p) < 1e-12) throw new Error('Matrix is not invertible');
    for (let j = 0; j < 2 * n; j++) a[col][j] /= p;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = a[r][col];
      if (factor !== 0) for (let j = 0; j < 2 * n; j++) a[r][j] -= factor * a[col][j];
    }
  }
  return a.map((row) => row.slice(n));
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
