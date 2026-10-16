import type { FrameStyle, Landmark } from '../types';

type Corners = [number, number, number, number]; // top-left, top-right, bottom-right, bottom-left

type Spec = {
  heightRatio: number; // lens height as a fraction of lens width
  radii: (w: number, h: number) => Corners; // how rounded each corner is
  stroke: number; // frame thickness as a fraction of lens width
  color: string;
  tilt?: number; // radians the outer edge of each lens is raised
  browBar?: boolean; // thick bar across the top of the lens
};

const even = (r: number): Corners => [r, r, r, r];

const SPECS: Record<FrameStyle, Spec> = {
  round: { heightRatio: 0.95, radii: (_w, h) => even(h / 2), stroke: 0.05, color: '#5b3a1e' },
  square: { heightRatio: 0.85, radii: (w) => even(w * 0.06), stroke: 0.06, color: '#1a1a1a' },
  rectangle: { heightRatio: 0.6, radii: (w) => even(w * 0.05), stroke: 0.05, color: '#2b2f3a' },
  aviator: {
    heightRatio: 0.85,
    radii: (w) => [w * 0.1, w * 0.1, w * 0.45, w * 0.45],
    stroke: 0.035,
    color: '#b08d3c',
  },
  wayfarer: {
    heightRatio: 0.7,
    radii: (w) => [w * 0.04, w * 0.04, w * 0.28, w * 0.28],
    stroke: 0.11,
    color: '#111111',
  },
  browline: {
    heightRatio: 0.7,
    radii: (w) => [w * 0.02, w * 0.02, w * 0.3, w * 0.3],
    stroke: 0.03,
    color: '#222222',
    browBar: true,
  },
  cateye: {
    heightRatio: 0.7,
    radii: (w) => [w * 0.14, w * 0.14, w * 0.3, w * 0.3],
    stroke: 0.06,
    color: '#7a1f3d',
    tilt: 0.22,
  },
};

// MediaPipe face mesh point numbers.
const EYE_LEFT_OUTER = 33;
const EYE_RIGHT_OUTER = 263;
const EAR_LEFT = 234;
const EAR_RIGHT = 454;

export function drawGlasses(
  ctx: CanvasRenderingContext2D,
  lms: Landmark[],
  width: number,
  height: number,
  style: FrameStyle,
): void {
  const spec = SPECS[style];
  const point = (i: number) => ({ x: lms[i].x * width, y: lms[i].y * height });

  const a = point(EYE_LEFT_OUTER);
  const b = point(EYE_RIGHT_OUTER);
  const centre = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const angle = Math.atan2(b.y - a.y, b.x - a.x); // head tilt
  const eyeDist = Math.hypot(b.x - a.x, b.y - a.y);

  const lensW = eyeDist * 0.6;
  const lensH = lensW * spec.heightRatio;
  const offset = eyeDist * 0.39; // from the nose bridge to the centre of each lens
  const lineWidth = Math.max(2, lensW * spec.stroke);

  // Convert a screen point into the tilted system centred between the eyes.
  const toLocal = (p: { x: number; y: number }) => {
    const dx = p.x - centre.x;
    const dy = p.y - centre.y;
    return {
      x: dx * Math.cos(angle) + dy * Math.sin(angle),
      y: -dx * Math.sin(angle) + dy * Math.cos(angle),
    };
  };
  const earL = toLocal(point(EAR_LEFT));
  const earR = toLocal(point(EAR_RIGHT));

  ctx.save();
  ctx.translate(centre.x, centre.y);
  ctx.rotate(angle);
  ctx.strokeStyle = spec.color;
  ctx.fillStyle = 'rgba(140, 180, 220, 0.14)'; // faint lens tint
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Lenses: side -1 is the left lens, side 1 is the right lens.
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * offset, 0);
    ctx.rotate(-side * (spec.tilt ?? 0));
    ctx.beginPath();
    ctx.roundRect(-lensW / 2, -lensH / 2, lensW, lensH, spec.radii(lensW, lensH));
    ctx.fill();
    ctx.stroke();
    if (spec.browBar) {
      ctx.lineWidth = lineWidth * 2.6;
      ctx.beginPath();
      ctx.moveTo(-lensW / 2, -lensH / 2);
      ctx.lineTo(lensW / 2, -lensH / 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Bridge between the lenses.
  ctx.beginPath();
  ctx.moveTo(-offset + lensW / 2, -lensH * 0.15);
  ctx.quadraticCurveTo(0, -lensH * 0.3, offset - lensW / 2, -lensH * 0.15);
  ctx.stroke();

  // Temples (arms) running back toward the ears.
  const hingeY = -lensH * 0.25;
  ctx.beginPath();
  ctx.moveTo(-offset - lensW / 2, hingeY);
  ctx.lineTo(earL.x, earL.y);
  ctx.moveTo(offset + lensW / 2, hingeY);
  ctx.lineTo(earR.x, earR.y);
  ctx.stroke();

  ctx.restore();
}
