'use client';

import type { NSFWJS, PredictionType } from 'nsfwjs';

const MODEL_URL = '/nsfwjs-model/model.json';
const FLAGGED_CLASSES = new Set(['Porn', 'Hentai']);
const FLAG_THRESHOLD = 0.7;

let modelPromise: Promise<NSFWJS> | null = null;

/** Lazily loads the self-hosted MobileNetV2 model once and reuses it. */
function getModel(): Promise<NSFWJS> {
  if (!modelPromise) {
    modelPromise = import('nsfwjs').then((nsfwjs) => nsfwjs.load(MODEL_URL));
  }
  return modelPromise;
}

export interface NsfwCheckResult {
  flagged: boolean;
  predictions: PredictionType[];
}

/** Runs entirely in the browser — the image never leaves the device for this check. */
export async function checkImage(image: HTMLCanvasElement | HTMLImageElement): Promise<NsfwCheckResult> {
  const model = await getModel();
  const predictions = await model.classify(image);
  const flagged = predictions.some((p) => FLAGGED_CLASSES.has(p.className) && p.probability >= FLAG_THRESHOLD);
  return { flagged, predictions };
}
