/**
 * 고도 데이터 서비스 — OpenTopoData API + 토블러 등산 함수
 *
 * 토블러 등산 함수 (Tobler's hiking function):
 *   W(s) = 6 × exp(-3.5 × |s + 0.05|)  km/h
 *   s = rise/run (경사도, 소수점)
 *   평지(s=0): ~5.04 km/h
 *   10% 오르막(s=0.1): ~3.54 km/h
 *   5% 내리막(s=-0.05): 6.00 km/h (최대)
 *
 * 참고: Tobler, W. (1993). Three Presentations on Geographical Analysis and Modeling.
 */

import axios from 'axios';

const OPENTOPODATA_BASE = process.env.OPENTOPODATA_BASE_URL || 'https://api.opentopodata.org/v1/srtm30m';

// 평지 기준 속도 (토블러 함수에서 s=0일 때)
const FLAT_KMH = 6 * Math.exp(-3.5 * Math.abs(0 + 0.05)); // ≈ 5.036 km/h

// ── 유틸 함수 ─────────────────────────────────────────────────────────────────

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// 토블러 함수: slope = 고도차 / 수평거리 (rise/run)
function toblerKmh(slope: number): number {
  return 6 * Math.exp(-3.5 * Math.abs(slope + 0.05));
}

// 좌표 배열 샘플링 (OpenTopoData 100개 제한 대응)
function sampleCoords(
  coords: { lat: number; lng: number }[],
  maxPoints: number
): { lat: number; lng: number }[] {
  if (coords.length <= maxPoints) return coords;
  const step = Math.ceil(coords.length / maxPoints);
  const result = coords.filter((_, i) => i % step === 0);
  const last = coords[coords.length - 1];
  if (result[result.length - 1] !== last) result.push(last);
  return result;
}

// ── OpenTopoData API 호출 ──────────────────────────────────────────────────────

async function fetchElevationsBatch(
  coords: { lat: number; lng: number }[]
): Promise<number[]> {
  if (coords.length === 0) return [];
  const locStr = coords.map((c) => `${c.lat},${c.lng}`).join('|');
  const res = await axios.get(OPENTOPODATA_BASE, {
    params: { locations: locStr },
    timeout: 8000,
  });
  return (res.data?.results ?? []).map((r: any) =>
    typeof r.elevation === 'number' ? r.elevation : 0
  );
}

// 100개 초과 시 배치 분할 처리
async function fetchElevations(
  coords: { lat: number; lng: number }[]
): Promise<number[]> {
  const BATCH = 100;
  const elevations: number[] = [];
  for (let i = 0; i < coords.length; i += BATCH) {
    const batch = coords.slice(i, i + BATCH);
    const batchElevs = await fetchElevationsBatch(batch);
    elevations.push(...batchElevs);
  }
  return elevations;
}

// ── 타입 정의 ─────────────────────────────────────────────────────────────────

export interface ElevationPoint {
  lat: number;
  lng: number;
  elevation: number;
}

export interface WalkLegElevation {
  profile: ElevationPoint[];    // 샘플링된 좌표 + 고도
  slopeSegments: number[];      // profile 연속 쌍 사이의 경사도 (rise/run)
  originalDurationSec: number;  // OTP2 원래 도보 시간
  adjustedDurationSec: number;  // 토블러 보정 후 도보 시간
  elevationGain: number;        // 이 leg의 오르막 고도 (m)
  elevationLoss: number;        // 이 leg의 내리막 고도 (m)
}

export interface WalkElevationResult {
  elevationGain: number;       // 총 오르막 (m)
  elevationLoss: number;       // 총 내리막 (m)
  slopePenaltyMin: number;     // 경사 패널티 (분) = 보정 후 - 보정 전
  walkTimeSlopeMin: number;    // 토블러 보정 도보 시간 (분)
  walkTimeFlatMin: number;     // 원래 OTP2 도보 시간 (분)
  legElevations: WalkLegElevation[]; // leg별 고도 상세
}

