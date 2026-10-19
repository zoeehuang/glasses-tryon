import { useEffect, useRef, useState } from 'react';
import { useFaceLandmarker } from '../hooks/useFaceLandmarker';
import {
  evaluate,
  fitModel,
  labelFromPath,
  splitFromPath,
  type Evaluation,
  type Sample,
} from '../lib/calibration';
import {
  computeFaceRatios,
  DEFAULT_MODEL,
  type FeatureName,
  type ShapeModel,
} from '../lib/faceShape';
import type { FaceShape } from '../types';

const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|bmp)$/i;

type Progress = {
  total: number;
  done: number;
  unlabeled: number;
  noFace: number;
  unusable: number;
};

/** A photo to measure: its path inside the dataset, and how to read it. */
type Item = { path: string; load: () => Promise<Blob> };

type Variant = { method: string; model: ShapeModel; evaluation: Evaluation };

type Results = {
  samples: Sample[];
  /** The model to ship: every measurement, accounting for how they vary together. */
  model: ShapeModel;
  calibrated: Evaluation;
  current: Evaluation;
  /** Each step of the method on its own, so the gain from each is visible. */
  variants: Variant[];
};

const BASELINE_FEATURES: FeatureName[] = ['lengthRatio', 'jawRatio', 'foreheadRatio'];

/**
 * Dev-only: learns the face-shape reference model from a folder of labeled
 * photos. Every image is processed in this browser tab; nothing is uploaded.
 * Open with `?calibrate` on the dev server.
 */
export function CalibrationPage() {
  const { landmarker, loading, error } = useFaceLandmarker('IMAGE');
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [results, setResults] = useState<Results | null>(null);
  const [datasetName, setDatasetName] = useState('');
  const [saved, setSaved] = useState<string | null>(null);

  // React's typings don't include `webkitdirectory`, the attribute that lets
  // the picker choose a whole folder.
  useEffect(() => {
    inputRef.current?.setAttribute('webkitdirectory', '');
  }, []);

  function runFolder(fileList: FileList) {
    const items = Array.from(fileList)
      .filter((f) => IMAGE_EXTENSIONS.test(f.name))
      .map((f) => ({ path: f.webkitRelativePath || f.name, load: async () => f }));
    return run(items);
  }

  /** Reads the dataset folder the dev server exposes (see vite.config.ts). */
  async function runLocal() {
    const paths: string[] = await fetch('/__calibration/files').then((r) => r.json());
    const items = paths.map((path) => ({
      path,
      load: () =>
        fetch(`/__calibration/file?path=${encodeURIComponent(path)}`).then((r) => r.blob()),
    }));
    return run(items);
  }

  async function run(items: Item[]) {
    if (!landmarker) return;
    const root = items[0]?.path.split('/')[0] ?? 'dataset';
    setDatasetName(root);
    setResults(null);
    setSaved(null);
    const p: Progress = { total: items.length, done: 0, unlabeled: 0, noFace: 0, unusable: 0 };
    setProgress({ ...p });

    const samples: Sample[] = [];
    for (const item of items) {
      const label = labelFromPath(item.path);
      if (!label) {
        p.unlabeled += 1;
      } else {
        // Respect each photo's own rotation (phone photos store it separately).
        const bitmap = await createImageBitmap(await item.load(), { imageOrientation: 'from-image' });
        const lms = landmarker.detect(bitmap).faceLandmarks[0];
        const ratios = lms ? computeFaceRatios(lms, bitmap.width, bitmap.height) : null;
        bitmap.close();
        if (!lms) p.noFace += 1;
        else if (!ratios) p.unusable += 1;
        else samples.push({ label, split: splitFromPath(item.path), ratios });
      }
      p.done += 1;
      if (p.done % 10 === 0 || p.done === p.total) setProgress({ ...p });
    }

    const test = samples.filter((s) => s.split === 'test');
    const variants: Variant[] = [
      { method: '3 ratios, independent', options: { features: BASELINE_FEATURES, correlated: false } },
      { method: '3 ratios, correlated', options: { features: BASELINE_FEATURES } },
      { method: 'All 15 measurements, independent', options: { correlated: false } },
      { method: 'All 15 measurements, correlated', options: {} },
    ].map(({ method, options }) => {
      const model = fitModel(samples, options);
      return { method, model, evaluation: evaluate(model, test) };
    });
    const best = variants[variants.length - 1];
    setResults({
      samples,
      model: {
        ...best.model,
        meta: {
          source: 'calibrated',
          method: best.method,
          dataset: root,
          trainCount: samples.length - test.length,
          testCount: test.length,
          testAccuracy: Number(best.evaluation.accuracy.toFixed(4)),
          createdAt: new Date().toISOString(),
        },
      },
      calibrated: best.evaluation,
      current: evaluate(DEFAULT_MODEL, test),
      variants,
    });
  }

  async function save(model: ShapeModel) {
    const res = await fetch('/__calibration/model', {
      method: 'POST',
      body: JSON.stringify(model, null, 2) + '\n',
    });
    setSaved(res.ok ? 'Saved to src/lib/faceShapeModel.json' : `Save failed: ${await res.text()}`);
  }

  const running = progress !== null && progress.done < progress.total;

  return (
    <main className="mx-auto max-w-4xl space-y-5 p-6">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-semibold text-slate-900">Face shape calibration</h1>
        <p className="text-sm text-slate-600">
          Pick a folder of labeled face photos. Images are grouped by their folder name (oval,
          round, square, heart, oblong, diamond), and a <code>test</code> folder is held out for
          scoring. Everything runs in this tab — nothing is uploaded.
        </p>
      </header>

      <section className="glass-panel space-y-3 rounded-2xl p-5">
        {error && <p className="text-sm text-red-700">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading || running}
            onClick={runLocal}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 font-medium text-white shadow-sm hover:bg-emerald-700 disabled:bg-slate-400"
          >
            {loading ? 'Loading face model…' : running ? 'Measuring…' : 'Use local dataset'}
          </button>
          <label
            className={`inline-flex cursor-pointer items-center rounded-xl border border-slate-300 bg-white/70 px-4 py-2.5 font-medium text-slate-700 shadow-sm hover:bg-white ${
              loading || running ? 'pointer-events-none opacity-50' : ''
            }`}
          >
            Choose another folder
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && runFolder(e.target.files)}
            />
          </label>
        </div>

        {progress && (
          <div className="space-y-1.5">
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-emerald-600 transition-all"
                style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
              />
            </div>
            <p className="text-xs text-slate-600 tabular-nums">
              {progress.done} / {progress.total} photos · {progress.noFace} no face found ·{' '}
              {progress.unusable} head turned too far · {progress.unlabeled} not in a shape folder
            </p>
          </div>
        )}
      </section>

      {results && (
        <ResultsView
          results={results}
          datasetName={datasetName}
          saved={saved}
          onSave={() => save(results.model)}
        />
      )}
    </main>
  );
}

