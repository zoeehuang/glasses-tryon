import type { FaceShape, FrameStyle } from '../types';

export const FRAME_STYLES: { id: FrameStyle; label: string }[] = [
  { id: 'aviator', label: 'Aviator' },
  { id: 'wayfarer', label: 'Wayfarer' },
  { id: 'round', label: 'Round' },
  { id: 'square', label: 'Square' },
  { id: 'browline', label: 'Browline' },
  { id: 'cateye', label: 'Cat-eye' },
  { id: 'rectangle', label: 'Rectangle' },
];

export function frameLabel(id: FrameStyle): string {
  return FRAME_STYLES.find((f) => f.id === id)?.label ?? id;
}

type FaceShapeInfo = {
  label: string;
  description: string;
  recommended: FrameStyle[];
  avoid: FrameStyle[];
};

export const FACE_SHAPE_INFO: Record<FaceShape, FaceShapeInfo> = {
  oval: {
    label: 'Oval',
    description:
      'Balanced proportions, slightly wider cheekbones, gentle narrowing at forehead and jaw.',
    recommended: ['aviator', 'wayfarer', 'browline', 'cateye', 'rectangle'],
    avoid: [],
  },
  round: {
    label: 'Round',
    description: 'Full cheeks, soft angles, width and length roughly equal.',
    recommended: ['rectangle', 'square', 'browline', 'wayfarer'],
    avoid: ['round'],
  },
  square: {
    label: 'Square',
    description: 'Strong jawline, broad forehead, angular features of similar width.',
    recommended: ['round', 'aviator', 'cateye', 'wayfarer'],
    avoid: ['square'],
  },
  heart: {
    label: 'Heart',
    description: 'Wider forehead, high cheekbones, narrow pointed chin.',
    recommended: ['aviator', 'round', 'rectangle', 'wayfarer'],
    avoid: ['cateye'],
  },
  oblong: {
    label: 'Oblong',
    description: 'Face length greater than width, longer nose and chin.',
    recommended: ['round', 'square', 'browline', 'aviator'],
    avoid: ['rectangle'],
  },
  diamond: {
    label: 'Diamond',
    description: 'Narrow forehead and jawline with wide cheekbones.',
    recommended: ['cateye', 'aviator', 'round', 'wayfarer'],
    avoid: [],
  },
};
