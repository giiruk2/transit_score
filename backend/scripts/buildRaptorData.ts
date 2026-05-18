/**
 * GTFS → RAPTOR JSON 전처리 스크립트
 *
 * 입력: data/20260414172446/.../202403_GTFS_DataSet/*.txt
 * 출력: backend/data/raptor/{stops,trips,tripStopTimes,stopRoutes,walkLinks}.json
 *
 * 실행: cd backend && npx ts-node scripts/buildRaptorData.ts
 */

import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse';

// ---- 경로 상수 ----
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const GTFS_DIR = path.join(
  PROJECT_ROOT,
  'data/20260414172446/2025-TM-PT-GTFS 대중교통GTFS(2024년 기준)/202403_GTFS_DataSet'
);
const OUT_DIR = path.resolve(__dirname, '../data/raptor');

// ---- 부산 지역 필터 기준 ----
const BUSAN_LAT_MIN = 35.0;
const BUSAN_LAT_MAX = 35.4;
const BUSAN_LON_MIN = 128.7;
const BUSAN_LON_MAX = 129.3;

const STOP_PREFIX_ALLOW = [/^BS_TAGO_/, /^BS_MBEE/, /^RS_ACC1_S-2-/];

// ---- 타입 ----
type Mode = 'bus' | 'subway';

interface Stop {
  stopId: string;
  name: string;
  lat: number;
  lon: number;
  mode: Mode;
}

interface StopTime {
  stopId: string;
  seq: number;
  arrSec: number;
  depSec: number;
}

interface Trip {
  tripId: string;
  routeId: string;
  mode: Mode;
  routeShortName?: string;
}

interface WalkLink {
  toStopId: string;
  walkTimeSec: number;
  distanceM: number;
}

// ---- 유틸 ----
function hhmmssToSec(hhmmss: string): number {
  const parts = hhmmss.split(':');
  if (parts.length !== 3) return NaN;
  return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
}

function classifyStopMode(stopId: string): Mode | null {
  if (stopId.startsWith('BS_TAGO_') || stopId.startsWith('BS_MBEE')) return 'bus';
  if (stopId.startsWith('RS_ACC1_S-2-')) return 'subway';
  return null;
}

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function log(msg: string) {
  console.log(`[buildRaptorData] ${new Date().toISOString()} ${msg}`);
}

// ---- Phase A: stops.txt → 부산 정류장 ----
async function loadStops(): Promise<Map<string, Stop>> {
  log('stops.txt 파싱 시작');
  const stops = new Map<string, Stop>();
  const parser = fs
    .createReadStream(path.join(GTFS_DIR, 'stops.txt'))
    .pipe(parse({ columns: true, bom: true, skip_empty_lines: true, trim: true }));

  for await (const row of parser) {
    const stopId: string = row.stop_id;
    if (!stopId) continue;
    if (!STOP_PREFIX_ALLOW.some((re) => re.test(stopId))) continue;

    const lat = parseFloat(row.stop_lat);
    const lon = parseFloat(row.stop_lon);
    if (isNaN(lat) || isNaN(lon)) continue;
    if (lat < BUSAN_LAT_MIN || lat > BUSAN_LAT_MAX) continue;
    if (lon < BUSAN_LON_MIN || lon > BUSAN_LON_MAX) continue;

    const mode = classifyStopMode(stopId);
    if (!mode) continue;

    stops.set(stopId, {
      stopId,
      name: row.stop_name || '',
      lat,
      lon,
      mode,
    });
  }
  log(`stops.txt 파싱 완료: ${stops.size}개`);
  return stops;
}

// ---- Phase B: stop_times.txt 스트리밍 → 부산 trip만 누적 ----
async function loadBusanStopTimes(
  busanStopIds: Set<string>
): Promise<Map<string, StopTime[]>> {
  log('stop_times.txt 스트리밍 시작 (1.5GB)');
  const tripStopTimes = new Map<string, StopTime[]>();
  let totalRows = 0;
  let keptRows = 0;

  const parser = fs
    .createReadStream(path.join(GTFS_DIR, 'stop_times.txt'))
    .pipe(parse({ columns: true, bom: true, skip_empty_lines: true, trim: true }));

  for await (const row of parser) {
    totalRows++;
    if (totalRows % 2_000_000 === 0) {
      log(`  진행: ${totalRows / 1_000_000}M행, 부산 일치 ${keptRows / 1000}k`);
    }
    const stopId: string = row.stop_id;
    if (!busanStopIds.has(stopId)) continue;

    const tripId: string = row.trip_id;
    const seq = parseInt(row.stop_sequence, 10);
    const arrSec = hhmmssToSec(row.arrival_time);
    const depSec = hhmmssToSec(row.departure_time);
    if (isNaN(seq) || isNaN(arrSec) || isNaN(depSec)) continue;

    keptRows++;
    let arr = tripStopTimes.get(tripId);
    if (!arr) {
      arr = [];
      tripStopTimes.set(tripId, arr);
    }
    arr.push({ stopId, seq, arrSec, depSec });
  }

  log(`stop_times.txt 완료: ${totalRows}행 중 ${keptRows}행 유지, trip ${tripStopTimes.size}개`);

  // seq 정렬 + 최소 2정류장 이상 trip만
  const filtered = new Map<string, StopTime[]>();
  for (const [tripId, times] of tripStopTimes) {
    if (times.length < 2) continue;
    times.sort((a, b) => a.seq - b.seq);
    filtered.set(tripId, times);
  }
  log(`trip 정제 후: ${filtered.size}개 (2정류장 미만 제거)`);
  return filtered;
}

