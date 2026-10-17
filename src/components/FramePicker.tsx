import { motion } from 'framer-motion';
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
    <section className="glass-panel rounded-2xl p-4">
      <h2 className="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">
        Try on frames
      </h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {OPTIONS.map((option) => {
          const isSelected = option.id === selected;
          const isSuggested = option.id !== 'none' && recommended.includes(option.id);
          return (
            <motion.button
              key={option.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(option.id)}
              whileTap={{ scale: 0.96 }}
              className={`relative rounded-lg border px-3 py-2 text-sm transition-colors duration-150 ${
                isSelected
                  ? 'border-emerald-600 bg-emerald-50 font-medium text-emerald-900'
                  : 'border-slate-200/70 bg-white/40 text-slate-700 hover:border-slate-300 hover:bg-white/70'
              }`}
            >
              {isSelected && (
                <motion.span
                  layoutId="frame-pick-ring"
                  className="absolute inset-0 rounded-lg ring-2 ring-emerald-600"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative">{option.label}</span>
              {isSuggested && (
                <span
                  className="relative ml-2 inline-block h-2 w-2 rounded-full bg-emerald-500"
                  title="Suggested for your face shape"
                />
              )}
            </motion.button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        A green dot marks styles suggested for your face shape.
      </p>
    </section>
  );
}
