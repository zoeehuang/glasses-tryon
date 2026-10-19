import { describe, expect, it } from 'vitest';
import { evaluate, fitModel, labelFromPath, splitFromPath, type Sample } from './calibration';

const r = (lengthRatio: number, jawRatio: number, foreheadRatio: number) => ({
  lengthRatio,
  jawRatio,
  foreheadRatio,
});

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
    const model = fitModel(samples);
    expect(model.centroids.round?.lengthRatio).toBeCloseTo(1.1);
    expect(model.centroids.round?.jawRatio).toBeCloseTo(0.85);
    expect(model.centroids.oval?.lengthRatio).toBeCloseTo(1.5);
  });

  it('only includes shapes that have training faces', () => {
    expect(Object.keys(fitModel(samples).centroids).sort()).toEqual(['oval', 'round']);
  });

  it('measures how much each ratio varies within a shape', () => {
    // Each shape's lengths sit 0.1 either side of its average → pooled std of
    // sqrt(4 × 0.01 / (4 faces − 2 shapes)) ≈ 0.141.
    expect(fitModel(samples).scale.lengthRatio).toBeCloseTo(Math.sqrt(0.02), 3);
  });
});

describe('evaluate', () => {
  const model = fitModel([
    { label: 'round', split: 'train', ratios: r(1.0, 0.85, 0.8) },
    { label: 'round', split: 'train', ratios: r(1.02, 0.86, 0.79) },
    { label: 'oval', split: 'train', ratios: r(1.4, 0.75, 0.82) },
    { label: 'oval', split: 'train', ratios: r(1.42, 0.74, 0.8) },
  ]);

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
