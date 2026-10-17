import type { FrameStyle } from '../types';

type FrameGeometry = {
  /** Where the temple should start, as a fraction of image height, on each side. */
  hingeLeftY: number;
  hingeRightY: number;
  /** Approximate rim colour, for the procedurally drawn temple line. */
  rimColor: string;
  /** Default lens tint colour (overridable live via lens tuning). */
  tintColor: string;
};

/**
 * Each frame image is cropped to the front (rim + bridge) only, with the lens
 * area cut out to full transparency — the photo's lens content baked in a
 * ghost of the photographed temple (visible once the lens was made
 * see-through). The lens is drawn procedurally instead, clipped to the exact
 * lens shape using a matching mask image (see frameImages.ts), and the
 * temples are redrawn procedurally too, from these hinge points outward.
 */
export const FRAME_GEOMETRY: Record<FrameStyle, FrameGeometry> = {
  aviator: { hingeLeftY: 0.5071556350626119, hingeRightY: 0.5044722719141324, rimColor: '#a99275', tintColor: '#55524e' },
  wayfarer: { hingeLeftY: 0.37298747763864043, hingeRightY: 0.3694096601073345, rimColor: '#242424', tintColor: '#45433f' },
  round: { hingeLeftY: 0.4293381037567084, hingeRightY: 0.4293381037567084, rimColor: '#422719', tintColor: '#504a43' },
  square: { hingeLeftY: 0.38998211091234347, hingeRightY: 0.387298747763864, rimColor: '#262527', tintColor: '#4c4c4d' },
  browline: { hingeLeftY: 0.3828264758497317, hingeRightY: 0.3828264758497317, rimColor: '#624f45', tintColor: '#524f4d' },
  cateye: { hingeLeftY: 0.3631484794275492, hingeRightY: 0.3667262969588551, rimColor: '#471f22', tintColor: '#494243' },
  rectangle: { hingeLeftY: 0.46511627906976744, hingeRightY: 0.47227191413237923, rimColor: '#353944', tintColor: '#505054' },
};
