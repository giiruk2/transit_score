import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import { getCachedRoute, setCachedRoute } from './redisCache';
import { runRaptor } from './raptor';
import type { ElevationPoint } from './elevationService';

// 경로 leg (폴리라인 1구간)
export interface RouteLeg {
  mode: 'walk' | 'bus' | 'subway';
  routeShortName?: string;   // "51", "2호선"
  boardStopName?: string;
  alightStopName?: string;
  coords: { lat: number; lng: number }[];  // 카카오맵용 lng
  durationSec: number;
  // 고도 데이터 (도보 구간만, elevationService에서 채워짐)
  elevationProfile?: ElevationPoint[];   // 샘플링된 좌표 + 고도
  slopeSegments?: number[];              // rise/run 경사도 배열
}

// Pareto-최적 경로 옵션 1개
export interface RouteOption {
  totalTimeMin: number;
  transferCount: number;
  walkDistanceM: number;
  walkTimeSec: number;
  waitTimeSec: number;
  isSubwayOnly: boolean;
  legs: RouteLeg[];
}

// RAPTOR 경로 탐색 결과 인터페이스 (기존 score.ts와 호환)
export interface RouteResult {
  totalTimeMin: number;
  transferCount: number;
  walkDistanceM: number;
  walkTimeMin?: number;   // 분 (하위 호환)
  walkTimeSec?: number;   // 초 (MK3 GTT 계산용)
  waitTimeMin: number;    // 분 (하위 호환)
  waitTimeSec?: number;   // 초 (MK3 GTT 계산용)
  hasLowFloor: boolean;
  isSubwayOnly: boolean;
  success: boolean;
  message?: string;
  isFallback?: boolean;
  fallbackReason?: 'tooClose' | 'apiError';
  // 경로 옵션 (Pareto-최적 전체, 폴리라인 포함)
  legs?: RouteLeg[];          // 최적(가장 빠른) 경로의 legs
  routes?: RouteOption[];     // 전체 Pareto 경로 배열
  // 고도/경사 보정 데이터 (elevationService에서 채워짐, 실패 시 absent)
  elevationGain?: number;      // 총 오르막 고도 (m)
  elevationLoss?: number;      // 총 내리막 고도 (m)
  slopePenaltyMin?: number;    // 경사 패널티 (분) = 보정 후 - 보정 전
  walkTimeSlopeMin?: number;   // 토블러 보정 도보시간 (분)
  walkTimeFlatMin?: number;    // OTP2 원래 도보시간 (분, 보정 전)
}

// 하버사인 공식 (km)
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// 출발 시각: 오전 9시 고정 (관광객 이동 시간대, 결정론적 점수)
// 실시간 시각 기반 시 버스 출발 타이밍에 따라 점수가 요동치는 문제를 방지
const CANONICAL_DEPARTURE_SEC = 9 * 3600;

// ── 개발용 RAPTOR 경로 디버그 로거 ──────────────────────────────────────
// 활성화: 백엔드 .env 에 DEBUG_RAPTOR=true 추가 후 서버 재시작
const DEBUG_RAPTOR = process.env.DEBUG_RAPTOR === 'true';

function logRaptorResult(
  originLat: number, originLng: number,
  destLat: number,   destLng: number,
  routes: import('./raptor').RaptorRouteOption[]
): void {
  if (!DEBUG_RAPTOR) return;

  const header = `[RAPTOR DEBUG] (${originLat.toFixed(4)},${originLng.toFixed(4)}) → (${destLat.toFixed(4)},${destLng.toFixed(4)})`;
  console.log('\n' + '═'.repeat(70));
  console.log(header);

  if (routes.length === 0) {
    console.log('  ❌ 경로 없음 (fallback 사용)');
    console.log('═'.repeat(70));
    return;
  }

  routes.forEach((route, ri) => {
    const tag = ri === 0 ? '★ 최적' : `  ${ri + 1}안`;
    console.log(`\n  [${tag}] 총 ${route.totalTimeMin}분 | 환승 ${route.transferCount}회 | 도보 ${route.walkDistanceM}m | 예상대기 ${(route.waitTimeSec / 60).toFixed(1)}분`);

    route.legs.forEach((leg, li) => {
      const idx = `  ${li + 1}`;
      if (leg.mode === 'walk') {
        const distM = leg.coords.length >= 2
          ? Math.round(leg.durationSec * 1.2)  // walkSpeedMps=1.2 역산
          : 0;
        console.log(`  ${idx}. 🚶 도보 ${Math.round(leg.durationSec / 60)}분`);
      } else {
        const modeIcon = leg.mode === 'subway' ? '🚇' : '🚌';
        const line = leg.routeShortName ?? leg.mode;
        const stops = leg.coords.length;
        console.log(`  ${idx}. ${modeIcon} ${line}: ${leg.boardStopName ?? '?'} → ${leg.alightStopName ?? '?'} (${stops}정류장, ${Math.round(leg.durationSec / 60)}분)`);
      }
    });
  });

  console.log('═'.repeat(70) + '\n');
}

