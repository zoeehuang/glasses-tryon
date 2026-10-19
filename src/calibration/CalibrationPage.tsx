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
import { computeFaceRatios, DEFAULT_MODEL, type ShapeModel } from '../lib/faceShape';
import type { FaceShape } from '../types';

const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|bmp)$/i;

type Progress = {
  total: number;
  done: number;
  unlabeled: number;
  noFace: number;
  unusable: number;
};

type Results = {
  samples: Sample[];
  model: ShapeModel;
  calibrated: Evaluation;
  current: Evaluation;
};

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

  // React's typings don't include `webkitdirectory`, the attribute that lets
  // the picker choose a whole folder.
  useEffect(() => {
    inputRef.current?.setAttribute('webkitdirectory', '');
  }, []);

  async function run(fileList: FileList) {
    if (!landmarker) return;
    const files = Array.from(fileList).filter((f) => IMAGE_EXTENSIONS.test(f.name));
    const root = files[0]?.webkitRelativePath.split('/')[0] ?? 'dataset';
    setDatasetName(root);
    setResults(null);
    const p: Progress = { total: files.length, done: 0, unlabeled: 0, noFace: 0, unusable: 0 };
    setProgress({ ...p });

    const samples: Sample[] = [];
    for (const file of files) {
      const path = file.webkitRelativePath || file.name;
      const label = labelFromPath(path);
      if (!label) {
        p.unlabeled += 1;
      } else {
        // Respect each photo's own rotation (phone photos store it separately).
        const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
        const lms = landmarker.detect(bitmap).faceLandmarks[0];
        const ratios = lms ? computeFaceRatios(lms, bitmap.width, bitmap.height) : null;
        bitmap.close();
        if (!lms) p.noFace += 1;
        else if (!ratios) p.unusable += 1;
        else samples.push({ label, split: splitFromPath(path), ratios });
      }
      p.done += 1;
      if (p.done % 10 === 0 || p.done === p.total) setProgress({ ...p });
    }

    const model = fitModel(samples);
    const test = samples.filter((s) => s.split === 'test');
    setResults({
      samples,
      model: {
        ...model,
        meta: {
          source: 'calibrated',
          dataset: root,
          trainCount: samples.length - test.length,
          testCount: test.length,
          testAccuracy: Number(evaluate(model, test).accuracy.toFixed(4)),
          createdAt: new Date().toISOString(),
        },
      },
      calibrated: evaluate(model, test),
      current: evaluate(DEFAULT_MODEL, test),
    });
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
        <label
          className={`inline-flex cursor-pointer items-center rounded-xl px-4 py-2.5 font-medium text-white shadow-sm ${
            loading || running ? 'pointer-events-none bg-slate-400' : 'bg-emerald-600 hover:bg-emerald-700'
          }`}
        >
          {loading ? 'Loading face model…' : running ? 'Measuring…' : 'Choose dataset folder'}
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && run(e.target.files)}
          />
        </label>

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
        <ResultsView results={results} datasetName={datasetName} />
      )}
    </main>
  );
}

function ResultsView({ results, datasetName }: { results: Results; datasetName: string }) {
  const { samples, model, calibrated, current } = results;
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
          <DownloadButton
            filename="faceShapeModel.json"
            data={model}
            label="Download model"
            primary
          />
          <DownloadButton filename="faceShapeSamples.json" data={samples} label="Download measurements" />
        </div>
        <p className="text-xs text-slate-500">
          To use the model, replace <code>src/lib/faceShapeModel.json</code> with the downloaded
          file.
        </p>
      </section>

      <section className="glass-panel space-y-3 rounded-2xl p-5">
        <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Per shape (calibrated model)
        </h2>
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th className="py-1 font-medium">Shape</th>
              <th className="py-1 font-medium">Correct</th>
              <th className="py-1 font-medium">Length ÷ width</th>
              <th className="py-1 font-medium">Jaw ÷ widest</th>
              <th className="py-1 font-medium">Forehead ÷ widest</th>
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
                  <td className="py-1.5">{c.lengthRatio.toFixed(3)}</td>
                  <td className="py-1.5">{c.jawRatio.toFixed(3)}</td>
                  <td className="py-1.5">{c.foreheadRatio.toFixed(3)}</td>
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
