import { RouteResult } from './routeService';

// ── MK3 GTT 채점 모듈 ──────────────────────────────────────────────────────
// Generalized Travel Time: GTT = T_invehicle + α×T_walk + β×T_wait + γ×N_transfer
//
// 참고문헌:
//   Wardman (2001): γ ≈ 13분 (Urban Leisure 환승 패널티)
//   Wardman (2004): α = 2.0 (도보 시간은 차내 시간의 2배), β = 2.5 (대기 2.5배)
//
// 주의: raptor.ts의 transferPenaltySec = 0 전제.
//       이중 계산 방지: MK3 γ만이 환승 패널티를 담당.

export interface GttCoefficients {
  alpha: number;   // 도보 배율 (기본 2.0)
  beta:  number;   // 대기 배율 (기본 2.5)
  gamma: number;   // 환승 패널티/회 (기본 13분)
  tMax?: number;   // 최대 허용 이동시간 (분, 0 = 제한없음, totalTimeMin 기준)
}

export const DEFAULT_COEFFICIENTS: GttCoefficients = {
  alpha: 2.0,
  beta:  2.5,
  gamma: 13,
  tMax:  0,
};

export interface GttBreakdown {
  T_invehicle:        number;  // 순수 탑승시간 (분)
  T_walk_weighted:    number;  // alpha × T_walk (경사 보정 후)
  T_wait_weighted:    number;  // beta  × T_wait
  T_transfer_penalty: number;  // gamma × N_transfer
  T_walk_raw:         number;  // 도보시간 (분, 토블러 보정 후)
  T_walk_flat:        number;  // 도보시간 (분, 평지 기준 = OTP2 원본)
  T_wait_raw:         number;  // 대기시간 (분, 원본)
  N_transfer:         number;  // 환승 횟수 (원본)
  // 고도/경사 보정 데이터 (elevation 계산 성공 시에만)
  elevation_gain?:    number;  // 총 오르막 (m)
  elevation_loss?:    number;  // 총 내리막 (m)
  slope_penalty_min?: number;  // 경사 패널티 (분)
}

export type GttGrade = 'S' | 'A' | 'B' | 'C' | 'D';

export interface GttResult {
  gtt:            number;     // Generalized Travel Time (분)
  grade:          GttGrade;   // S/A/B/C/D
  breakdown:      GttBreakdown;
  rawParams:      RouteResult;
  isTMaxExceeded: boolean;    // tMax 초과 여부
}

function toGrade(gtt: number): GttGrade {
  if (gtt <= 40)  return 'S';
  if (gtt <= 80)  return 'A';
  if (gtt <= 120) return 'B';
  if (gtt <= 160) return 'C';
  return 'D';
}

/**
 * GTT 채점 함수
 * RAPTOR → RouteResult → calculateGtt() → GttResult
 */
export const calculateGtt = (
  routeData: RouteResult,
  coefficients: GttCoefficients = DEFAULT_COEFFICIENTS,
): GttResult => {
  const { alpha, beta, gamma, tMax = 0 } = coefficients;

  // 도보 시간:
  //   1순위: 토블러 보정 시간 (walkTimeSlopeMin) — 경사도 반영
  //   2순위: OTP2 원래 도보 시간 (walkTimeSec/60)
  //   3순위: 분 단위 필드, 거리 역산 폴백
  const T_walk_flat = routeData.walkTimeSec !== undefined
    ? routeData.walkTimeSec / 60
    : (routeData.walkTimeMin ?? (routeData.walkDistanceM / 1.2 / 60));

  const T_walk = routeData.walkTimeSlopeMin !== undefined
    ? routeData.walkTimeSlopeMin
    : T_walk_flat;

  const T_wait = routeData.waitTimeSec !== undefined
    ? routeData.waitTimeSec / 60
    : routeData.waitTimeMin;

  // 순수 탑승 시간 (totalTimeMin = T_invehicle + T_walk_flat + T_wait, transferPenaltySec=0 전제)
  // T_walk_flat(OTP2 원본)으로 역산해야 T_invehicle이 올바름
  const T_invehicle = Math.max(0, routeData.totalTimeMin - T_walk_flat - T_wait);
  const N_transfer  = routeData.transferCount;

  const T_walk_weighted    = alpha * T_walk;
  const T_wait_weighted    = beta  * T_wait;
  const T_transfer_penalty = gamma * N_transfer;

  const gtt = T_invehicle + T_walk_weighted + T_wait_weighted + T_transfer_penalty;

  const isTMaxExceeded = tMax > 0 && routeData.totalTimeMin > tMax;

  return {
    gtt:   Number(gtt.toFixed(1)),
    grade: toGrade(gtt),
    breakdown: {
      T_invehicle:        Number(T_invehicle.toFixed(1)),
      T_walk_weighted:    Number(T_walk_weighted.toFixed(1)),
      T_wait_weighted:    Number(T_wait_weighted.toFixed(1)),
      T_transfer_penalty: Number(T_transfer_penalty.toFixed(1)),
      T_walk_raw:         Number(T_walk.toFixed(1)),
      T_walk_flat:        Number(T_walk_flat.toFixed(1)),
      T_wait_raw:         Number(T_wait.toFixed(1)),
      N_transfer,
      ...(routeData.elevationGain    !== undefined && { elevation_gain:    routeData.elevationGain }),
      ...(routeData.elevationLoss    !== undefined && { elevation_loss:    routeData.elevationLoss }),
      ...(routeData.slopePenaltyMin  !== undefined && { slope_penalty_min: routeData.slopePenaltyMin }),
    },
    rawParams: routeData,
    isTMaxExceeded,
  };
};
