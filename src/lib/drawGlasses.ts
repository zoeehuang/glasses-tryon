import { FRAME_GEOMETRY } from './frameGeometry';
import type { FrameStyle, Landmark } from '../types';

// MediaPipe face mesh point numbers.
const EYE_LEFT_OUTER = 33;
const EYE_RIGHT_OUTER = 263;
const EAR_LEFT = 234;
const EAR_RIGHT = 454;

// How wide the glasses image is, as a multiple of the distance between the outer
// eye corners. Real glasses (both lenses plus the bridge) run noticeably wider
// than that distance, so this starts above 1. Tune by eye once you can see it live.
const WIDTH_SCALE = 1.75;

// Where the "eye line" sits inside each source image, as a fraction of its height
// from the top. All seven renders share the same framing, so one constant works
// for all of them. Tune by eye once you can see it live.
const VERTICAL_ANCHOR = 0.4;

// Landmarks 234/454 approximate how far out the ear is, but their vertical
// position drifts unreliably across head angles (tuning a fixed drop from it
// kept overshooting toward the jaw in profile). Real temples are close to
// horizontal anyway, so the temple's height just follows the hinge, and the
// landmark only sets how far out it reaches.
const EAR_OUTWARD = 1.05;

export type LensOptions = {
  /** 0 (fully see-through) to 1 (fully opaque). */
  opacity: number;
  /** Overrides every style's own tint colour when set. */
  tintOverride: string | null;
};

export const DEFAULT_LENS_OPTIONS: LensOptions = {
  opacity: 0.55,
  tintOverride: null,
};

export type FrameOptions = {
  /** Replaces the rim's own photographed colour when set, keeping its lighting and shading. */
  colorOverride: string | null;
  /** Replaces the rim with a tiled material pattern when set (wins over colorOverride if both are set). */
  patternOverride: HTMLImageElement | null;
  /** Representative solid colour for that pattern, used for the (too-thin-to-tile) temple line. */
  patternLineColor: string;
  /** How large each pattern tile reads on the frame; higher = smaller/denser repeats. */
  patternScale: number;
};

export const DEFAULT_FRAME_OPTIONS: FrameOptions = {
  colorOverride: null,
  patternOverride: null,
  patternLineColor: '#3a2a1a',
  patternScale: 2.2,
};

// Reusable offscreen canvases, so a new canvas isn't allocated on every video frame.
let tintCanvas: HTMLCanvasElement | null = null;
let rimCanvas: HTMLCanvasElement | null = null;

function getTintedLens(mask: HTMLImageElement, color: string, opacity: number): HTMLCanvasElement {
  if (!tintCanvas) tintCanvas = document.createElement('canvas');
  const w = mask.naturalWidth;
  const h = mask.naturalHeight;
  if (tintCanvas.width !== w) tintCanvas.width = w;
  if (tintCanvas.height !== h) tintCanvas.height = h;
  const tctx = tintCanvas.getContext('2d')!;
  tctx.clearRect(0, 0, w, h);
  tctx.globalCompositeOperation = 'source-over';
  tctx.fillStyle = color;
  tctx.globalAlpha = opacity;
  tctx.fillRect(0, 0, w, h);
  tctx.globalAlpha = 1;
  tctx.globalCompositeOperation = 'destination-in';
  tctx.drawImage(mask, 0, 0, w, h);
  tctx.globalCompositeOperation = 'source-over';
  return tintCanvas;
}

/**
 * Recolours the rim to a flat colour while keeping the photo's own highlights
 * and shadows for depth. Most of these frames are naturally dark/black, so a
 * hue-preserving 'color' blend (which keeps the destination's luminance)
 * stayed dark and muted no matter the target colour — starting from a vivid
 * flat fill and overlaying the photo's shading on top reads far more like an
 * actual colour change. Re-clips to the rim's own alpha afterward, since a
 * blend-mode fill otherwise floods the transparent areas opaque too.
 */
function getRecoloredRim(image: HTMLImageElement, color: string): HTMLCanvasElement {
  if (!rimCanvas) rimCanvas = document.createElement('canvas');
  const w = image.naturalWidth;
  const h = image.naturalHeight;
  if (rimCanvas.width !== w) rimCanvas.width = w;
  if (rimCanvas.height !== h) rimCanvas.height = h;
  const rctx = rimCanvas.getContext('2d')!;
  rctx.clearRect(0, 0, w, h);
  rctx.globalCompositeOperation = 'source-over';
  rctx.fillStyle = color;
  rctx.fillRect(0, 0, w, h);
  rctx.globalCompositeOperation = 'overlay';
  rctx.drawImage(image, 0, 0, w, h);
  rctx.globalCompositeOperation = 'destination-in';
  rctx.drawImage(image, 0, 0, w, h);
  rctx.globalCompositeOperation = 'source-over';
  return rimCanvas;
}

/**
 * Transplants a material pattern (e.g. tortoiseshell, cheetah print) onto the
 * rim's own shape, the same way getRecoloredRim transplants a flat colour:
 * tile the pattern, clip it to the rim's silhouette, overlay the rim's own
 * shading for depth, then re-clip (the overlay step can't un-shrink the
 * alpha, but it can't be allowed to grow it past the rim either).
 */
