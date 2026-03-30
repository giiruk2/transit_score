import { RouteResult } from './routeService';

export interface ScoreBreakdown {
  s_time: number;
  s_transfer: number;
  s_walk: number;
  s_wait: number;
  s_access: number;
}

export interface FinalScoreResult {
  finalScore: number;
  breakdown: ScoreBreakdown;
  rawParams: RouteResult;
}

/**
 * 접근성 점수 정규화 및 가중합 계산 알고리즘
 * 0~100점 사이로 환산 (연구 보고서 수식 참조)
 */
export interface Weights {
  time: number;
  transfer: number;
  walk: number;
  wait: number;
  access: number;
}

export const DEFAULT_WEIGHTS: Weights = {
  time: 0.45,
  transfer: 0.20,
  walk: 0.15,
  wait: 0.10,
  access: 0.10
};

export const calculateAccessibilityScore = (
  routeData: RouteResult,
  accessScoreFactor: number = 0.5,
  weights: Weights = DEFAULT_WEIGHTS
): FinalScoreResult => {
  // 1. 시간 점수 정규화 (T_best = 20분, T_worst = 120분)
  let s_time = 1 - (routeData.totalTimeMin - 20) / (120 - 20);
  if (s_time > 1) s_time = 1;
  if (s_time < 0) s_time = 0;

  // 2. 환승 점수 (계단형 패널티)
  let s_transfer = 1.0;
  if (routeData.transferCount === 1) s_transfer = 0.75;
  else if (routeData.transferCount === 2) s_transfer = 0.5;
  else if (routeData.transferCount === 3) s_transfer = 0.25;
  else if (routeData.transferCount >= 4) s_transfer = 0.1;

  // 3. 도보 점수 — 토블러 함수 적용 시 시간 기반, 미적용 시 거리 기반 폴백
  // 320 정규화 기준: T≤15분 → 1.0 / 15<T<30분 → 선형감소 / T≥30분 → 0.0
  let s_walk: number;
  if (routeData.walkTimeMin !== undefined && routeData.walkTimeMin > 0) {
    const t = routeData.walkTimeMin;
    if (t <= 15) s_walk = 1.0;
    else if (t < 30) s_walk = 1.0 - (t - 15) / 15;
    else s_walk = 0.0;
  } else {
    s_walk = 1 - (routeData.walkDistanceM / 1200); // 거리 기반 폴백
  }
  if (s_walk > 1) s_walk = 1;
  if (s_walk < 0) s_walk = 0;

  // 4. 대기 점수 — 구간별 패널티 함수 (320 기준)
  // 5분 이하: 만점 / 5~20분: 선형 감소 / 20분 초과: 최저 0.1
  let s_wait: number;
  if (routeData.waitTimeMin <= 5) {
    s_wait = 1.0;
  } else if (routeData.waitTimeMin <= 20) {
    s_wait = 1.0 - (routeData.waitTimeMin - 5) / 15;
  } else {
    s_wait = 0.1;
  }

  // 5. 무장애 점수 — 저상버스 탑승 시 1.0으로 상향
  const s_access = routeData.hasLowFloor ? 1.0 : accessScoreFactor;

  // 6. 가중합 기반 최종 점수 산출
  const finalScoreRaw = 100 * (
    weights.time     * s_time +
    weights.transfer * s_transfer +
    weights.walk     * s_walk +
    weights.wait     * s_wait +
    weights.access   * s_access
  );

  return {
    finalScore: Number(finalScoreRaw.toFixed(1)),
    breakdown: {
      s_time: Number(s_time.toFixed(4)),
      s_transfer: Number(s_transfer.toFixed(4)),
      s_walk: Number(s_walk.toFixed(4)),
      s_wait: Number(s_wait.toFixed(4)),
      s_access: Number(s_access.toFixed(4)),
    },
    rawParams: routeData
  };
};
