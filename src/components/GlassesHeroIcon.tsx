import { motion } from 'framer-motion';

/** A floating line-art pair of glasses for the hero — sets the tone before the camera ever starts. */
export function GlassesHeroIcon() {
  return (
    <motion.svg
      viewBox="0 0 160 70"
      className="h-16 w-auto text-slate-900 drop-shadow-sm sm:h-20"
      initial={{ opacity: 0, y: -8, rotate: -6 }}
      animate={{ opacity: 1, y: [0, -6, 0], rotate: [-4, 2, -4] }}
      transition={{
        opacity: { duration: 0.6 },
        y: { duration: 5, repeat: Infinity, ease: 'easeInOut' },
        rotate: { duration: 7, repeat: Infinity, ease: 'easeInOut' },
      }}
    >
      <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
        <circle cx="40" cy="35" r="26" />
        <circle cx="120" cy="35" r="26" />
        <path d="M66 32c4-6 24-6 28 0" />
        <path d="M14 30 L2 24" />
        <path d="M146 30 L158 24" />
      </g>
    </motion.svg>
  );
}