// ---- Phase B-0: routes.txt → routeId → routeShortName 매핑 ----
async function loadRouteNames(): Promise<Map<string, string>> {
  log('routes.txt 파싱 시작');
  const routeNames = new Map<string, string>();
  const parser = fs
    .createReadStream(path.join(GTFS_DIR, 'routes.txt'))
    .pipe(parse({ columns: true, bom: true, skip_empty_lines: true, trim: true }));
  for await (const row of parser) {
    const routeId: string = row.route_id;
    const shortName: string = row.route_short_name || '';
    if (routeId && shortName) routeNames.set(routeId, shortName);
  }
  log(`routes.txt 완료: ${routeNames.size}개`);
  return routeNames;
}

// ---- Phase C: trips.txt → tripId → routeId 매핑 ----
async function loadTrips(
  wantedTripIds: Set<string>,
  routeNames: Map<string, string>
): Promise<Map<string, Trip>> {
  log('trips.txt 파싱 시작');
  const trips = new Map<string, Trip>();
  const parser = fs
    .createReadStream(path.join(GTFS_DIR, 'trips.txt'))
    .pipe(parse({ columns: true, bom: true, skip_empty_lines: true, trim: true }));

  for await (const row of parser) {
    const tripId: string = row.trip_id;
    if (!wantedTripIds.has(tripId)) continue;
    const routeId: string = row.route_id;
    const mode: Mode = routeId.startsWith('RR_') ? 'subway' : 'bus';
    const routeShortName = routeNames.get(routeId);
    trips.set(tripId, { tripId, routeId, mode, routeShortName });
  }
  log(`trips.txt 완료: ${trips.size}개`);
  return trips;
}

// ---- Phase D: stopRoutes 인덱스 ----
function buildStopRoutes(
  tripStopTimes: Map<string, StopTime[]>,
  trips: Map<string, Trip>
): Map<string, { tripId: string; routeId: string; seq: number }[]> {
  log('stopRoutes 인덱스 생성');
  const stopRoutes = new Map<string, { tripId: string; routeId: string; seq: number }[]>();
  for (const [tripId, times] of tripStopTimes) {
    const trip = trips.get(tripId);
    if (!trip) continue;
    for (const st of times) {
      let arr = stopRoutes.get(st.stopId);
      if (!arr) {
        arr = [];
        stopRoutes.set(st.stopId, arr);
      }
      arr.push({ tripId, routeId: trip.routeId, seq: st.seq });
    }
  }
  log(`stopRoutes: ${stopRoutes.size} stop keys`);
  return stopRoutes;
}

// ---- Phase E: 도보 링크 (transfers.txt + 그리드 기반 700m) ----
async function loadTransferLinks(
  busanStopIds: Set<string>
): Promise<Map<string, WalkLink[]>> {
  log('transfers.txt 파싱 시작');
  const links = new Map<string, WalkLink[]>();
  const parser = fs
    .createReadStream(path.join(GTFS_DIR, 'transfers.txt'))
    .pipe(parse({ columns: true, bom: true, skip_empty_lines: true, trim: true }));

  for await (const row of parser) {
    const from: string = row.from_stop_id;
    const to: string = row.to_stop_id;
    if (!busanStopIds.has(from) || !busanStopIds.has(to)) continue;
    const secs = parseInt(row.min_transfer_time, 10);
    if (isNaN(secs)) continue;
    const add = (a: string, b: string) => {
      let arr = links.get(a);
      if (!arr) {
        arr = [];
        links.set(a, arr);
      }
      arr.push({ toStopId: b, walkTimeSec: secs, distanceM: secs * 1.2 });
    };
    add(from, to);
    add(to, from);
  }
  log(`transfers.txt 완료: ${links.size} source stops`);
  return links;
}

