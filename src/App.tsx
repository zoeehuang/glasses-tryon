import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FramePicker } from './components/FramePicker';
import { GlassesHeroIcon } from './components/GlassesHeroIcon';
import { ShapePanel } from './components/ShapePanel';
import { Slider } from './components/Slider';
import { Swatch } from './components/Swatch';
import { TryOn } from './components/TryOn';
import {
  DEFAULT_FRAME_OPTIONS,
  DEFAULT_LENS_OPTIONS,
  type FrameOptions,
  type LensOptions,
} from './lib/drawGlasses';
import { useFaceLandmarker } from './hooks/useFaceLandmarker';
import { FACE_SHAPE_INFO } from './lib/frames';
import {
  loadPatternImages,
  PATTERN_LINE_COLORS,
  PATTERN_URLS,
  type PatternName,
} from './lib/patternImages';
import type { FaceShape, FrameChoice } from './types';

export default function App() {
  const { landmarker, loading, error } = useFaceLandmarker();
  const [cameraOn, setCameraOn] = useState(false);
  const [frame, setFrame] = useState<FrameChoice>('aviator');
  const [shape, setShape] = useState<FaceShape | null>(null);
  const [lensOptions, setLensOptions] = useState<LensOptions>(DEFAULT_LENS_OPTIONS);
  const [frameOptions, setFrameOptions] = useState<FrameOptions>(DEFAULT_FRAME_OPTIONS);
  const [patternImages, setPatternImages] = useState<Record<PatternName, HTMLImageElement> | null>(
    null,
  );

  useEffect(() => {
    loadPatternImages().then(setPatternImages);
  }, []);

  const recommended = shape ? FACE_SHAPE_INFO[shape].recommended : [];

  return (
    <>
      <div className="aurora-bg">
        <div className="aurora-blob" />
      </div>
      <main className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
        <motion.header
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="flex flex-col items-center gap-2 py-4 text-center sm:py-6"
        >
          <GlassesHeroIcon />
          <h1 className="font-display mt-1 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            See yourself, styled.
          </h1>
          <p className="max-w-md text-sm text-slate-600 sm:text-base">
            Real-time virtual try-on that detects your face shape and suggests frames — entirely
            in your browser, nothing ever uploaded.
          </p>
        </motion.header>

        <Stagger delay={0.08}>
          <FramePicker selected={frame} recommended={recommended} onSelect={setFrame} />
          <div className="grid gap-4 md:grid-cols-[1fr_300px]">
            <div className="space-y-3">
              {cameraOn && landmarker ? (
                <TryOn
                  landmarker={landmarker}
                  frame={frame}
                  onShape={setShape}
                  lensOptions={lensOptions}
                  frameOptions={frameOptions}
                />
              ) : (
                <div className="glass-panel flex aspect-[4/3] flex-col items-center justify-center gap-3 rounded-2xl p-6 text-center text-sm text-slate-500">
                  {loading && !error && (
                    <svg
                      className="h-6 w-6 animate-spin text-slate-400"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                      />
                    </svg>
                  )}
                  <span>
                    {error ?? (loading ? 'Loading face model...' : 'Press "Start camera" to begin')}
                  </span>
                </div>
              )}
              <motion.button
                type="button"
                disabled={loading || error !== null}
                onClick={() => setCameraOn((on) => !on)}
                whileHover={{ scale: loading || error ? 1 : 1.015 }}
                whileTap={{ scale: loading || error ? 1 : 0.985 }}
                className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 hover:shadow disabled:cursor-not-allowed disabled:opacity-50"
              >
                {cameraOn ? 'Stop camera' : 'Start camera'}
              </motion.button>
            </div>
            <div className="space-y-3">
              <ShapePanel shape={shape} onSelect={setFrame} />
              <TuningTabs
                frameOptions={frameOptions}
                onFrameOptionsChange={setFrameOptions}
                lensOptions={lensOptions}
                onLensOptionsChange={setLensOptions}
                patternImages={patternImages}
              />
            </div>
          </div>
        </Stagger>
      </main>
    </>
  );
}

