import { useEffect, useRef, useState } from 'react';
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

/**
 * Shows every frame style at once, each in its own window. One MediaPipe
 * detection runs per video frame (the expensive part); the same landmark
 * result is then reused to draw into every window's canvas, so the cost of
 * adding more windows is just another cheap `drawGlasses` call, not another
 * detection pass. Each canvas draws the current video frame itself (not a
 * shared <video> element underneath), so there's exactly one hidden video
 * element regardless of how many windows are showing.
 */
export function CompareGrid({ landmarker, styles, lensOptions = DEFAULT_LENS_OPTIONS }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRefs = useRef<Partial<Record<FrameStyle, HTMLCanvasElement>>>({});
  const lensOptionsRef = useRef<LensOptions>(lensOptions);
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
      if (raw) previous = smoothLandmarks(previous, raw);
      else previous = null;

      for (const style of styles) {
        const canvas = canvasRefs.current[style];
        if (!canvas) continue;
        if (canvas.width !== w) canvas.width = w;
        if (canvas.height !== h) canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {/* Hidden source video — each window draws its own copy of the frame, so this never needs to be visible itself. */}
      <video ref={videoRef} className="hidden" playsInline muted />
      {styles.map((style) => (
        <div key={style} className="space-y-1">
          <div
            className="glass-panel overflow-hidden rounded-xl"
            style={{ aspectRatio: aspect }}
          >
            <canvas
              ref={(el) => {
                if (el) canvasRefs.current[style] = el;
              }}
              className="h-full w-full"
              style={{ transform: 'scaleX(-1)' }}
            />
          </div>
          <p className="text-center text-xs font-medium text-slate-600">{frameLabel(style)}</p>
        </div>
      ))}
    </div>
  );
}
