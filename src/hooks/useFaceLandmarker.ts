import { useEffect, useState } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

// The version in this URL must match the version you installed in Part 1.
const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

type State = {
  landmarker: FaceLandmarker | null;
  loading: boolean;
  error: string | null;
};

export function useFaceLandmarker(): State {
  const [state, setState] = useState<State>({ landmarker: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    let instance: FaceLandmarker | null = null;

    async function create(delegate: 'GPU' | 'CPU') {
      const vision = await FilesetResolver.forVisionTasks(WASM_URL);
      return FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate },
        runningMode: 'VIDEO',
        numFaces: 1,
      });
    }

    (async () => {
      try {
        try {
          instance = await create('GPU');
        } catch {
          instance = await create('CPU');
        }
        if (cancelled) {
          instance.close();
          return;
        }
        setState({ landmarker: instance, loading: false, error: null });
      } catch {
        if (!cancelled) {
          setState({
            landmarker: null,
            loading: false,
            error: 'Could not load the face model. Check your connection and refresh the page.',
          });
        }
      }
    })();

    return () => {
      cancelled = true;
      instance?.close();
    };
  }, []);

  return state;
}
