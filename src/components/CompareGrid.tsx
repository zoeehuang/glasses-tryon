import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { FaceLandmarker } from '@mediapipe/tasks-vision';
import {
  DEFAULT_FRAME_OPTIONS,
  DEFAULT_LENS_OPTIONS,
  drawGlasses,
  type LensOptions,
} from '../lib/drawGlasses';
import { loadFrameAssets } from '../lib/frameImages';
import { frameLabel } from '../lib/frames';
import { smoothLandmarks } from '../lib/smoothing';
import type { FrameStyle, Landmark } from '../types';

type Props = {
  landmarker: FaceLandmarker;
  styles: FrameStyle[];
  lensOptions?: LensOptions;
};

const CAMERA_ERRORS: Record<string, string> = {
  NotAllowedError: 'Camera permission was denied. Allow camera access in your browser settings and try again.',
  NotFoundError: 'No camera was found on this device.',
  NotReadableError: 'Your camera is being used by another app.',
};

function describeCameraError(err: unknown): string {
  if (err instanceof DOMException && err.name in CAMERA_ERRORS) return CAMERA_ERRORS[err.name];
  return 'Could not start the camera.';
}

const ZOOM_SPRING = { type: 'spring', stiffness: 350, damping: 32 } as const;

/**
 * Shows every frame style at once, each in its own window. One MediaPipe
 * detection runs per video frame (the expensive part); the same landmark
 * result is then reused to draw into every window's canvas, so the cost of
 * adding more windows is just another cheap `drawGlasses` call, not another
 * detection pass. Each canvas draws the current video frame itself (not a
 * shared <video> element underneath), so there's exactly one hidden video
 * element regardless of how many windows are showing.
 *
 * Clicking a window enlarges it; while enlarged, only that one is drawn.
 */
export function CompareGrid({ landmarker, styles, lensOptions = DEFAULT_LENS_OPTIONS }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRefs = useRef<Partial<Record<FrameStyle, HTMLCanvasElement>>>({});
  const expandedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lensOptionsRef = useRef<LensOptions>(lensOptions);
  const [expanded, setExpanded] = useState<FrameStyle | null>(null);
  const expandedRef = useRef<FrameStyle | null>(null);
  const [aspect, setAspect] = useState(4 / 3);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const imagesRef = useRef<Partial<Record<FrameStyle, HTMLImageElement>>>({});
  const masksRef = useRef<Partial<Record<FrameStyle, HTMLImageElement>>>({});

  useEffect(() => {
    loadFrameAssets().then(({ images, masks }) => {
      imagesRef.current = images;
      masksRef.current = masks;
    });
  }, []);

  useEffect(() => {
    lensOptionsRef.current = lensOptions;
  }, [lensOptions]);

  useEffect(() => {
    expandedRef.current = expanded;
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(null);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [expanded]);

  // Start the camera on mount, stop it on unmount.
  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 640, height: 480 },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setAspect(video.videoWidth / video.videoHeight);
      } catch (err) {
        if (!cancelled) setCameraError(describeCameraError(err));
      }
    })();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  // One detection pass per video frame, reused across every window's draw.
  useEffect(() => {
    let previous: Landmark[] | null = null;
    let lastVideoTime = -1;
    let raf = 0;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.currentTime === lastVideoTime) return;
      lastVideoTime = video.currentTime;

      const { videoWidth: w, videoHeight: h } = video;
      const result = landmarker.detectForVideo(video, performance.now());
      const raw = result.faceLandmarks[0];
      previous = raw ? smoothLandmarks(previous, raw) : null;

      const draw = (canvas: HTMLCanvasElement, style: FrameStyle) => {
        if (canvas.width !== w) canvas.width = w;
        if (canvas.height !== h) canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(video, 0, 0, w, h);
        if (previous) {
          drawGlasses(
            ctx,
            previous,
            w,
            h,
            style,
            imagesRef.current,
            masksRef.current,
            lensOptionsRef.current,
            DEFAULT_FRAME_OPTIONS,
          );
        }
      };

      // While one window is enlarged the grid is hidden behind the backdrop,
      // so only the enlarged one is worth drawing.
      const open = expandedRef.current;
      if (open) {
        if (expandedCanvasRef.current) draw(expandedCanvasRef.current, open);
        return;
      }
      for (const style of styles) {
        const canvas = canvasRefs.current[style];
        if (canvas) draw(canvas, style);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [landmarker, styles]);

  if (cameraError) {
    return (
      <div className="glass-panel flex aspect-[4/3] items-center justify-center rounded-2xl p-6 text-center text-sm text-red-700">
        {cameraError}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {/* Hidden source video — each window draws its own copy of the frame. */}
        <video ref={videoRef} className="hidden" playsInline muted />
        {styles.map((style) => (
          <div key={style} className="space-y-1">
            {expanded === style ? (
              // Holds the slot open while this window is enlarged, so the grid doesn't reflow.
              <div className="rounded-xl bg-slate-900/5" style={{ aspectRatio: aspect }} />
            ) : (
              <motion.button
                type="button"
                layoutId={`window-${style}`}
                transition={ZOOM_SPRING}
                onClick={() => setExpanded(style)}
                aria-label={`Enlarge ${frameLabel(style)}`}
                className="glass-panel block w-full cursor-zoom-in overflow-hidden rounded-xl"
                style={{ aspectRatio: aspect }}
              >
                <canvas
                  ref={(el) => {
                    if (el) canvasRefs.current[style] = el;
                    else delete canvasRefs.current[style];
                  }}
                  className="h-full w-full"
                  style={{ transform: 'scaleX(-1)' }}
                />
              </motion.button>
            )}
            <p className="text-center text-xs font-medium text-slate-600">{frameLabel(style)}</p>
          </div>
        ))}
      </div>

      {/* Portaled to <body> so `position: fixed` is relative to the viewport,
          not to an animated (transformed) ancestor. */}
      {createPortal(
        <AnimatePresence>
          {expanded && (
            <>
              <motion.div
                key="backdrop"
                className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setExpanded(null)}
              />
              <div
                key="modal"
                className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4"
              >
                <motion.div
                  layoutId={`window-${expanded}`}
                  transition={ZOOM_SPRING}
                  className="glass-panel pointer-events-auto relative overflow-hidden rounded-2xl"
                  style={{
                    aspectRatio: aspect,
                    width: `min(100%, 48rem, calc(85vh * ${aspect}))`,
                  }}
                >
                  <canvas
                    ref={expandedCanvasRef}
                    className="h-full w-full"
                    style={{ transform: 'scaleX(-1)' }}
                  />
                  <button
                    type="button"
                    onClick={() => setExpanded(null)}
                    aria-label="Close"
                    className="absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/70"
                  >
                    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                      <path
                        d="M5 5l10 10M15 5L5 15"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                  <span className="absolute bottom-3 left-3 rounded-full bg-black/55 px-3 py-1 text-sm font-medium text-white">
                    {frameLabel(expanded)}
                  </span>
                </motion.div>
              </div>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
