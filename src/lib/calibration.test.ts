import { describe, expect, it } from 'vitest';
import {
  evaluate,
  fitModel,
  invert,
  labelFromPath,
  splitFromPath,
  type FitOptions,
  type Sample,
} from './calibration';
import { FEATURE_NAMES, type FaceRatios } from './faceShape';

/** A face with the three main ratios set and every other measurement at 0. */
const r = (lengthRatio: number, jawRatio: number, foreheadRatio: number): FaceRatios => ({
  ...(Object.fromEntries(FEATURE_NAMES.map((f) => [f, 0])) as FaceRatios),
  lengthRatio,
  jawRatio,
  foreheadRatio,
});

const THREE_RATIOS: FitOptions = {
  features: ['lengthRatio', 'jawRatio', 'foreheadRatio'],
  correlated: false,
};

describe('labelFromPath', () => {
  it('reads the shape from the parent folder, ignoring case', () => {
    expect(labelFromPath('faces/train/Heart/img01.jpg')).toBe('heart');
    expect(labelFromPath('faces\\test\\OBLONG\\a.png')).toBe('oblong');
  });

  it('returns null for folders that are not a known shape', () => {
    expect(labelFromPath('faces/train/unsorted/img01.jpg')).toBeNull();
  });
});

describe('splitFromPath', () => {
  it('keeps a dataset’s own train/valid/test folders', () => {
    expect(splitFromPath('faces/test/Heart/a.jpg')).toBe('test');
    expect(splitFromPath('faces/train/Heart/a.jpg')).toBe('train');
    expect(splitFromPath('faces/valid/Heart/a.jpg')).toBe('train');
    expect(splitFromPath('faces/testing_set/Heart/a.jpg')).toBe('test');
    expect(splitFromPath('faces/training_set/Heart/a.jpg')).toBe('train');
  });

  it('splits roughly 80/20, the same way every time, when there are no split folders', () => {
    const paths = Array.from({ length: 1000 }, (_, i) => `faces/Heart/img${i}.jpg`);
    const testShare = paths.filter((p) => splitFromPath(p) === 'test').length / paths.length;
    expect(testShare).toBeGreaterThan(0.15);
    expect(testShare).toBeLessThan(0.25);
    expect(paths.map(splitFromPath)).toEqual(paths.map(splitFromPath));
  });
});

describe('fitModel', () => {
  const samples: Sample[] = [
    { label: 'round', split: 'train', ratios: r(1.0, 0.8, 0.8) },
    { label: 'round', split: 'train', ratios: r(1.2, 0.9, 0.8) },
    { label: 'oval', split: 'train', ratios: r(1.4, 0.7, 0.8) },
    { label: 'oval', split: 'train', ratios: r(1.6, 0.8, 0.8) },
    { label: 'oval', split: 'test', ratios: r(9, 9, 9) },
  ];

  it('averages each shape’s training faces, ignoring test faces', () => {
    const model = fitModel(samples, THREE_RATIOS);
    expect(model.features).toEqual(['lengthRatio', 'jawRatio', 'foreheadRatio']);
    expect(model.centroids.round?.[0]).toBeCloseTo(1.1);
    expect(model.centroids.round?.[1]).toBeCloseTo(0.85);
    expect(model.centroids.oval?.[0]).toBeCloseTo(1.5);
  });

  it('uses every measurement by default', () => {
    expect(fitModel(samples).features).toEqual(FEATURE_NAMES);
  });

  it('only includes shapes that have training faces', () => {
    expect(Object.keys(fitModel(samples).centroids).sort()).toEqual(['oval', 'round']);
  });

  it('measures how much each ratio varies within a shape', () => {
    // Each shape's lengths sit 0.1 either side of its average → pooled std of
    // sqrt(4 × 0.01 / (4 faces − 2 shapes)) ≈ 0.141.
    expect(fitModel(samples, THREE_RATIOS).scale[0]).toBeCloseTo(Math.sqrt(0.02), 3);
  });

  it('learns how measurements vary together only when asked to', () => {
    expect(fitModel(samples, THREE_RATIOS).precision).toBeUndefined();
    const model = fitModel(samples, { ...THREE_RATIOS, correlated: true });
    expect(model.precision).toHaveLength(3);
  });
});

describe('invert', () => {
  it('inverts a matrix so that the product is the identity', () => {
    const m = [
      [4, 1, 0.5],
      [1, 3, 0.2],
      [0.5, 0.2, 2],
    ];
    const inv = invert(m);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const product = m[i].reduce((sum, v, k) => sum + v * inv[k][j], 0);
        expect(product).toBeCloseTo(i === j ? 1 : 0, 10);
      }
    }
  });
});

describe('evaluate', () => {
  const model = fitModel(
    [
      { label: 'round', split: 'train', ratios: r(1.0, 0.85, 0.8) },
      { label: 'round', split: 'train', ratios: r(1.02, 0.86, 0.79) },
      { label: 'oval', split: 'train', ratios: r(1.4, 0.75, 0.82) },
      { label: 'oval', split: 'train', ratios: r(1.42, 0.74, 0.8) },
    ],
    THREE_RATIOS,
  );

  it('counts correct guesses, per shape and overall', () => {
    const result = evaluate(model, [
      { label: 'round', split: 'test', ratios: r(1.01, 0.85, 0.8) },
      { label: 'oval', split: 'test', ratios: r(1.41, 0.75, 0.81) },
      { label: 'oval', split: 'test', ratios: r(1.0, 0.86, 0.8) },
    ]);
    expect(result.correct).toBe(2);
    expect(result.accuracy).toBeCloseTo(2 / 3);
    expect(result.perShape.oval).toEqual({ total: 2, correct: 1 });
    expect(result.confusion.oval).toEqual({ oval: 1, round: 1 });
  });
});
