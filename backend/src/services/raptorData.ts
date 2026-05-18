/**
 * RAPTOR 런타임 데이터 로더
 * buildRaptorData.ts가 생성한 JSON 5개를 서버 기동 시 1회 메모리에 로드한다.
 */

import fs from 'fs';
import path from 'path';

export type Mode = 'bus' | 'subway';

export interface RaptorStop {
  stopId: string;
  name: string;
  lat: number;
  lon: number;
  mode: Mode;
}

export interface RaptorStopTime {
  stopId: string;
  seq: number;
  arrSec: number;
  depSec: number;
}

export interface RaptorTrip {
  tripId: string;
  routeId: string;
  mode: Mode;
  routeShortName?: string;
}

export interface RaptorStopRouteEntry {
  tripId: string;
  routeId: string;
  seq: number;
}

export interface RaptorWalkLink {
  toStopId: string;
  walkTimeSec: number;
  distanceM: number;
}

export interface RaptorMemory {
  stops: Map<string, RaptorStop>;
  trips: Map<string, RaptorTrip>;
  tripStopTimes: Map<string, RaptorStopTime[]>;
  stopRoutes: Map<string, RaptorStopRouteEntry[]>;
  walkLinks: Map<string, RaptorWalkLink[]>;
  /** 모든 stop을 배열로 (최근접 탐색용) */
  stopList: RaptorStop[];
}

const DATA_DIR = path.resolve(__dirname, '../../data/raptor');

let memory: RaptorMemory | null = null;
let loadingPromise: Promise<RaptorMemory> | null = null;

function readJson<T>(name: string): T {
  const filePath = path.join(DATA_DIR, name);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

export async function loadRaptorData(): Promise<RaptorMemory> {
  if (memory) return memory;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const t0 = Date.now();
    console.log('[RAPTOR] JSON 로드 시작');

    const stopsArr = readJson<RaptorStop[]>('stops.json');
    const tripsArr = readJson<RaptorTrip[]>('trips.json');
    const tripStopTimesObj = readJson<Record<string, RaptorStopTime[]>>('tripStopTimes.json');
    const stopRoutesObj = readJson<Record<string, RaptorStopRouteEntry[]>>('stopRoutes.json');
    const walkLinksObj = readJson<Record<string, RaptorWalkLink[]>>('walkLinks.json');

    const stops = new Map<string, RaptorStop>();
    for (const s of stopsArr) stops.set(s.stopId, s);

    const trips = new Map<string, RaptorTrip>();
    for (const t of tripsArr) trips.set(t.tripId, t);

    const tripStopTimes = new Map<string, RaptorStopTime[]>();
    for (const k of Object.keys(tripStopTimesObj)) tripStopTimes.set(k, tripStopTimesObj[k]);

    const stopRoutes = new Map<string, RaptorStopRouteEntry[]>();
    for (const k of Object.keys(stopRoutesObj)) stopRoutes.set(k, stopRoutesObj[k]);

    const walkLinks = new Map<string, RaptorWalkLink[]>();
    for (const k of Object.keys(walkLinksObj)) walkLinks.set(k, walkLinksObj[k]);

    memory = {
      stops,
      trips,
      tripStopTimes,
      stopRoutes,
      walkLinks,
      stopList: stopsArr,
    };

    const ms = Date.now() - t0;
    console.log(
      `[RAPTOR] 로드 완료 (${ms}ms): stops=${stops.size}, trips=${trips.size}, walkLinks src=${walkLinks.size}`
    );
    return memory;
  })();

  return loadingPromise;
}

export function getRaptorData(): RaptorMemory {
  if (!memory) throw new Error('RAPTOR 데이터가 아직 로드되지 않았습니다. loadRaptorData()를 먼저 호출하세요.');
  return memory;
}