/** Fades and slides each direct child in with a small stagger, for a livelier page entrance. */
function Stagger({ children, delay = 0.1 }: { children: React.ReactNode; delay?: number }) {
  const items = Array.isArray(children) ? children : [children];
  return (
    <>
      {items.map((child, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: i * delay, ease: 'easeOut' }}
        >
          {child}
        </motion.div>
      ))}
    </>
  );
}

type TuningTabsProps = {
  frameOptions: FrameOptions;
  onFrameOptionsChange: (value: FrameOptions) => void;
  lensOptions: LensOptions;
  onLensOptionsChange: (value: LensOptions) => void;
  patternImages: Record<PatternName, HTMLImageElement> | null;
};

/** Switches between the frame and lens tuning panels instead of stacking both, so the page doesn't grow every time a control is added. */
function TuningTabs({
  frameOptions,
  onFrameOptionsChange,
  lensOptions,
  onLensOptionsChange,
  patternImages,
}: TuningTabsProps) {
  const [tab, setTab] = useState<'frame' | 'lens'>('frame');
  return (
    <section className="glass-panel rounded-2xl p-4">
      <div className="mb-4 flex gap-1 rounded-lg bg-slate-900/5 p-1 text-sm">
        {(['frame', 'lens'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`relative flex-1 rounded-md py-1.5 font-medium capitalize transition-colors duration-150 ${
              tab === t ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab === t && (
              <motion.span
                layoutId="tuning-tab-pill"
                className="absolute inset-0 rounded-md bg-white shadow-sm"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <span className="relative">{t}</span>
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, x: tab === 'frame' ? -8 : 8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          {tab === 'frame' ? (
            <FrameTuning
              value={frameOptions}
              onChange={onFrameOptionsChange}
              patternImages={patternImages}
            />
          ) : (
            <LensTuning value={lensOptions} onChange={onLensOptionsChange} />
          )}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

const FRAME_COLOR_PRESETS: { label: string; color: string }[] = [
  { label: 'Black', color: '#1a1a1a' },
  { label: 'Tortoise', color: '#6b4a2c' },
  { label: 'Gold', color: '#b08d3c' },
  { label: 'Silver', color: '#9aa0a6' },
  { label: 'Rose gold', color: '#c9897a' },
  { label: 'Red', color: '#8a1f2d' },
  { label: 'Navy', color: '#1e2a4a' },
  { label: 'White', color: '#e8e4de' },
];

type FrameTuningProps = {
  value: FrameOptions;
  onChange: (value: FrameOptions) => void;
  patternImages: Record<PatternName, HTMLImageElement> | null;
};

/** Recolours the frame rim live, or transplants a material pattern onto it, keeping the photo's own shading either way. */
function FrameTuning({ value, onChange, patternImages }: FrameTuningProps) {
  const isOriginal = value.colorOverride === null && value.patternOverride === null;
  return (
    <div className="space-y-4">
      <TuningSection
        title="Frame colour"
        action={
          !isOriginal && (
            <ResetLink
              onClick={() => onChange({ ...value, colorOverride: null, patternOverride: null })}
            />
          )
        }
      >
        <div className="flex flex-wrap gap-2.5">
          <Swatch
            selected={isOriginal}
            onClick={() => onChange({ ...value, colorOverride: null, patternOverride: null })}
            title="Original"
          >
            <span className="flex h-full w-full items-center justify-center rounded-full bg-[conic-gradient(from_0deg,#f3f4f6,#e5e7eb,#f3f4f6)] text-[9px] font-semibold text-slate-500">
              Orig
            </span>
          </Swatch>
          {FRAME_COLOR_PRESETS.map((preset) => (
            <Swatch
              key={preset.label}
              title={preset.label}
              color={preset.color}
              selected={value.colorOverride === preset.color}
              onClick={() =>
                onChange({ ...value, colorOverride: preset.color, patternOverride: null })
              }
            />
          ))}
          <input
            type="color"
            title="Custom colour"
            value={value.colorOverride ?? '#1a1a1a'}
            onChange={(e) =>
              onChange({ ...value, colorOverride: e.target.value, patternOverride: null })
            }
            className="color-swatch"
          />
        </div>
      </TuningSection>

      <TuningSection title="Material pattern">
        <div className="flex flex-wrap gap-2.5">
          {(Object.keys(PATTERN_URLS) as PatternName[]).map((name) => (
            <Swatch
              key={name}
              title={name}
              imageUrl={PATTERN_URLS[name]}
              selected={Boolean(value.patternOverride) && value.patternOverride === patternImages?.[name]}
              onClick={() =>
                patternImages &&
                onChange({
                  ...value,
                  colorOverride: null,
                  patternOverride: patternImages[name],
                  patternLineColor: PATTERN_LINE_COLORS[name],
                })
              }
            />
          ))}
        </div>
        {value.patternOverride && (
          <Slider
            label="Pattern scale"
            value={value.patternScale}
            min={0.5}
            max={5}
            step={0.1}
            formatValue={(v) => `${v.toFixed(1)}x`}
            onChange={(v) => onChange({ ...value, patternScale: v })}
          />
        )}
      </TuningSection>
    </div>
  );
}

const LENS_TINT_PRESETS: { label: string; color: string }[] = [
  { label: 'Classic grey', color: '#3a3a3a' },
  { label: 'Green G15', color: '#4a5d3a' },
  { label: 'Amber', color: '#8a5a2a' },
  { label: 'Blue mirror', color: '#3a5a7a' },
  { label: 'Rose', color: '#8a4a5a' },
  { label: 'Black', color: '#1a1a1a' },
];

type LensTuningProps = {
  value: LensOptions;
  onChange: (value: LensOptions) => void;
};

/** Live tuning for the procedural lens tint, so it can be dialed in without a code change. */
function LensTuning({ value, onChange }: LensTuningProps) {
  return (
    <div className="space-y-4">
      <TuningSection
        title="Tint colour"
        action={
          value.tintOverride !== null && (
            <ResetLink onClick={() => onChange({ ...value, tintOverride: null })} />
          )
        }
      >
        <div className="flex flex-wrap gap-2.5">
          <Swatch
            selected={value.tintOverride === null}
            onClick={() => onChange({ ...value, tintOverride: null })}
            title="Auto (each frame's own tint)"
          >
            <span className="flex h-full w-full items-center justify-center rounded-full bg-[conic-gradient(from_0deg,#f3f4f6,#e5e7eb,#f3f4f6)] text-[9px] font-semibold text-slate-500">
              Auto
            </span>
          </Swatch>
          {LENS_TINT_PRESETS.map((preset) => (
            <Swatch
              key={preset.label}
              title={preset.label}
              color={preset.color}
              selected={value.tintOverride === preset.color}
              onClick={() => onChange({ ...value, tintOverride: preset.color })}
            />
          ))}
          <input
            type="color"
            title="Custom tint"
            value={value.tintOverride ?? '#3a3a3a'}
            onChange={(e) => onChange({ ...value, tintOverride: e.target.value })}
            className="color-swatch"
          />
        </div>
        <Slider
          label="Opacity"
          value={value.opacity}
          min={0}
          max={1}
          step={0.01}
          formatValue={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => onChange({ ...value, opacity: v })}
        />
      </TuningSection>
    </div>
  );
}

type TuningSectionProps = {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
};

/** A consistent labeled group for a cluster of controls, with an optional reset link. */
function TuningSection({ title, action, children }: TuningSectionProps) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function ResetLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs font-medium text-emerald-700 transition hover:text-emerald-800 hover:underline"
    >
      Reset
    </button>
  );
}
