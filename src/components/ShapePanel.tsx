import { FACE_SHAPE_INFO, frameLabel } from '../lib/frames';
import type { FaceShape, FrameChoice } from '../types';

type Props = {
  shape: FaceShape | null;
  onSelect: (frame: FrameChoice) => void;
};

export function ShapePanel({ shape, onSelect }: Props) {
  if (!shape) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
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
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div>
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Face shape
        </h2>
        <p className="text-2xl font-medium">{info.label}</p>
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
              className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-800 hover:bg-emerald-100"
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
      <p className="text-xs text-slate-400">General styling guidance, not professional advice.</p>
    </section>
  );
}
