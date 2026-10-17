import aviator from '../assets/frames/aviator.webp';
import wayfarer from '../assets/frames/wayfarer.webp';
import round from '../assets/frames/round.webp';
import square from '../assets/frames/square.webp';
import browline from '../assets/frames/browline.webp';
import cateye from '../assets/frames/cateye.webp';
import rectangle from '../assets/frames/rectangle.webp';
import aviatorMask from '../assets/lens_masks/aviator.webp';
import wayfarerMask from '../assets/lens_masks/wayfarer.webp';
import roundMask from '../assets/lens_masks/round.webp';
import squareMask from '../assets/lens_masks/square.webp';
import browlineMask from '../assets/lens_masks/browline.webp';
import cateyeMask from '../assets/lens_masks/cateye.webp';
import rectangleMask from '../assets/lens_masks/rectangle.webp';
import type { FrameStyle } from '../types';

/** Photorealistic, front-facing, transparent-background renders of each frame style. */
export const FRAME_IMAGE_URLS: Record<FrameStyle, string> = {
  aviator,
  wayfarer,
  round,
  square,
  browline,
  cateye,
  rectangle,
};

/**
 * Per-style lens-opening masks (white = lens interior, black = elsewhere), the
 * same pixel dimensions as the matching frame image. Used to clip the
 * procedural lens tint to each style's exact lens shape instead of
 * approximating it with an ellipse.
 */
export const LENS_MASK_URLS: Record<FrameStyle, string> = {
  aviator: aviatorMask,
  wayfarer: wayfarerMask,
  round: roundMask,
  square: squareMask,
  browline: browlineMask,
  cateye: cateyeMask,
  rectangle: rectangleMask,
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function loadAll(urls: Record<FrameStyle, string>): Promise<Record<FrameStyle, HTMLImageElement>> {
  const entries = await Promise.all(
    (Object.entries(urls) as [FrameStyle, string][]).map(
      async ([style, url]) => [style, await loadImage(url)] as const,
    ),
  );
  return Object.fromEntries(entries) as Record<FrameStyle, HTMLImageElement>;
}

export type FrameAssets = {
  images: Record<FrameStyle, HTMLImageElement>;
  masks: Record<FrameStyle, HTMLImageElement>;
};

/** Loads every frame image and lens mask up front so there's no pop-in when a style is first selected. */
export async function loadFrameAssets(): Promise<FrameAssets> {
  const [images, masks] = await Promise.all([loadAll(FRAME_IMAGE_URLS), loadAll(LENS_MASK_URLS)]);
  return { images, masks };
}
