import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import { getCachedRoute, setCachedRoute } from './redisCache';

// TMAP 경로 탐색 결과 인터페이스 (필요한 데이터만 추출)
export interface RouteResult {
  totalTimeMin: number;
  transferCount: number;
  walkDistanceM: number;
  walkTimeMin?: number; // 토블러 함수 적용 유효 도보시간(분), 없으면 거리 기반 폴백
  waitTimeMin: number;
  hasLowFloor: boolean; // 탑승 예정 버스가 저상버스인지 여부
  success: boolean;
  message?: string;
  isFallback?: boolean;
  fallbackReason?: 'tooClose' | 'apiError';
}

const BUSAN_BIMS_KEY = process.env.PUBLIC_DATA_API_KEY || '';
const BUSAN_BIMS_BASE = 'https://apis.data.go.kr/6260000/BusanBIMS';

// BusanBIMS에서 정류소명으로 bstopid 조회
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

// BusanBIMS 실시간 도착정보에서 최소 대기시간(분) + 저상버스 여부 조회
async function fetchBusArrivalInfo(bstopid: string): Promise<{ waitTimeMin: number; hasLowFloor: boolean }> {
  try {
    const res = await axios.get(`${BUSAN_BIMS_BASE}/stopArrByBstopid`, {
      params: { serviceKey: BUSAN_BIMS_KEY, bstopid, pageNo: 1, numOfRows: 10 }
    });
    const parsed = await parseStringPromise(res.data, { explicitArray: false });
    const items = parsed?.response?.body?.items?.item;
    if (!items) return { waitTimeMin: 5, hasLowFloor: false };

    const arr = Array.isArray(items) ? items : [items];
    const mins = arr
      .map((it: any) => parseInt(it.min1, 10))
      .filter((m: number) => !isNaN(m) && m >= 0);

    const waitTimeMin = mins.length > 0 ? Math.min(...mins) : 5;

    // 최소 대기 버스의 저상버스 여부 확인 (arr에서 직접 탐색 - mins 필터링으로 인한 인덱스 불일치 방지)
    const minIdx = arr.findIndex((it: any) => parseInt(it.min1, 10) === waitTimeMin);
    const hasLowFloor = minIdx >= 0 && arr[minIdx]?.lowplate1 === '1';

    return { waitTimeMin, hasLowFloor };
  } catch {
    return { waitTimeMin: 5, hasLowFloor: false };
  }
}

// ODsay subPath에서 첫 번째 버스 정류소명 추출 (trafficType 2=버스)
function extractFirstBusStopName(subPaths: any[]): string | null {
  if (!Array.isArray(subPaths)) return null;
  const busSub = subPaths.find((sp: any) => sp.trafficType === 2);
  return busSub?.startName ?? null;
}

// ODsay subPath에서 지하철 배차간격 기반 예상 대기시간 추출 (trafficType 1=지하철)
// 배차간격의 절반을 기대 대기시간으로 사용 (랜덤 도착 가정)
function extractSubwayWaitTime(subPaths: any[]): number | null {
  if (!Array.isArray(subPaths)) return null;
  const subwaySub = subPaths.find((sp: any) => sp.trafficType === 1);
  if (!subwaySub) return null;
  const intervalMin = parseInt(subwaySub.intervalTime, 10);
  return !isNaN(intervalMin) && intervalMin > 0 ? Math.round(intervalMin / 2) : null;
}

// opentopodata.org SRTM30m API로 다중 좌표 고도(m) 배치 조회 (무료, 키 불필요)
// 단일 API 호출로 여러 좌표 처리 → Vworld DEM 대체
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

//토블러 하이킹 함수: 경사도 S → 보행속도(km/h)
function toblerSpeed(slope: number): number {
  return 6 * Math.exp(-3.5 * Math.abs(slope + 0.05));
}

// 출발지·도착지 고도 기반 토블러 유효 도보시간(분) 산출
// ODsay 무료플랜은 도보 구간 폴리라인 미제공 → 전체 경사도 추정 방식 사용
async function calculateToblerWalkTime(
  totalWalkM: number,
  originLng: number, originLat: number,
  destLng: number, destLat: number
): Promise<number | null> {
  if (totalWalkM <= 0) return null;

  // 출발지·도착지 고도 배치 조회 (opentopodata, 단 2회 호출)
  const elevations = await fetchElevations([
    [originLng, originLat],
    [destLng, destLat]
  ]);

  const h0 = elevations[0];
  const h1 = elevations[1];

  // 고도 조회 실패 시 폴백
  if (h0 === null || h1 === null) return null;

  // 전체 고도차 기반 평균 경사도 (Δh / 도보거리)
  const slope = (h1 - h0) / totalWalkM;

  const speed = toblerSpeed(slope); // km/h
  const walkTimeMin = ((totalWalkM / 1000) / speed) * 60; // 분

  return walkTimeMin > 0 ? walkTimeMin : null;
}

