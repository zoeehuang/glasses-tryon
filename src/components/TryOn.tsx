import { useEffect, useRef, useState } from 'react';
import type { FaceLandmarker } from '@mediapipe/tasks-vision';
import {
  DEFAULT_FRAME_OPTIONS,
  DEFAULT_LENS_OPTIONS,
  drawGlasses,
  type FrameOptions,
  type LensOptions,
} from '../lib/drawGlasses';
import { classifyFromRatios, computeFaceRatios, createShapeVoter, type FaceRatios } from '../lib/faceShape';
import { loadFrameAssets } from '../lib/frameImages';
import { smoothLandmarks } from '../lib/smoothing';
import type { FaceShape, FrameChoice, FrameStyle, Landmark } from '../types';

type Props = {
  landmarker: FaceLandmarker;
  frame: FrameChoice;
  onShape: (shape: FaceShape) => void;
  /** The raw measurements behind the current shape guess, for calibration. */
  onRatios?: (ratios: FaceRatios | null) => void;
  lensOptions?: LensOptions;
  frameOptions?: FrameOptions;
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

export function TryOn({
  landmarker,
  frame,
  onShape,
  onRatios,
  lensOptions = DEFAULT_LENS_OPTIONS,
  frameOptions = DEFAULT_FRAME_OPTIONS,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<FrameChoice>(frame);
  const lensOptionsRef = useRef<LensOptions>(lensOptions);
  const frameOptionsRef = useRef<FrameOptions>(frameOptions);
  const [aspect, setAspect] = useState(4 / 3);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facePresent, setFacePresent] = useState(false);
  const imagesRef = useRef<Partial<Record<FrameStyle, HTMLImageElement>>>({});
  const masksRef = useRef<Partial<Record<FrameStyle, HTMLImageElement>>>({});

  // Load the photorealistic frame images and lens masks once, up front.
  useEffect(() => {
    loadFrameAssets().then(({ images, masks }) => {
      imagesRef.current = images;
      masksRef.current = masks;
    });
  }, []);

  // Keep the latest frame choice where the render loop can read it
  // without restarting the loop every time you click a button.
  useEffect(() => {
    frameRef.current = frame;
  }, [frame]);

  useEffect(() => {
    lensOptionsRef.current = lensOptions;
  }, [lensOptions]);

  useEffect(() => {
    frameOptionsRef.current = frameOptions;
  }, [frameOptions]);

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

  // The detection loop: runs once per screen refresh, works on each new video frame.
  useEffect(() => {
    const voter = createShapeVoter(25);
    let previous: Landmark[] | null = null;
    let lastVideoTime = -1;
    let present = false;
    let raf = 0;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2 || video.currentTime === lastVideoTime) return;
      lastVideoTime = video.currentTime;

      // Make the canvas the same pixel size as the video, then wipe the last frame.
      const { videoWidth: w, videoHeight: h } = video;
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);

      // Ask MediaPipe where the face is.
      const result = landmarker.detectForVideo(video, performance.now());
      const raw = result.faceLandmarks[0];
      if (!raw) {
        previous = null;
        if (present) {
          present = false;
          setFacePresent(false);
        }
        return;
      }
      if (!present) {
        present = true;
        setFacePresent(true);
      }

      // Work out the face shape from the raw points.
      const ratios = computeFaceRatios(raw, w, h);
      onRatios?.(ratios);
      const shape = ratios && classifyFromRatios(ratios);
      if (shape) onShape(voter.push(shape));

      // Draw the glasses using smoothed points so they don't jitter.
      previous = smoothLandmarks(previous, raw);
      const style = frameRef.current;
      if (style !== 'none')
        drawGlasses(
          ctx,
          previous,
          w,
          h,
          style,
          imagesRef.current,
          masksRef.current,
          lensOptionsRef.current,
          frameOptionsRef.current,
        );
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [landmarker, onShape, onRatios]);

  // The video and the canvas are both flipped so it behaves like a mirror.
  return (
    <div
      className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
      style={{ aspectRatio: aspect }}
    >
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full"
        style={{ transform: 'scaleX(-1)' }}
        playsInline
        muted
      />
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
        style={{ transform: 'scaleX(-1)' }}
      />
      {cameraError && (
        <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-red-700">
          {cameraError}
        </p>
      )}
      {!cameraError && !facePresent && (
        <p className="absolute bottom-3 left-3 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
          Looking for a face...
        </p>
      )}
    </div>
  );
}