// ── 메인 함수 ─────────────────────────────────────────────────────────────────

/**
 * 도보 구간들의 고도 데이터를 수집하고 토블러 보정 시간을 계산합니다.
 * 실패 시 null 반환 (호출측에서 fallback 처리).
 */
export async function calculateWalkElevation(
  walkLegs: { coords: { lat: number; lng: number }[]; durationSec: number }[]
): Promise<WalkElevationResult | null> {
  try {
    const validLegs = walkLegs.filter((l) => l.coords.length >= 2);
    if (validLegs.length === 0) return null;

    let totalElevGain = 0;
    let totalElevLoss = 0;
    let totalOriginalSec = 0;
    let totalAdjustedSec = 0;
    const legElevations: WalkLegElevation[] = [];

    for (const leg of validLegs) {
      // 1. 좌표 샘플링 (leg당 최대 40개)
      const sampled = sampleCoords(leg.coords, 40);

      // 2. 고도 데이터 수집
      const elevations = await fetchElevations(sampled);

      // 3. 구간별 경사도 및 토블러 시간 계산
      const slopeSegments: number[] = [];
      let legGain = 0;
      let legLoss = 0;
      let legFlatSec = 0;
      let legAdjustedSec = 0;

      for (let i = 0; i < sampled.length - 1; i++) {
        const a = sampled[i];
        const b = sampled[i + 1];
        const distM = haversineM(a.lat, a.lng, b.lat, b.lng);
        if (distM < 0.5) {
          slopeSegments.push(0);
          continue;
        }

        const elevDiff = (elevations[i + 1] ?? 0) - (elevations[i] ?? 0);
        const slope = elevDiff / distM; // rise/run
        slopeSegments.push(slope);

        if (elevDiff > 0) legGain += elevDiff;
        else legLoss += Math.abs(elevDiff);

        legFlatSec += (distM / 1000) / FLAT_KMH * 3600;
        legAdjustedSec += (distM / 1000) / toblerKmh(slope) * 3600;
      }

      // 4. 스케일 보정: 토블러 시간을 원래 OTP2 시간 기준으로 스케일
      //    (샘플링으로 인한 거리 손실 보완)
      const scaleFactor = legFlatSec > 0 ? leg.durationSec / legFlatSec : 1;
      const scaledAdjustedSec = legAdjustedSec * scaleFactor;
      // 보정 시간은 원래보다 항상 같거나 길다
      const finalAdjustedSec = Math.max(leg.durationSec, scaledAdjustedSec);

      totalElevGain += legGain;
      totalElevLoss += legLoss;
      totalOriginalSec += leg.durationSec;
      totalAdjustedSec += finalAdjustedSec;

      const profile: ElevationPoint[] = sampled.map((c, i) => ({
        lat: c.lat,
        lng: c.lng,
        elevation: elevations[i] ?? 0,
      }));

      legElevations.push({
        profile,
        slopeSegments,
        originalDurationSec: leg.durationSec,
        adjustedDurationSec: Math.round(finalAdjustedSec),
        elevationGain: Math.round(legGain),
        elevationLoss: Math.round(legLoss),
      });
    }

    const walkTimeSlopeMin = totalAdjustedSec / 60;
    const walkTimeFlatMin = totalOriginalSec / 60;
    const slopePenaltyMin = Math.max(0, walkTimeSlopeMin - walkTimeFlatMin);

    return {
      elevationGain: Math.round(totalElevGain),
      elevationLoss: Math.round(totalElevLoss),
      slopePenaltyMin: Math.round(slopePenaltyMin * 10) / 10,
      walkTimeSlopeMin: Math.round(walkTimeSlopeMin * 10) / 10,
      walkTimeFlatMin: Math.round(walkTimeFlatMin * 10) / 10,
      legElevations,
    };
  } catch (err: any) {
    console.error('[Elevation] 계산 실패:', err?.message || err);
    return null;
  }
}