function getPatternedRim(
  image: HTMLImageElement,
  pattern: HTMLImageElement,
  scale: number,
): HTMLCanvasElement {
  if (!rimCanvas) rimCanvas = document.createElement('canvas');
  const w = image.naturalWidth;
  const h = image.naturalHeight;
  if (rimCanvas.width !== w) rimCanvas.width = w;
  if (rimCanvas.height !== h) rimCanvas.height = h;
  const rctx = rimCanvas.getContext('2d')!;
  rctx.clearRect(0, 0, w, h);
  rctx.globalCompositeOperation = 'source-over';
  const fill = rctx.createPattern(pattern, 'repeat');
  if (fill) {
    const m = new DOMMatrix().scale(scale);
    fill.setTransform(m);
    rctx.fillStyle = fill;
    rctx.fillRect(0, 0, w, h);
  }
  rctx.globalCompositeOperation = 'overlay';
  rctx.drawImage(image, 0, 0, w, h);
  rctx.globalCompositeOperation = 'destination-in';
  rctx.drawImage(image, 0, 0, w, h);
  rctx.globalCompositeOperation = 'source-over';
  return rimCanvas;
}

export function drawGlasses(
  ctx: CanvasRenderingContext2D,
  lms: Landmark[],
  width: number,
  height: number,
  style: FrameStyle,
  images: Partial<Record<FrameStyle, HTMLImageElement>>,
  masks: Partial<Record<FrameStyle, HTMLImageElement>>,
  lensOptions: LensOptions = DEFAULT_LENS_OPTIONS,
  frameOptions: FrameOptions = DEFAULT_FRAME_OPTIONS,
): void {
  const image = images[style];
  const mask = masks[style];
  if (!image) return;
  const geo = FRAME_GEOMETRY[style];

  const point = (i: number) => ({ x: lms[i].x * width, y: lms[i].y * height });
  const a = point(EYE_LEFT_OUTER);
  const b = point(EYE_RIGHT_OUTER);
  const centre = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const angle = Math.atan2(b.y - a.y, b.x - a.x); // head tilt
  const eyeDist = Math.hypot(b.x - a.x, b.y - a.y);

  const drawW = eyeDist * WIDTH_SCALE;
  const drawH = drawW * (image.height / image.width);
  const top = -drawH * VERTICAL_ANCHOR;
  const left = -drawW / 2;

  const toLocal = (p: { x: number; y: number }) => {
    const dx = p.x - centre.x;
    const dy = p.y - centre.y;
    return {
      x: dx * Math.cos(angle) + dy * Math.sin(angle),
      y: -dx * Math.sin(angle) + dy * Math.cos(angle),
    };
  };
  const rawEarL = toLocal(point(EAR_LEFT));
  const rawEarR = toLocal(point(EAR_RIGHT));
  const hingeLeftLocal = { x: left, y: top + geo.hingeLeftY * drawH };
  const hingeRightLocal = { x: left + drawW, y: top + geo.hingeRightY * drawH };
  const earL = { x: rawEarL.x * EAR_OUTWARD, y: hingeLeftLocal.y };
  const earR = { x: rawEarR.x * EAR_OUTWARD, y: hingeRightLocal.y };

  ctx.save();
  ctx.translate(centre.x, centre.y);
  ctx.rotate(angle);

  // Lens: a flat tint clipped to the exact lens-opening shape (via the mask
  // image, same pixel dimensions as the frame image), not photo content — the
  // photographed lens baked in a faint ghost of the camera's own temple,
  // visible once made see-through, and an ellipse approximation didn't fit
  // non-oval styles like cat-eye or square. Drawn first so the opaque rim
  // (next) overlaps its edges cleanly.
  if (mask) {
    const tinted = getTintedLens(mask, lensOptions.tintOverride ?? geo.tintColor, lensOptions.opacity);
    ctx.drawImage(tinted, left, top, drawW, drawH);
  }

  let rim: HTMLImageElement | HTMLCanvasElement = image;
  let temporaryLineColor: string | null = null;
  if (frameOptions.patternOverride) {
    rim = getPatternedRim(image, frameOptions.patternOverride, frameOptions.patternScale);
    temporaryLineColor = frameOptions.patternLineColor;
  } else if (frameOptions.colorOverride) {
    rim = getRecoloredRim(image, frameOptions.colorOverride);
    temporaryLineColor = frameOptions.colorOverride;
  }
  ctx.drawImage(rim, left, top, drawW, drawH);

  // Temples (arms): the photo only shows the front of the glasses, so these are
  // drawn from each hinge out toward the ear side, which keeps them roughly
  // correct as the head turns instead of staying fixed at the photo's angle.
  ctx.lineWidth = Math.max(2, eyeDist * 0.03);
  ctx.lineCap = 'round';
  ctx.strokeStyle = temporaryLineColor ?? geo.rimColor;
  ctx.beginPath();
  ctx.moveTo(hingeLeftLocal.x, hingeLeftLocal.y);
  ctx.lineTo(earL.x, earL.y);
  ctx.moveTo(hingeRightLocal.x, hingeRightLocal.y);
  ctx.lineTo(earR.x, earR.y);
  ctx.stroke();

  ctx.restore();
}
