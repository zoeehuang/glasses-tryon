/** One face point from MediaPipe. x and y run from 0 to 1 across the video. */
export type Landmark = { x: number; y: number; z: number };

export type FaceShape = 'oval' | 'round' | 'square' | 'heart' | 'oblong' | 'diamond';

export type FrameStyle =
  | 'aviator'
  | 'wayfarer'
  | 'round'
  | 'square'
  | 'browline'
  | 'cateye'
  | 'rectangle';

/** What the user can pick: a frame style, or no frames at all. */
export type FrameChoice = FrameStyle | 'none';
