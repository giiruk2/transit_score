/**
 * OTP2 (OpenTripPlanner 2) 경로 탐색 서비스
 */

import axios from 'axios';
import { getCachedRoute, setCachedRoute } from './redisCache';
import type { RouteResult, RouteOption, RouteLeg } from './routeService';
import { calculateWalkElevation } from './elevationService';

const OTP_BASE = process.env.OTP_URL || 'http://localhost:8080';
const CANONICAL_TIME = '9:00am';

function getCanonicalDate(): string {
  // 다음 월요일 (주중 고정 기준일) — GTFS 서비스 기간 내에 항상 속하도록 동적 생성
  const d = new Date();
  const daysUntilMonday = (8 - d.getDay()) % 7 || 7;
  d.setDate(d.getDate() + daysUntilMonday);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}
const MAX_WALK_DISTANCE_M = 2000;
const WALK_SPEED_MPS = 1.2;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function decodePolyline(encoded: string): { lat: number; lng: number }[] {
  const coords: { lat: number; lng: number }[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    coords.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return coords;
}

function convertOtpLeg(leg: any, roadCoords?: { lat: number; lng: number }[]): RouteLeg {
  const otpMode: string = (leg.mode ?? '').toUpperCase();
  const mode: 'walk' | 'bus' | 'subway' =
    otpMode === 'WALK'
      ? 'walk'
      : otpMode === 'SUBWAY' || otpMode === 'RAIL'
      ? 'subway'
      : 'bus';

  const fallbackCoords: { lat: number; lng: number }[] =
    leg.legGeometry?.points
      ? decodePolyline(leg.legGeometry.points)
      : [
          { lat: leg.from?.lat ?? 0, lng: leg.from?.lon ?? 0 },
          { lat: leg.to?.lat ?? 0, lng: leg.to?.lon ?? 0 },
        ];

  const coords = (mode === 'bus' && roadCoords && roadCoords.length >= 2)
    ? roadCoords
    : fallbackCoords;

  const rawDuration = Math.round(leg.duration ?? 0);
  const durationSec = mode === 'bus' ? rawDuration * 2 : rawDuration;

  return {
    mode,
    routeShortName: leg.routeShortName ?? leg.route ?? undefined,
    boardStopName: leg.from?.name ?? undefined,
    alightStopName: leg.to?.name ?? undefined,
    coords,
    durationSec,
  };
}

async function fetchRoadGeometry(
  fromLat: number, fromLon: number,
  toLat: number, toLon: number,
  date: string,
): Promise<{ lat: number; lng: number }[] | null> {
  try {
    const res = await axios.get(`${OTP_BASE}/otp/routers/default/plan`, {
      params: {
        fromPlace: `${fromLat},${fromLon}`,
        toPlace: `${toLat},${toLon}`,
        date,
        time: CANONICAL_TIME,
        mode: 'WALK',
        numItineraries: 1,
      },
      timeout: 5000,
    });
    const leg = res.data?.plan?.itineraries?.[0]?.legs?.[0];
    if (!leg?.legGeometry?.points) return null;
    return decodePolyline(leg.legGeometry.points);
  } catch {
    return null;
  }
}

async function convertItinerary(itin: any, date: string): Promise<RouteOption> {
  const rawLegs: any[] = itin.legs ?? [];

  // 버스 leg의 도로 geometry를 병렬로 가져오기
  const roadCoordsMap = new Map<number, { lat: number; lng: number }[]>();
  await Promise.all(
    rawLegs.map(async (leg, i) => {
      const mode = (leg.mode ?? '').toUpperCase();
      if (mode !== 'WALK' && mode !== 'SUBWAY' && mode !== 'RAIL') {
        const coords = await fetchRoadGeometry(
          leg.from.lat, leg.from.lon,
          leg.to.lat, leg.to.lon,
          date,
        );
        if (coords) roadCoordsMap.set(i, coords);
      }
    })
  );

  const legs: RouteLeg[] = rawLegs.map((leg, i) => convertOtpLeg(leg, roadCoordsMap.get(i)));

  const transitLegs = legs.filter((l) => l.mode !== 'walk');
  const isSubwayOnly =
    transitLegs.length > 0 &&
    transitLegs.every((l) => l.mode === 'subway');

  const walkTimeSec = legs
    .filter((l) => l.mode === 'walk')
    .reduce((sum, l) => sum + l.durationSec, 0);

  const totalTimeSec = legs.reduce((sum, l) => sum + l.durationSec, 0);

  return {
    totalTimeMin: Math.max(1, Math.round(totalTimeSec / 60)),
    transferCount: itin.transfers ?? 0,
    walkDistanceM: Math.round(itin.walkDistance ?? 0),
    walkTimeSec: Math.round(walkTimeSec),
    waitTimeSec: Math.round(itin.waitingTime ?? 0),
    isSubwayOnly,
    legs,
  };
}

export const fetchOtpRoute = async (
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
): Promise<RouteResult> => {
  const cached = await getCachedRoute(originLat, originLng, destLat, destLng);
  if (cached) {
    console.log('[OTP] 캐시 히트:', { originLat, originLng, destLat, destLng });
    return cached;
  }

  const distanceKm = haversineKm(originLat, originLng, destLat, destLng);

  if (distanceKm < 0.5) {
    const walkM = Math.round(distanceKm * 1000);
    const walkSec = Math.round(walkM / WALK_SPEED_MPS);
    const result: RouteResult = {
      success: true,
      isFallback: true,
      fallbackReason: 'tooClose',
      totalTimeMin: Math.max(3, Math.round((walkM / 1000 / 5) * 60)),
      transferCount: 0,
      walkDistanceM: walkM,
      walkTimeSec: walkSec,
      walkTimeMin: walkSec / 60,
      waitTimeMin: 0,
      waitTimeSec: 0,
      hasLowFloor: false,
      isSubwayOnly: false,
    };
    setCachedRoute(originLat, originLng, destLat, destLng, result).catch(() => {});
    return result;
  }

  const commonParams = {
    fromPlace: `${originLat},${originLng}`,
    toPlace:   `${destLat},${destLng}`,
    date:      getCanonicalDate(),
    time:      CANONICAL_TIME,
    maxWalkDistance: MAX_WALK_DISTANCE_M,
    walkSpeed: WALK_SPEED_MPS,
    locale:    'ko',
  };

  try {
    const [transitRes, subwayRes] = await Promise.all([
      axios.get(`${OTP_BASE}/otp/routers/default/plan`, {
        params: { ...commonParams, mode: 'TRANSIT,WALK', numItineraries: 5 },
        timeout: 15000,
      }),
      axios.get(`${OTP_BASE}/otp/routers/default/plan`, {
        params: { ...commonParams, mode: 'SUBWAY,WALK', numItineraries: 3 },
        timeout: 15000,
      }).catch(() => ({ data: {} })),
    ]);

    const allItineraries: any[] = [
      ...(transitRes.data?.plan?.itineraries ?? []),
      ...(subwayRes.data?.plan?.itineraries ?? []),
    ];

    const otpError = transitRes.data?.error?.message;
    if (allItineraries.length === 0) {
      throw new Error(otpError ? `OTP: ${otpError}` : 'OTP: 경로 없음');
    }

    const date = getCanonicalDate();
    const routes: RouteOption[] = await Promise.all(
      allItineraries.map((itin) => convertItinerary(itin, date))
    ).then((r) => r.sort((a, b) => a.totalTimeMin - b.totalTimeMin));

    const best = routes[0];

    const result: RouteResult = {
      success: true,
      isFallback: false,
      totalTimeMin:   best.totalTimeMin,
      transferCount:  best.transferCount,
      walkDistanceM:  best.walkDistanceM,
      walkTimeMin:    best.walkTimeSec / 60,
      walkTimeSec:    best.walkTimeSec,
      waitTimeMin:    best.waitTimeSec / 60,
      waitTimeSec:    best.waitTimeSec,
      hasLowFloor:    false,
      isSubwayOnly:   best.isSubwayOnly,
      legs:           best.legs,
      routes,
    };

    // 고도/경사 보정 (실패해도 결과에 영향 없음)
    try {
      const walkLegs = (best.legs ?? [])
        .filter((l) => l.mode === 'walk' && l.coords.length >= 2)
        .map((l) => ({ coords: l.coords, durationSec: l.durationSec }));

      if (walkLegs.length > 0) {
        const elevResult = await calculateWalkElevation(walkLegs);
        if (elevResult) {
          result.elevationGain    = elevResult.elevationGain;
          result.elevationLoss    = elevResult.elevationLoss;
          result.slopePenaltyMin  = elevResult.slopePenaltyMin;
          result.walkTimeSlopeMin = elevResult.walkTimeSlopeMin;
          result.walkTimeFlatMin  = elevResult.walkTimeFlatMin;

          let elevIdx = 0;
          result.legs = (result.legs ?? []).map((leg) => {
            if (leg.mode !== 'walk' || leg.coords.length < 2) return leg;
            const legElev = elevResult.legElevations[elevIdx];
            elevIdx++;
            if (!legElev) return leg;
            return {
              ...leg,
              elevationProfile: legElev.profile,
              slopeSegments:    legElev.slopeSegments,
            };
          });
        }
      }
    } catch (elevErr: any) {
      console.warn('[OTP] 고도 보정 실패 (무시):', elevErr?.message || elevErr);
    }

    setCachedRoute(originLat, originLng, destLat, destLng, result).catch(() => {});
    return result;

  } catch (error: any) {
    console.error('[OTP] 경로 탐색 실패, 하버사인 폴백:', error?.message || error);

    const estimatedTimeMin  = Math.max(5, Math.round((distanceKm / 15) * 60));
    const estimatedWalkM    = Math.round(distanceKm * 1000 * 0.15);
    const estimatedTransfers = distanceKm > 20 ? 2 : distanceKm > 10 ? 1 : 0;

    return {
      success: true,
      message: 'OTP 실패: 자체 추정치로 계산되었습니다.',
      isFallback: true,
      fallbackReason: 'apiError',
      totalTimeMin:   estimatedTimeMin,
      transferCount:  estimatedTransfers,
      walkDistanceM:  estimatedWalkM,
      walkTimeSec:    Math.round(estimatedWalkM / WALK_SPEED_MPS),
      walkTimeMin:    estimatedWalkM / WALK_SPEED_MPS / 60,
      waitTimeMin:    10,
      waitTimeSec:    600,
      hasLowFloor:    false,
      isSubwayOnly:   false,
    };
  }
};
