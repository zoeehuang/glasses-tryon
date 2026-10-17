# Glasses Try-On

Real-time virtual glasses try-on that detects your face shape, suggests frames, and lets you recolor or re-texture any frame on the fly. Everything runs in your browser — your video is never uploaded.

**[Live demo](https://glasses-tryon-three.vercel.app/)**

![Demo](docs/demo.gif)

[![CI](https://github.com/zoeehuang/glasses-tryon/actions/workflows/ci.yml/badge.svg)](https://github.com/zoeehuang/glasses-tryon/actions/workflows/ci.yml)

## Features

- Tracks 478 face landmarks in real time with MediaPipe FaceLandmarker
- Seven frame styles, each a photorealistic, exact-shape render — not a flat vector icon
- Genuinely see-through lenses, precisely masked to each frame's real lens opening
- Temples drawn procedurally from the detected ear position, so they follow head turns instead of staying fixed at one angle
- Live frame recoloring (8 presets + custom picker) that keeps the photo's own highlights and shadows
- Material pattern transplant — apply tortoiseshell or cheetah print to *any* frame shape, not just the ones photographed with it
- Face shape detection (oval, round, square, heart, oblong, diamond) with frame suggestions
- Landmark smoothing to reduce jitter
- Private by design: no uploads, no accounts, no tracking

## Tech stack

React, TypeScript, Vite, Tailwind CSS, Framer Motion, MediaPipe Tasks Vision, Canvas API, Vitest, GitHub Actions, Vercel

## How it works

1. The browser camera feeds video to MediaPipe FaceLandmarker, which returns 478 landmarks per frame.
2. Each frame style is a real product photo with its lens cut out to full transparency and the rest cropped to the front (bridge + rim only). A matching pixel-precise mask marks exactly where the lens opening is.
3. The lens is rendered as a translucent tint clipped to that mask — real glass, not a photo of glass — and the temples are drawn as lines from each hinge to the detected ear position, so they track head turns.
4. Recoloring and pattern transplant both work by compositing a flat fill or tiled pattern onto the rim's own shape, then blending the rim photo's original shading back on top (canvas `overlay` blend mode), so the result still reads as a lit, photographed object instead of a flat sticker.
5. Face shape is classified from ratios between face length, cheek width, jaw width and forehead width. Frames where the head is turned are skipped, and a vote over the last 25 frames keeps the label stable.

## Run locally

```
npm install
npm run dev
```

Run the tests with `npm test`.

## Project structure

- `src/lib`: framework-free logic (face shape classifier, glasses renderer, smoothing) with unit tests
- `src/hooks`: React hook that loads the face model
- `src/components`: camera view, frame/lens tuning panels, shape panel, UI primitives
- `src/assets`: per-style frame photos, lens masks, and material pattern swatches

## Limitations

- Face shape detection uses hand-tuned ratio thresholds, so treat it as a rough guide. Lighting, hair and camera angle all affect it.
- The glasses are 2D overlays. They tilt with your head and the temples track turns, but the frame front doesn't rotate in depth the way a real 3D model would.
- The ear landmark MediaPipe provides is actually a cheek-width point, not the ear itself, so the temple's reach is a close approximation rather than pixel-exact.
- Needs a modern browser, camera access, and an internet connection to download the face model.

## Roadmap

- 3D frames driven by head pose, for true depth rotation
- A trained face shape classifier with measured accuracy
- Pattern swatches beyond tortoiseshell/cheetah (wood grain, marble, more colorways)

## License

MIT