// 하버사인 공식을 이용한 두 좌표 간 직선 거리 계산 (단위: km)
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // 지구 반지름 (km)
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  return R * c;
}

export const fetchOdsayRoute = async (
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<RouteResult> => {
  // Redis 캐시 조회 (ODsay 일 1,000건 한도 대응)
  const cached = await getCachedRoute(originLat, originLng, destLat, destLng);
  if (cached) {
    console.log('Redis 캐시 히트:', { originLat, originLng, destLat, destLng });
    return cached;
  }

  try {
    const odsayApiKey = process.env.ODSAY_API_KEY;
    if (!odsayApiKey) {
      throw new Error('ODSAY_API_KEY is not defined in .env');
    }

    // ODsay 대중교통 길찾기 API URL
    const url = 'https://api.odsay.com/v1/api/searchPubTransPathT';
    
    const response = await axios.get(url, {
      params: {
        SX: originLng, // 출발지 경도
        SY: originLat, // 출발지 위도
        EX: destLng,   // 도착지 경도
        EY: destLat,   // 도착지 위도
        apiKey: odsayApiKey
      },
      headers: {
        // ODsay 콘솔 Web 도메인에 등록된 정확한 URL 매칭
        'Origin': process.env.ODSAY_ORIGIN || 'http://localhost:5001',
        'Referer': (process.env.ODSAY_ORIGIN || 'http://localhost:5001') + '/'
      }
    });

    const data = response.data;
    
    // ODsay 응답 에러 처리
    if (data.error) {
       const errMsg = Array.isArray(data.error) ? data.error[0].message : (data.error.msg || '알 수 없는 에러');
       throw new Error(`ODsay API 에러: ${errMsg}`);
    }

    // ODsay 길찾기 결과 파싱 (첫 번째 최적 경로 기준)
    if (data && data.result && data.result.path && data.result.path.length > 0) {
      const bestPath = data.result.path[0];
      const bestPathInfo = bestPath.info;

      // 대기시간 산출: 버스는 BusanBIMS 실시간, 지하철은 배차간격/2 사용
      let waitTimeMin = 5;
      let hasLowFloor = false;
      const busStopName = extractFirstBusStopName(bestPath.subPath);
      if (busStopName) {
        // 버스 경로: BusanBIMS 실시간 도착정보
        const bstopid = await fetchBstopId(busStopName);
        if (bstopid) {
          const arrInfo = await fetchBusArrivalInfo(bstopid);
          waitTimeMin = arrInfo.waitTimeMin;
          hasLowFloor = arrInfo.hasLowFloor;
        }
      } else {
        // 지하철 전용 경로: ODsay 배차간격의 절반
        const subwayWait = extractSubwayWaitTime(bestPath.subPath);
        if (subwayWait !== null) waitTimeMin = subwayWait;
      }

      // 도보 시간 산출 (토블러 함수 + opentopodata 고도 API)
      const totalWalkM = bestPathInfo.totalWalk || 0;
      const walkTimeMin = await calculateToblerWalkTime(totalWalkM, originLng, originLat, destLng, destLat);

      const result: RouteResult = {
        success: true,
        isFallback: false,
        totalTimeMin: bestPathInfo.totalTime || 0,
        transferCount: (bestPathInfo.busTransitCount || 0) + (bestPathInfo.subwayTransitCount || 0) - 1 > 0 ? (bestPathInfo.busTransitCount || 0) + (bestPathInfo.subwayTransitCount || 0) - 1 : 0,
        walkDistanceM: bestPathInfo.totalWalk || 0,
        walkTimeMin: walkTimeMin ?? undefined,
        waitTimeMin,
        hasLowFloor
      };

      // Redis 캐시 저장 (비동기, 실패해도 무시)
      setCachedRoute(originLat, originLng, destLat, destLng, result).catch(() => {});

      return result;
    } else {
      // 경로 없음 → 출발지와 목적지가 너무 가까운 경우
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
        hasLowFloor: false
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
      hasLowFloor: false
    };
  }
};