/**
 * GTFS 기반 I-RAPTOR 대중교통 경로 탐색
 * - 기존 fetchOdsayRoute의 드롭인 대체 (시그니처 동일)
 * - Redis 캐시 유지
 * - 실패 시 하버사인 기반 자체 추정 폴백
 */
export const fetchRaptorRoute = async (
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<RouteResult> => {
  // Redis 캐시 조회
  const cached = await getCachedRoute(originLat, originLng, destLat, destLng);
  if (cached) {
    console.log('Redis 캐시 히트:', { originLat, originLng, destLat, destLng });
    return cached;
  }

  // 출발-도착 직선거리 < 500m면 도보 전용 처리 (tooClose)
  const distanceKm = getDistanceFromLatLonInKm(originLat, originLng, destLat, destLng);
  if (distanceKm < 0.5) {
    const estimatedWalkM = Math.round(distanceKm * 1000);
    const tooCloseWalkSec = Math.round(estimatedWalkM / 1.2);
    const result: RouteResult = {
      success: true,
      isFallback: true,
      fallbackReason: 'tooClose',
      totalTimeMin: Math.max(3, Math.round((estimatedWalkM / 1000 / 5) * 60)),
      transferCount: 0,
      walkDistanceM: estimatedWalkM,
      walkTimeSec: tooCloseWalkSec,
      walkTimeMin: tooCloseWalkSec / 60,
      waitTimeMin: 0,
      waitTimeSec: 0,
      hasLowFloor: false,
      isSubwayOnly: false,
    };
    setCachedRoute(originLat, originLng, destLat, destLng, result).catch(() => {});
    return result;
  }

  try {
    const raptor = await runRaptor({
      originLat,
      originLon: originLng,
      destLat,
      destLon: destLng,
      departureSec: CANONICAL_DEPARTURE_SEC,
    });

    if (!raptor.success || raptor.routes.length === 0) {
      logRaptorResult(originLat, originLng, destLat, destLng, []);
      throw new Error('RAPTOR no path');
    }

    // 디버그 로그 (DEBUG_RAPTOR=true 일 때만 출력)
    logRaptorResult(originLat, originLng, destLat, destLng, raptor.routes);

    // 가장 빠른 경로를 기본 (점수 산출용)
    const best = raptor.routes[0];

    // lon → lng 변환 (카카오맵 프론트엔드용)
    const convertLegs = (legs: import('./raptor').RaptorLeg[]): RouteLeg[] =>
      legs.map((l) => ({
        mode: l.mode,
        routeShortName: l.routeShortName,
        boardStopName: l.boardStopName,
        alightStopName: l.alightStopName,
        coords: l.coords.map((c) => ({ lat: c.lat, lng: c.lon })),
        durationSec: l.durationSec,
      }));

    const routes: RouteOption[] = raptor.routes.map((r) => ({
      totalTimeMin: r.totalTimeMin,
      transferCount: r.transferCount,
      walkDistanceM: r.walkDistanceM,
      walkTimeSec: r.walkTimeSec,
      waitTimeSec: r.waitTimeSec,
      isSubwayOnly: r.isSubwayOnly,
      legs: convertLegs(r.legs),
    }));

    const result: RouteResult = {
      success: true,
      isFallback: false,
      totalTimeMin: best.totalTimeMin,
      transferCount: best.transferCount,
      walkDistanceM: best.walkDistanceM,
      walkTimeMin: best.walkTimeSec / 60,
      walkTimeSec: best.walkTimeSec,
      waitTimeMin: best.waitTimeSec / 60,
      waitTimeSec: best.waitTimeSec,
      hasLowFloor: false,
      isSubwayOnly: best.isSubwayOnly,
      legs: convertLegs(best.legs),
      routes,
    };

    setCachedRoute(originLat, originLng, destLat, destLng, result).catch(() => {});
    return result;
  } catch (error: any) {
    console.error('RAPTOR 경로 탐색 실패, 하버사인 폴백:', error?.message || error);

    const estimatedTimeMin = Math.max(5, Math.round((distanceKm / 15) * 60));
    const estimatedWalkM = Math.round(distanceKm * 1000 * 0.15);
    let estimatedTransfers = 0;
    if (distanceKm > 10) estimatedTransfers = 1;
    if (distanceKm > 20) estimatedTransfers = 2;

    return {
      success: true,
      message: 'RAPTOR 실패: 자체 추정치로 계산되었습니다.',
      isFallback: true,
      fallbackReason: 'apiError',
      totalTimeMin: estimatedTimeMin,
      transferCount: estimatedTransfers,
      walkDistanceM: estimatedWalkM,
      walkTimeSec: Math.round(estimatedWalkM / 1.2),
      walkTimeMin: estimatedWalkM / 1.2 / 60,
      waitTimeMin: 10,
      waitTimeSec: 600,
      hasLowFloor: false,
      isSubwayOnly: false,
    };
  }
};

// ──────────────────────────────────────────────
// [레거시] ODsay + BusanBIMS + opentopodata 기반 구현
// RAPTOR 도입 전 사용하던 외부 API 연동 코드.
// ODSAY_API_KEY / PUBLIC_DATA_API_KEY 환경변수 필요.
// ──────────────────────────────────────────────

const BUSAN_BIMS_KEY = process.env.PUBLIC_DATA_API_KEY || '';
const BUSAN_BIMS_BASE = 'https://apis.data.go.kr/6260000/BusanBIMS';

async function fetchBstopId(stationName: string): Promise<string | null> {
  try {
    const res = await axios.get(`${BUSAN_BIMS_BASE}/busStopList`, {
      params: { serviceKey: BUSAN_BIMS_KEY, bstopnm: stationName, pageNo: 1, numOfRows: 1 }
    });
    const parsed = await parseStringPromise(res.data, { explicitArray: false });
    const item = parsed?.response?.body?.items?.item;
    return item?.bstopid ?? null;
  } catch {
    return null;
  }
}

async function fetchBusArrivalInfo(bstopid: string): Promise<{ waitTimeMin: number; hasLowFloor: boolean }> {
  try {
    const res = await axios.get(`${BUSAN_BIMS_BASE}/stopArrByBstopid`, {
      params: { serviceKey: BUSAN_BIMS_KEY, bstopid, pageNo: 1, numOfRows: 10 }
    });
    const parsed = await parseStringPromise(res.data, { explicitArray: false });
    const items = parsed?.response?.body?.items?.item;
    if (!items) return { waitTimeMin: 5, hasLowFloor: false };
    const arr = Array.isArray(items) ? items : [items];
    const mins = arr.map((it: any) => parseInt(it.min1, 10)).filter((m: number) => !isNaN(m) && m >= 0);
    const waitTimeMin = mins.length > 0 ? Math.min(...mins) : 5;
    const minIdx = arr.findIndex((it: any) => parseInt(it.min1, 10) === waitTimeMin);
    const hasLowFloor = minIdx >= 0 && arr[minIdx]?.lowplate1 === '1';
    return { waitTimeMin, hasLowFloor };
  } catch {
    return { waitTimeMin: 5, hasLowFloor: false };
  }
}

function extractFirstBusStopName(subPaths: any[]): string | null {
  if (!Array.isArray(subPaths)) return null;
  const busSub = subPaths.find((sp: any) => sp.trafficType === 2);
  return busSub?.startName ?? null;
}

function extractSubwayWaitTime(subPaths: any[]): number | null {
  if (!Array.isArray(subPaths)) return null;
  const subwaySub = subPaths.find((sp: any) => sp.trafficType === 1);
  if (!subwaySub) return null;
  const intervalMin = parseInt(subwaySub.intervalTime, 10);
  return !isNaN(intervalMin) && intervalMin > 0 ? Math.round(intervalMin / 2) : null;
}

async function fetchElevations(coords: [number, number][]): Promise<(number | null)[]> {
  if (coords.length === 0) return [];
  try {
    const locations = coords.map(([lng, lat]) => `${lat},${lng}`).join('|');
    const res = await axios.get('https://api.opentopodata.org/v1/srtm30m', {
      params: { locations },
      timeout: 8000
    });
    const results = res.data?.results;
    if (!Array.isArray(results)) return coords.map(() => null);
    return results.map((r: any) => (typeof r.elevation === 'number' ? r.elevation : null));
  } catch (e: any) {
    console.warn('[fetchElevations] 고도 조회 실패:', e.response?.status, e.message);
    return coords.map(() => null);
  }
}

function toblerSpeed(slope: number): number {
  return 6 * Math.exp(-3.5 * Math.abs(slope + 0.05));
}

async function calculateToblerWalkTime(
  totalWalkM: number,
  originLng: number, originLat: number,
  destLng: number, destLat: number
): Promise<number | null> {
  if (totalWalkM <= 0) return null;
  const elevations = await fetchElevations([[originLng, originLat], [destLng, destLat]]);
  const h0 = elevations[0];
  const h1 = elevations[1];
  if (h0 === null || h1 === null) return null;
  const slope = (h1 - h0) / totalWalkM;
  const speed = toblerSpeed(slope);
  const walkTimeMin = ((totalWalkM / 1000) / speed) * 60;
  return walkTimeMin > 0 ? walkTimeMin : null;
}

export const fetchOdsayRoute = async (
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<RouteResult> => {
  const cached = await getCachedRoute(originLat, originLng, destLat, destLng);
  if (cached) {
    console.log('Redis 캐시 히트:', { originLat, originLng, destLat, destLng });
    return cached;
  }

  try {
    const odsayApiKey = process.env.ODSAY_API_KEY;
    if (!odsayApiKey) throw new Error('ODSAY_API_KEY is not defined in .env');

    const url = 'https://api.odsay.com/v1/api/searchPubTransPathT';
    const response = await axios.get(url, {
      params: { SX: originLng, SY: originLat, EX: destLng, EY: destLat, apiKey: odsayApiKey },
      headers: {
        'Origin': process.env.ODSAY_ORIGIN || 'http://localhost:5001',
        'Referer': (process.env.ODSAY_ORIGIN || 'http://localhost:5001') + '/'
      }
    });

    const data = response.data;
    if (data.error) {
      const errMsg = Array.isArray(data.error) ? data.error[0].message : (data.error.msg || '알 수 없는 에러');
      throw new Error(`ODsay API 에러: ${errMsg}`);
    }

    if (data?.result?.path?.length > 0) {
      const bestPath = data.result.path[0];
      const bestPathInfo = bestPath.info;
      const isSubwayOnly = !Array.isArray(bestPath.subPath) ||
        !bestPath.subPath.some((sp: any) => sp.trafficType === 2);

      let waitTimeMin = 10;
      let hasLowFloor = false;
      const busStopName = extractFirstBusStopName(bestPath.subPath);
      if (busStopName) {
        const bstopid = await fetchBstopId(busStopName);
        if (bstopid) {
          const arrInfo = await fetchBusArrivalInfo(bstopid);
          waitTimeMin = arrInfo.waitTimeMin;
          hasLowFloor = arrInfo.hasLowFloor;
        }
      } else {
        const subwayWait = extractSubwayWaitTime(bestPath.subPath);
        if (subwayWait !== null) waitTimeMin = subwayWait;
      }

      const totalWalkM = bestPathInfo.totalWalk || 0;
      const walkTimeMin = await calculateToblerWalkTime(totalWalkM, originLng, originLat, destLng, destLat);

      const result: RouteResult = {
        success: true,
        isFallback: false,
        totalTimeMin: bestPathInfo.totalTime || 0,
        transferCount: Math.max(0, (bestPathInfo.busTransitCount || 0) + (bestPathInfo.subwayTransitCount || 0) - 1),
        walkDistanceM: bestPathInfo.totalWalk || 0,
        walkTimeMin: walkTimeMin ?? undefined,
        waitTimeMin,
        hasLowFloor,
        isSubwayOnly,
      };
      setCachedRoute(originLat, originLng, destLat, destLng, result).catch(() => {});
      return result;
    } else {
      const distanceKm = getDistanceFromLatLonInKm(originLat, originLng, destLat, destLng);
      const estimatedWalkM = Math.round(distanceKm * 1000);
      return {
        success: true,
        isFallback: true,
        fallbackReason: 'tooClose',
        totalTimeMin: Math.max(3, Math.round((estimatedWalkM / 1000 / 5) * 60)),
        transferCount: 0,
        walkDistanceM: estimatedWalkM,
        waitTimeMin: 0,
        hasLowFloor: false,
        isSubwayOnly: false,
      };
    }
  } catch (error: any) {
    console.error('ODsay 경로 호출 실패, 자체 추정 로직(Fallback) 가동:', error.response?.data || error.message);
    const distanceKm = getDistanceFromLatLonInKm(originLat, originLng, destLat, destLng);
    const estimatedTimeMin = Math.max(5, Math.round((distanceKm / 15) * 60));
    const estimatedWalkM = Math.round(distanceKm * 1000 * 0.15);
    let estimatedTransfers = 0;
    if (distanceKm > 10) estimatedTransfers = 1;
    if (distanceKm > 20) estimatedTransfers = 2;
    return {
      success: true,
      message: 'API 호출 실패: 자체 추정치로 계산되었습니다.',
      isFallback: true,
      fallbackReason: 'apiError',
      totalTimeMin: estimatedTimeMin,
      transferCount: estimatedTransfers,
      walkDistanceM: estimatedWalkM,
      waitTimeMin: 10,
      hasLowFloor: false,
      isSubwayOnly: false,
    };
  }
};
