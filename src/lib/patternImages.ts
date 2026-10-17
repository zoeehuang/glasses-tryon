import tortoiseshell from '../assets/patterns/tortoiseshell.webp';
import cheetah from '../assets/patterns/cheetah.webp';

export type PatternName = 'tortoiseshell' | 'cheetah';

export const PATTERN_URLS: Record<PatternName, string> = {
  tortoiseshell,
  cheetah,
};

/** A representative colour for each pattern's temple line, which is too thin to tile. */
export const PATTERN_LINE_COLORS: Record<PatternName, string> = {
  tortoiseshell: '#6b4a2c',
  cheetah: '#3a2a1a',
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export async function loadPatternImages(): Promise<Record<PatternName, HTMLImageElement>> {
  const entries = await Promise.all(
    (Object.entries(PATTERN_URLS) as [PatternName, string][]).map(
      async ([name, url]) => [name, await loadImage(url)] as const,
    ),
  );
  return Object.fromEntries(entries) as Record<PatternName, HTMLImageElement>;
}
