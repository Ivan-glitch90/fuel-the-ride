import { describe, expect, test } from 'vitest';
import { FitBaseType as B, FitEncoder } from 'fit-file-parser/encoder';
import { readRideFile } from './rideFile.js';

/** A real FIT file (file_id + session), like a bike computer writes. */
export function fitFile({ start = new Date('2026-11-01T08:00:00Z'), name = 'ride.fit', subSport = 0, session = {} } = {}) {
  const enc = new FitEncoder();
  enc.writeMessage(0, [
    { number: 0, size: 1, baseType: B.Enum, value: 4 },
    { number: 4, size: 4, baseType: B.Uint32, value: FitEncoder.toFitTimestamp(start) },
  ]);
  const s = { timerS: 7200, elapsedS: 7500, distanceM: 60100, avgHr: 142, avgPower: 175, ascentM: 830, np: 190, workJ: 1260000, temp: 24, ...session };
  enc.writeMessage(18, [
    { number: 2, size: 4, baseType: B.Uint32, value: FitEncoder.toFitTimestamp(start) },
    { number: 5, size: 1, baseType: B.Enum, value: 2 }, // cycling
    { number: 6, size: 1, baseType: B.Enum, value: subSport }, // 58 = virtual activity (Zwift)
    { number: 7, size: 4, baseType: B.Uint32, value: s.elapsedS * 1000 },
    { number: 8, size: 4, baseType: B.Uint32, value: s.timerS * 1000 },
    { number: 9, size: 4, baseType: B.Uint32, value: s.distanceM * 100 },
    { number: 16, size: 1, baseType: B.Uint8, value: s.avgHr },
    { number: 20, size: 2, baseType: B.Uint16, value: s.avgPower },
    { number: 22, size: 2, baseType: B.Uint16, value: s.ascentM },
    { number: 34, size: 2, baseType: B.Uint16, value: s.np },
    { number: 48, size: 4, baseType: B.Uint32, value: s.workJ },
    { number: 57, size: 1, baseType: B.Sint8, value: s.temp },
  ]);
  return new File([enc.close()], name);
}

/** A GPX track: 1 point per 10 s heading north (~8 m per point), climbing 2 m per point, with HR. */
export function gpxFile({ points = 120, name = 'Saturday gravel' } = {}) {
  const start = Date.parse('2026-11-02T07:30:00Z');
  const pts = Array.from({ length: points }, (_, i) => {
    const time = new Date(start + i * 10_000).toISOString();
    return `<trkpt lat="${(45 + i * 0.00008).toFixed(6)}" lon="7.000000"><ele>${100 + i * 2}</ele><time>${time}</time>
      <extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>130</gpxtpx:hr><gpxtpx:atemp>18</gpxtpx:atemp></gpxtpx:TrackPointExtension></extensions></trkpt>`;
  });
  const xml = `<?xml version="1.0"?><gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1"
    xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"><trk><name>${name}</name><trkseg>${pts.join('')}</trkseg></trk></gpx>`;
  return new File([xml], 'ride.gpx', { type: 'application/gpx+xml' });
}

describe('reading ride files on the phone', () => {
  test('FIT: the session summary (moving time, distance, climbing, power, kJ, HR, temperature)', async () => {
    expect(await readRideFile(fitFile())).toEqual({
      source: 'fit',
      name: null,
      startTime: '2026-11-01T08:00:00.000Z',
      durationMin: 120, // moving time, not the 125 min elapsed
      elapsedMin: 125,
      distanceKm: 60.1,
      elevationGainM: 830,
      avgPowerW: 175,
      normalizedPowerW: 190,
      workKj: 1260,
      avgHr: 142,
      tempC: 24,
      indoor: false,
    });
  });

  test('FIT from Zwift is marked indoor', async () => {
    expect((await readRideFile(fitFile({ subSport: 58 }))).indoor).toBe(true);
  });

  test('GPX: works out duration, distance and climbing from the track; no power → no kJ', async () => {
    const s = await readRideFile(gpxFile());
    expect(s).toMatchObject({
      source: 'gpx',
      name: 'Saturday gravel',
      startTime: '2026-11-02T07:30:00.000Z',
      elapsedMin: 20, // 119 × 10 s
      avgHr: 130,
      tempC: 18,
      avgPowerW: null,
      workKj: null,
    });
    expect(s.durationMin).toBe(20); // moving the whole time (~3 km/h)
    expect(s.distanceKm).toBeCloseTo(1.1, 1);
    // 238 m of track climbing, counted in steps of ≥3 m (GPS noise filter): the last 2 m don't count yet
    expect(s.elevationGainM).toBe(236);
  });

  test('wrong kind of file, unreadable or empty → a clear error', async () => {
    await expect(readRideFile(new File(['x'], 'notes.txt'))).rejects.toMatchObject({ code: 'UNSUPPORTED_FILE' });
    await expect(readRideFile(new File(['<gpx'], 'broken.gpx'))).rejects.toMatchObject({ code: 'UNREADABLE_FILE' });
    await expect(readRideFile(gpxFile({ points: 1 }))).rejects.toMatchObject({ code: 'NO_RIDE_DATA' });
  });
});
