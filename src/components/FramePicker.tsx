import { FRAME_STYLES } from '../lib/frames';
import type { FrameChoice, FrameStyle } from '../types';

type Props = {
  selected: FrameChoice;
  recommended: FrameStyle[];
  onSelect: (frame: FrameChoice) => void;
};

const OPTIONS: { id: FrameChoice; label: string }[] = [
  { id: 'none', label: 'No frames' },
  ...FRAME_STYLES,
];

export function FramePicker({ selected, recommended, onSelect }: Props) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Try on frames
      </h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {OPTIONS.map((option) => {
          const isSelected = option.id === selected;
          const isSuggested = option.id !== 'none' && recommended.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(option.id)}
              className={`rounded-lg border px-3 py-2 text-sm transition ${
                isSelected
                  ? 'border-emerald-600 bg-emerald-50 font-medium'
                  : 'border-slate-200 hover:border-slate-400'
              }`}
            >
              {option.label}
              {isSuggested && (
                <span
                  className="ml-2 inline-block h-2 w-2 rounded-full bg-emerald-500"
                  title="Suggested for your face shape"
                />
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        A green dot marks styles suggested for your face shape.
      </p>
    </section>
  );
}
