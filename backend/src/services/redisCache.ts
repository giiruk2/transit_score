import Redis from 'ioredis';
import { RouteResult } from './routeService';

// Redis 연결 (REDIS_URL 없으면 null → 캐싱 비활성화)
let redis: Redis | null = null;

if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, enableReadyCheck: false });
  let warnedOnce = false;
  redis.on('error', () => {
    if (!warnedOnce) {
      console.warn('[Redis] 연결 실패 — 캐싱 비활성화 (서비스는 정상 동작)');
      warnedOnce = true;
    }
    redis = null;
  });
}

// 캐시 TTL: 1시간 (3600초)
const CACHE_TTL_SEC = 3600;

// 좌표를 50m 그리드 단위로 스냅 (도 단위 ≈ 0.00045도 ≈ 50m)
function snapToGrid(coord: number): number {
  const GRID = 0.00045;
  return Math.round(coord / GRID) * GRID;
}

// 출발지·목적지 좌표 → 캐시 키 생성
function makeCacheKey(originLat: number, originLng: number, destLat: number, destLng: number): string {
  const oLat = snapToGrid(originLat).toFixed(5);
  const oLng = snapToGrid(originLng).toFixed(5);
  const dLat = snapToGrid(destLat).toFixed(5);
  const dLng = snapToGrid(destLng).toFixed(5);
  return `route:${oLat},${oLng}:${dLat},${dLng}`;
}

// 캐시에서 경로 결과 조회
export async function getCachedRoute(
  originLat: number, originLng: number,
  destLat: number, destLng: number
): Promise<RouteResult | null> {
  if (!redis) return null;
  try {
    const key = makeCacheKey(originLat, originLng, destLat, destLng);
    const cached = await redis.get(key);
    if (!cached) return null;
    return JSON.parse(cached) as RouteResult;
  } catch {
    return null;
  }
}

// 경로 결과를 캐시에 저장 (fallback 결과는 저장하지 않음)
export async function setCachedRoute(
  originLat: number, originLng: number,
  destLat: number, destLng: number,
  result: RouteResult
): Promise<void> {
  if (!redis || result.isFallback) return;
  try {
    const key = makeCacheKey(originLat, originLng, destLat, destLng);
    await redis.set(key, JSON.stringify(result), 'EX', CACHE_TTL_SEC);
  } catch {
    // 캐시 저장 실패는 무시
  }
}
