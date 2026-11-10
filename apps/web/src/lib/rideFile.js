// Reads a ride file on the phone and returns only a summary: the file and its GPS track never
// leave the device. .FIT (Garmin, Wahoo, Hammerhead, Zwift…) via fit-file-parser (MIT), loaded
// only when someone imports; .GPX (Strava/Komoot exports) with the browser's XML parser.

export const MAX_FILE_BYTES = 50 * 1024 * 1024;

export class RideFileError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RideFileError';
    this.code = code; // UNSUPPORTED_FILE | FILE_TOO_LARGE | UNREADABLE_FILE | NO_RIDE_DATA
  }
}

const round = (value, digits = 0) => (value === null || value === undefined ? null : Number(value.toFixed(digits)));
const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
const positive = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);

/**
 * @returns {Promise<{
 *   source: 'fit' | 'gpx', name: string | null, startTime: string, durationMin: number, elapsedMin: number,
 *   distanceKm: number | null, elevationGainM: number | null, avgPowerW: number | null,
 *   normalizedPowerW: number | null, workKj: number | null, avgHr: number | null, tempC: number | null,
 *   indoor: boolean,
 * }>}  durationMin is moving time when the file has it, else elapsed time.
 */
export async function readRideFile(file) {
  const ext = file.name.toLowerCase().split('.').pop();
  if (ext !== 'fit' && ext !== 'gpx') throw new RideFileError('UNSUPPORTED_FILE', 'Choose a .fit or .gpx file.');
  if (file.size > MAX_FILE_BYTES) throw new RideFileError('FILE_TOO_LARGE', 'That file is too large (50 MB max).');
  const summary = ext === 'fit' ? await readFit(await readAs(file, 'arrayBuffer')) : readGpx(await readAs(file, 'text'));
  if (!summary || !(summary.durationMin > 0) || !summary.startTime) {
    throw new RideFileError('NO_RIDE_DATA', 'No ride found in that file.');
  }
  return summary;
}

/** FileReader works on every phone browser (Blob.text/arrayBuffer are newer). */
function readAs(file, kind) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new RideFileError('UNREADABLE_FILE', "Couldn't read that file. Is it a ride from your bike computer?"));
    if (kind === 'text') reader.readAsText(file);
    else reader.readAsArrayBuffer(file);
  });
}

// ---- FIT ----------------------------------------------------------------------------------

async function readFit(buffer) {
  const { default: FitParser } = await import('fit-file-parser');
  let data;
  try {
    data = await new FitParser({ force: true, mode: 'list', temperatureUnit: 'celsius' }).parseAsync(buffer);
  } catch {
    throw new RideFileError('UNREADABLE_FILE', "Couldn't read that file. Is it a ride from your bike computer?");
  }
  const s = data.sessions?.[0];
  if (!s) return fitFromRecords(data.records ?? []);
  const timerS = positive(s.total_timer_time) ?? positive(s.total_elapsed_time);
  const elapsedS = positive(s.total_elapsed_time) ?? timerS;
  const subSport = String(s.sub_sport ?? '');
  return {
    source: 'fit',
    name: null,
    startTime: new Date(s.start_time ?? data.records?.[0]?.timestamp).toISOString(),
    durationMin: round(timerS / 60),
    elapsedMin: round(elapsedS / 60),
    distanceKm: positive(s.total_distance) ? round(s.total_distance / 1000, 1) : null,
    elevationGainM: positive(s.total_ascent) ? round(s.total_ascent) : null,
    avgPowerW: positive(s.avg_power) ? round(s.avg_power) : null,
    normalizedPowerW: positive(s.normalized_power) ? round(s.normalized_power) : null,
    workKj: positive(s.total_work) ? round(s.total_work / 1000) : null,
    avgHr: positive(s.avg_heart_rate) ? round(s.avg_heart_rate) : null,
    tempC: typeof s.avg_temperature === 'number' ? round(s.avg_temperature) : null,
    indoor: /virtual|indoor|trainer/i.test(subSport),
  };
}

