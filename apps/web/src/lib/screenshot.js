// Premium screenshot import: shrink the picture on the phone (fast upload, low cost), send it to
// the API, and turn the numbers that come back into the same summary a ride file gives.
import { api } from '../api/client.js';

const MAX_SIDE_PX = 1600; // plenty for the text on a summary screen
const JPEG_QUALITY = 0.85;

export class ScreenshotError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ScreenshotError';
  }
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ScreenshotError("Couldn't open that picture. Try a screenshot (PNG or JPEG)."));
    };
    img.src = url;
  });
}

/** → { image: base64 JPEG without the data: prefix, mediaType: 'image/jpeg' } */
export async function shrinkImage(file) {
  if (!file.type.startsWith('image/')) throw new ScreenshotError('Choose a picture (a screenshot of your ride).');
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_SIDE_PX / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  return { image: dataUrl.slice(dataUrl.indexOf(',') + 1), mediaType: 'image/jpeg' };
}

/**
 * Reads a ride summary screenshot (Premium). Returns the file-import summary shape plus
 * `timeKnown` (false when the screenshot shows no time of day: then there's no duplicate check).
 */
export async function readScreenshot(file) {
  const body = await shrinkImage(file);
  const { summary: s } = await api('/rides/read-screenshot', { method: 'POST', body });
  const today = new Date().toLocaleDateString('en-CA');
  const date = s.date ?? today;
  // Date + time as shown, in the rider's own time zone
  const start = new Date(`${date}T${s.time ?? '12:00'}:00`);
  return {
    source: 'screenshot',
    name: s.name,
    startTime: start.toISOString(),
    timeKnown: Boolean(s.time),
    dateKnown: Boolean(s.date),
    durationMin: s.durationMin,
    elapsedMin: s.elapsedMin,
    distanceKm: s.distanceKm,
    elevationGainM: s.elevationGainM,
    avgPowerW: s.avgPowerW,
    normalizedPowerW: s.normalizedPowerW,
    workKj: s.workKj,
    avgHr: s.avgHr,
    tempC: s.tempC,
    indoor: s.indoor,
  };
}
