import { AnimatePresence, motion } from 'framer-motion';
import type { FaceRatios } from '../lib/faceShape';
import { FACE_SHAPE_INFO, frameLabel } from '../lib/frames';
import type { FaceShape, FrameChoice } from '../types';

type Props = {
  shape: FaceShape | null;
  ratios?: FaceRatios | null;
  onSelect: (frame: FrameChoice) => void;
};

export function ShapePanel({ shape, ratios, onSelect }: Props) {
  if (!shape) {
    return (
      <section className="glass-panel rounded-2xl p-4">
        <h2 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Face shape
        </h2>
        <p className="text-sm text-slate-500">
          Start the camera and look straight at it to detect your face shape.
        </p>
      </section>
    );
  }

  const info = FACE_SHAPE_INFO[shape];

  return (
    <section className="glass-panel space-y-3 overflow-hidden rounded-2xl p-4">
      <div>
        <h2 className="mb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Face shape
        </h2>
        <AnimatePresence mode="wait">
          <motion.p
            key={shape}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="font-display text-2xl font-semibold text-slate-900"
          >
            {info.label}
          </motion.p>
        </AnimatePresence>
        <p className="mt-1 text-sm text-slate-600">{info.description}</p>
      </div>
      <div>
        <h3 className="mb-1 text-xs text-slate-500">Great for you</h3>
        <div className="flex flex-wrap gap-1">
          {info.recommended.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-800 transition hover:bg-emerald-100"
            >
              {frameLabel(id)}
            </button>
          ))}
        </div>
      </div>
      {info.avoid.length > 0 && (
        <div>
          <h3 className="mb-1 text-xs text-slate-500">Best to avoid</h3>
          <div className="flex flex-wrap gap-1">
            {info.avoid.map((id) => (
              <span key={id} className="rounded-full bg-red-50 px-3 py-1 text-xs text-red-700">
                {frameLabel(id)}
              </span>
            ))}
          </div>
        </div>
      )}
      {ratios && (
        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer font-medium text-slate-600 hover:text-slate-800">
            Measurements
          </summary>
          <dl className="mt-1.5 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 tabular-nums">
            <dt>Length ÷ width</dt>
            <dd>{ratios.lengthRatio.toFixed(2)}</dd>
            <dt>Jaw ÷ cheekbone</dt>
            <dd>{ratios.jawRatio.toFixed(2)}</dd>
            <dt>Forehead ÷ cheekbone</dt>
            <dd>{ratios.foreheadRatio.toFixed(2)}</dd>
            <dt>Chin angle</dt>
            <dd>{Math.round(ratios.chinAngle)}°</dd>
            <dt>Jaw angle</dt>
            <dd>{Math.round(ratios.jawAngle)}°</dd>
          </dl>
        </details>
      )}
      <p className="text-xs text-slate-400">General styling guidance, not professional advice.</p>
    </section>
  );
}
