import { useState } from 'react';
import { FramePicker } from './components/FramePicker';
import { ShapePanel } from './components/ShapePanel';
import { TryOn } from './components/TryOn';
import { useFaceLandmarker } from './hooks/useFaceLandmarker';
import { FACE_SHAPE_INFO } from './lib/frames';
import type { FaceShape, FrameChoice } from './types';

export default function App() {
  const { landmarker, loading, error } = useFaceLandmarker();
  const [cameraOn, setCameraOn] = useState(false);
  const [frame, setFrame] = useState<FrameChoice>('aviator');
  const [shape, setShape] = useState<FaceShape | null>(null);

  const recommended = shape ? FACE_SHAPE_INFO[shape].recommended : [];

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      <header className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Glasses Try-On</h1>
        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-700">Beta</span>
      </header>
      <p className="text-sm text-slate-600">
        Your video is processed in your browser and is never uploaded.
      </p>
      <div className="grid gap-4 md:grid-cols-[1fr_300px]">
        <div className="space-y-3">
          {cameraOn && landmarker ? (
            <TryOn landmarker={landmarker} frame={frame} onShape={setShape} />
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
              {error ?? (loading ? 'Loading face model...' : 'Press "Start camera" to begin')}
            </div>
          )}
          <button
            type="button"
            disabled={loading || error !== null}
            onClick={() => setCameraOn((on) => !on)}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cameraOn ? 'Stop camera' : 'Start camera'}
          </button>
        </div>
        <ShapePanel shape={shape} onSelect={setFrame} />
      </div>
      <FramePicker selected={frame} recommended={recommended} onSelect={setFrame} />
    </main>
  );
}