const SHOWN_FEATURES: [FeatureName, string, number][] = [
  ['lengthRatio', 'Length ÷ width', 3],
  ['jawRatio', 'Jaw ÷ widest', 3],
  ['foreheadRatio', 'Forehead ÷ widest', 3],
  ['chinAngle', 'Chin angle', 1],
  ['jawAngle', 'Jaw angle', 1],
];

function ResultsView({
  results,
  datasetName,
  saved,
  onSave,
}: {
  results: Results;
  datasetName: string;
  saved: string | null;
  onSave: () => void;
}) {
  const { samples, model, calibrated, current, variants } = results;
  const shapes = Object.keys(model.centroids) as FaceShape[];
  const trainCount = samples.length - calibrated.total;

  return (
    <>
      <section className="glass-panel space-y-4 rounded-2xl p-5">
        <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Accuracy on {calibrated.total} held-out photos
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <Stat label="Calibrated model" value={calibrated.accuracy} emphasis />
          <Stat label="Current model" value={current.accuracy} />
        </div>
        <p className="text-xs text-slate-500">
          Learned from {trainCount} training photos in “{datasetName}”. Chance would be about{' '}
          {Math.round(100 / Math.max(shapes.length, 1))}%.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onSave}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700"
          >
            Save model to project
          </button>
          <DownloadButton filename="faceShapeModel.json" data={model} label="Download model" />
          <DownloadButton filename="faceShapeSamples.json" data={samples} label="Download measurements" />
        </div>
        <p className="text-xs text-slate-500">
          {saved ?? (
            <>
              Saving writes <code>src/lib/faceShapeModel.json</code>; a downloaded model can replace
              it by hand.
            </>
          )}
        </p>
      </section>

      <section className="glass-panel space-y-3 rounded-2xl p-5">
        <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          What each step adds (same photos, same split)
        </h2>
        <table className="w-full text-sm tabular-nums">
          <tbody>
            {variants.map((v) => (
              <tr key={v.method} className="border-t border-slate-200/70 first:border-t-0">
                <td className="py-1.5">{v.method}</td>
                <td className="py-1.5 text-right">{percent(v.evaluation.accuracy)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="glass-panel space-y-3 rounded-2xl p-5">
        <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Per shape (calibrated model, averages)
        </h2>
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th className="py-1 font-medium">Shape</th>
              <th className="py-1 font-medium">Correct</th>
              {SHOWN_FEATURES.map(([, label]) => (
                <th key={label} className="py-1 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shapes.map((shape) => {
              const stats = calibrated.perShape[shape];
              const c = model.centroids[shape]!;
              return (
                <tr key={shape} className="border-t border-slate-200/70">
                  <td className="py-1.5 capitalize">{shape}</td>
                  <td className="py-1.5">
                    {stats ? `${stats.correct}/${stats.total} (${percent(stats.correct / stats.total)})` : '—'}
                  </td>
                  {SHOWN_FEATURES.map(([name, label, digits]) => (
                    <td key={label} className="py-1.5">
                      {c[model.features.indexOf(name)]?.toFixed(digits) ?? '—'}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="glass-panel space-y-3 rounded-2xl p-5">
        <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Confusion (rows = labeled, columns = predicted)
        </h2>
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th className="py-1 font-medium" />
              {shapes.map((s) => (
                <th key={s} className="py-1 font-medium capitalize">
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shapes.map((actual) => (
              <tr key={actual} className="border-t border-slate-200/70">
                <td className="py-1.5 capitalize">{actual}</td>
                {shapes.map((predicted) => {
                  const count = calibrated.confusion[actual]?.[predicted] ?? 0;
                  return (
                    <td
                      key={predicted}
                      className={`py-1.5 ${actual === predicted ? 'font-semibold text-emerald-700' : ''}`}
                    >
                      {count}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

function Stat({ label, value, emphasis }: { label: string; value: number; emphasis?: boolean }) {
  return (
    <div className="rounded-xl bg-white/60 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={`font-display text-3xl font-semibold tabular-nums ${
          emphasis ? 'text-emerald-700' : 'text-slate-700'
        }`}
      >
        {percent(value)}
      </p>
    </div>
  );
}

function DownloadButton({
  filename,
  data,
  label,
  primary,
}: {
  filename: string;
  data: unknown;
  label: string;
  primary?: boolean;
}) {
  function download() {
    const blob = new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <button
      type="button"
      onClick={download}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
        primary
          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
          : 'border border-slate-300 bg-white/70 text-slate-700 hover:bg-white'
      }`}
    >
      {label}
    </button>
  );
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
