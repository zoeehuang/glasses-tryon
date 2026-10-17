type Props = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
  color?: string;
};

/** A range input with a filled track and a value badge, instead of the bare browser default. */
export function Slider({ label, value, min, max, step, onChange, formatValue, color }: Props) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold tabular-nums text-emerald-700">
          {formatValue ? formatValue(value) : value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="slider-track"
        style={{ '--pct': `${pct}%`, '--slider-color': color } as React.CSSProperties}
      />
    </div>
  );
}