// Some devices write records but no session summary: work it out from the records
function fitFromRecords(records) {
  const points = records
    .filter((r) => r.timestamp)
    .map((r) => ({
      time: new Date(r.timestamp).getTime(),
      distanceM: typeof r.distance === 'number' ? r.distance : null,
      ele: r.enhanced_altitude ?? r.altitude ?? null,
      hr: r.heart_rate ?? null,
      power: typeof r.power === 'number' ? r.power : null,
      temp: r.temperature ?? null,
    }));
  if (points.length < 2) return null;
  return { source: 'fit', ...summarizePoints(points) };
}

// ---- GPX ----------------------------------------------------------------------------------

function readGpx(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) {
    throw new RideFileError('UNREADABLE_FILE', "Couldn't read that file. Is it a ride from your bike computer?");
  }
  const byLocalName = (node, name) => [...node.getElementsByTagName('*')].filter((n) => n.localName === name);
  const numberIn = (node, name) => {
    const el = byLocalName(node, name)[0];
    const n = el ? Number(el.textContent) : NaN;
    return Number.isFinite(n) ? n : null;
  };
  const points = byLocalName(doc, 'trkpt')
    .map((pt) => {
      const timeEl = byLocalName(pt, 'time')[0];
      return {
        time: timeEl ? Date.parse(timeEl.textContent) : NaN,
        lat: Number(pt.getAttribute('lat')),
        lon: Number(pt.getAttribute('lon')),
        ele: numberIn(pt, 'ele'),
        hr: numberIn(pt, 'hr'),
        power: numberIn(pt, 'power') ?? numberIn(pt, 'PowerInWatts'),
        temp: numberIn(pt, 'atemp'),
      };
    })
    .filter((p) => Number.isFinite(p.time) && Number.isFinite(p.lat) && Number.isFinite(p.lon));
  if (points.length < 2) return null;
  const trackName = byLocalName(doc, 'trk')[0];
  const nameEl = trackName && [...trackName.children].find((c) => c.localName === 'name');
  return { source: 'gpx', ...summarizePoints(points), name: nameEl?.textContent.trim() || null };
}

// ---- Shared -------------------------------------------------------------------------------

const EARTH_RADIUS_M = 6371000;
function haversineM(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Moving time: gaps longer than 30 s or slower than 2 km/h count as stopped. */
const STOP_GAP_S = 30;
const MOVING_MIN_MPS = 2 / 3.6;
/** Climbing: ignore wiggles under 3 m (GPS altitude noise). */
const CLIMB_THRESHOLD_M = 3;

function summarizePoints(points) {
  points.sort((a, b) => a.time - b.time);
  let distanceM = 0;
  let movingS = 0;
  let climbM = 0;
  let base = points[0].ele;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const dt = (b.time - a.time) / 1000;
    const step =
      a.distanceM !== undefined && a.distanceM !== null && b.distanceM !== null && b.distanceM !== undefined
        ? Math.max(0, b.distanceM - a.distanceM)
        : 'lat' in a
          ? haversineM(a, b)
          : 0;
    distanceM += step;
    if (dt > 0 && dt <= STOP_GAP_S && step / dt >= MOVING_MIN_MPS) movingS += dt;
    if (b.ele !== null && base !== null) {
      if (b.ele - base >= CLIMB_THRESHOLD_M) {
        climbM += b.ele - base;
        base = b.ele;
      } else if (b.ele < base) base = b.ele;
    } else if (base === null) base = b.ele;
  }
  const elapsedS = (points.at(-1).time - points[0].time) / 1000;
  const hrs = points.map((p) => p.hr).filter((v) => v > 0);
  const watts = points.map((p) => p.power).filter((v) => v !== null && v >= 0);
  const temps = points.map((p) => p.temp).filter((v) => v !== null);
  const durationS = movingS > 60 ? movingS : elapsedS;
  const avgPower = watts.length ? mean(watts) : null;
  return {
    name: null,
    startTime: new Date(points[0].time).toISOString(),
    durationMin: round(durationS / 60),
    elapsedMin: round(elapsedS / 60),
    distanceKm: distanceM > 0 ? round(distanceM / 1000, 1) : null,
    elevationGainM: climbM > 0 ? round(climbM) : null,
    avgPowerW: avgPower ? round(avgPower) : null,
    normalizedPowerW: null,
    workKj: avgPower ? round((avgPower * durationS) / 1000) : null,
    avgHr: hrs.length ? round(mean(hrs)) : null,
    tempC: temps.length ? round(mean(temps)) : null,
    indoor: false,
  };
}
