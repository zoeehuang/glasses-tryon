import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

type Props = {
  selected: boolean;
  onClick: () => void;
  title: string;
  color?: string;
  imageUrl?: string;
  children?: ReactNode;
};

/** A round swatch button (colour, pattern thumbnail, or custom content) with a clear, springy selected state. */
export function Swatch({ selected, onClick, title, color, imageUrl, children }: Props) {
  return (
    <motion.button
      type="button"
      title={title}
      aria-pressed={selected}
      onClick={onClick}
      animate={{ scale: selected ? 1.08 : 1 }}
      whileHover={{ scale: selected ? 1.08 : 1.06 }}
      whileTap={{ scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 500, damping: 22 }}
      className={`relative h-10 w-10 shrink-0 rounded-full bg-cover bg-center ${
        selected ? 'shadow-md ring-2 ring-emerald-600 ring-offset-2' : 'ring-1 ring-slate-200'
      }`}
      style={{
        backgroundColor: color,
        backgroundImage: imageUrl ? `url(${imageUrl})` : undefined,
      }}
    >
      {children}
      {selected && !children && (
        <motion.span
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 600, damping: 20 }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <svg
            viewBox="0 0 20 20"
            fill="none"
            className="h-4 w-4 drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.6)]"
          >
            <path
              d="M4 10.5l3.5 3.5L16 5.5"
              stroke="white"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </motion.span>
      )}
    </motion.button>
  );
}