function buildGridWalkLinks(
  stops: Map<string, Stop>,
  baseLinks: Map<string, WalkLink[]>
): Map<string, WalkLink[]> {
  log('그리드 기반 도보 링크 생성 (700m 반경)');
  const WALK_RADIUS_M = 700;
  const WALK_SPEED_MPS = 1.2;
  const GRID_DEG = 0.005; // 약 500m

  // 그리드 셀에 정류장 할당
  const grid = new Map<string, Stop[]>();
  const keyOf = (la: number, lo: number) =>
    `${Math.floor(la / GRID_DEG)}_${Math.floor(lo / GRID_DEG)}`;
  for (const s of stops.values()) {
    const k = keyOf(s.lat, s.lon);
    let arr = grid.get(k);
    if (!arr) {
      arr = [];
      grid.set(k, arr);
    }
    arr.push(s);
  }

  // 중복 방지용 set (양방향 쌍)
  const result = new Map<string, WalkLink[]>();
  const seen = new Set<string>();

  // 기존 transfers를 먼저 복사
  for (const [k, v] of baseLinks) {
    result.set(k, v.slice());
    for (const wl of v) seen.add(`${k}|${wl.toStopId}`);
  }

  let newLinks = 0;
  for (const s of stops.values()) {
    const gx = Math.floor(s.lat / GRID_DEG);
    const gy = Math.floor(s.lon / GRID_DEG);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const cell = grid.get(`${gx + dx}_${gy + dy}`);
        if (!cell) continue;
        for (const t of cell) {
          if (t.stopId === s.stopId) continue;
          const key = `${s.stopId}|${t.stopId}`;
          if (seen.has(key)) continue;
          const d = haversineM(s.lat, s.lon, t.lat, t.lon);
          if (d > WALK_RADIUS_M) continue;
          const walkTimeSec = Math.round(d / WALK_SPEED_MPS);
          let arr = result.get(s.stopId);
          if (!arr) {
            arr = [];
            result.set(s.stopId, arr);
          }
          arr.push({ toStopId: t.stopId, walkTimeSec, distanceM: Math.round(d) });
          seen.add(key);
          newLinks++;
        }
      }
    }
  }
  log(`도보 링크 추가: ${newLinks}개 (총 ${result.size} source stops)`);
  return result;
}

// ---- 메인 ----
async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  // A: 부산 stops
  const stops = await loadStops();
  const busanStopIds = new Set(stops.keys());

  // B-0: routes.txt → routeShortName 매핑
  const routeNames = await loadRouteNames();

  // B: stop_times 스트리밍 (1.5GB)
  const tripStopTimes = await loadBusanStopTimes(busanStopIds);

  // C: trips (부산 trip만)
  const tripIdSet = new Set(tripStopTimes.keys());
  const trips = await loadTrips(tripIdSet, routeNames);

  // trips에 없는 tripStopTimes 제거 (고립 trip)
  for (const tripId of tripStopTimes.keys()) {
    if (!trips.has(tripId)) tripStopTimes.delete(tripId);
  }
  log(`trip 최종: ${trips.size}개`);

  // D: stopRoutes 인덱스
  const stopRoutes = buildStopRoutes(tripStopTimes, trips);

  // E: 도보 링크
  const baseLinks = await loadTransferLinks(busanStopIds);
  const walkLinks = buildGridWalkLinks(stops, baseLinks);

  // ---- JSON 저장 ----
  log('JSON 저장 시작');

  // stops
  const stopsArr = Array.from(stops.values());
  fs.writeFileSync(path.join(OUT_DIR, 'stops.json'), JSON.stringify(stopsArr));
  log(`  stops.json: ${stopsArr.length}개`);

  // trips
  const tripsArr = Array.from(trips.values());
  fs.writeFileSync(path.join(OUT_DIR, 'trips.json'), JSON.stringify(tripsArr));
  log(`  trips.json: ${tripsArr.length}개`);

  // tripStopTimes (대용량, tripId 키 객체)
  const tstObj: Record<string, StopTime[]> = {};
  for (const [k, v] of tripStopTimes) tstObj[k] = v;
  fs.writeFileSync(path.join(OUT_DIR, 'tripStopTimes.json'), JSON.stringify(tstObj));
  log(`  tripStopTimes.json: ${Object.keys(tstObj).length} trips`);

  // stopRoutes
  const srObj: Record<string, { tripId: string; routeId: string; seq: number }[]> = {};
  for (const [k, v] of stopRoutes) srObj[k] = v;
  fs.writeFileSync(path.join(OUT_DIR, 'stopRoutes.json'), JSON.stringify(srObj));
  log(`  stopRoutes.json: ${Object.keys(srObj).length} stops`);

  // walkLinks
  const wlObj: Record<string, WalkLink[]> = {};
  for (const [k, v] of walkLinks) wlObj[k] = v;
  fs.writeFileSync(path.join(OUT_DIR, 'walkLinks.json'), JSON.stringify(wlObj));
  log(`  walkLinks.json: ${Object.keys(wlObj).length} source stops`);

  log('완료 ✅');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
