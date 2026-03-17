import { RouteResult } from './routeService';

export interface ScoreBreakdown {
  s_time: number;
  s_transfer: number;
  s_walk: number;
  s_wait: number;
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
export const calculateAccessibilityScore = (
  routeData: RouteResult, 
  accessScoreFactor: number = 0.5 // 무장애정보 기본값 (0.5 중립)
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

  // 3. 도보 점수 (D_max = 1200m)
  let s_walk = 1 - (routeData.walkDistanceM / 1200);
  if (s_walk > 1) s_walk = 1;
  if (s_walk < 0) s_walk = 0;

  // 4. 대기 점수 (W_max = 20분)
  let s_wait = 1 - (routeData.waitTimeMin / 20);
  if (s_wait > 1) s_wait = 1;
  if (s_wait < 0) s_wait = 0;

  // 5. 무장애 점수
  const s_access = accessScoreFactor;

  // 6. 가중합 기반 최종 점수 산출
  // 시간 45%, 환승 20%, 도보 15%, 대기 10%, 무장애 10%
  const finalScoreRaw = 100 * (
    0.45 * s_time +
    0.20 * s_transfer +
    0.15 * s_walk +
    0.10 * s_wait +
    0.10 * s_access
  );

  return {
    finalScore: Number(finalScoreRaw.toFixed(1)),
    breakdown: {
      s_time: Number(s_time.toFixed(2)),
      s_transfer: Number(s_transfer.toFixed(2)),
      s_walk: Number(s_walk.toFixed(2)),
      s_wait: Number(s_wait.toFixed(2)),
    },
    rawParams: routeData
  };
};
