/**
 * I-RAPTOR 알고리즘 구현
 * 논문: "개선된 RAPTOR를 이용한 대중교통 승객 경로 선택 유형 분류 모델" (서울시립대 2019, 남현우)
 *
 * 반환: Pareto-최적 경로 배열 (각 라운드별, 환승 횟수 vs 소요시간 트레이드오프)
 * 각 경로에는 leg 좌표 배열 포함 → 폴리라인 렌더링에 사용
 */

import { getRaptorData, RaptorMemory, RaptorStop } from './raptorData';

export interface RaptorLeg {
  mode: 'walk' | 'bus' | 'subway';
  routeShortName?: string;   // "51", "2호선", "경전철"
  boardStopName?: string;
  alightStopName?: string;
  coords: { lat: number; lon: number }[];  // 폴리라인 좌표 (정류장 순서)
  durationSec: number;
}

export interface RaptorRouteOption {
  totalTimeMin: number;
  transferCount: number;
  walkDistanceM: number;
  walkTimeSec: number;
  waitTimeSec: number;
  isSubwayOnly: boolean;
  legs: RaptorLeg[];
}

export interface RaptorInput {
  originLat: number;
  originLon: number;
  destLat: number;
  destLon: number;
  departureSec: number;
  maxTransfers?: number;
  transferPenaltySec?: number;
  walkSpeedMps?: number;
}

export interface RaptorResult {
  success: boolean;
  routes: RaptorRouteOption[];  // Pareto-최적, totalTimeMin 오름차순 (빠른 것부터)
}

const INF = Number.POSITIVE_INFINITY;
const SEARCH_RADIUS_M = 2000;
const CANDIDATE_COUNT = 8;

// ---- 거리 유틸 ----
function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function findNearbyStops(
  mem: RaptorMemory,
  lat: number,
  lon: number,
  radiusM: number,
  limit: number
): { stop: RaptorStop; distanceM: number }[] {
  const result: { stop: RaptorStop; distanceM: number }[] = [];
  const degRange = radiusM / 111000 + 0.002;
  for (const s of mem.stopList) {
    if (Math.abs(s.lat - lat) > degRange || Math.abs(s.lon - lon) > degRange) continue;
    const d = haversineM(lat, lon, s.lat, s.lon);
    if (d <= radiusM) result.push({ stop: s, distanceM: d });
  }
  result.sort((a, b) => a.distanceM - b.distanceM);
  return result.slice(0, limit);
}

// ---- parent 구조 (라운드별 경로 역추적) ----
interface Parent {
  kind: 'init' | 'trip' | 'walk';
  fromStopId: string | null;
  tripId?: string;
  boardStopId?: string;
  alightStopId?: string;      // 하차 정류장 (폴리라인용)
  boardDepSec?: number;
  alightArrSec?: number;
  mode?: 'bus' | 'subway';
  headwaySec?: number;        // 배차간격 추정값 (대기시간 계산용)
  walkTimeSec?: number;
  walkDistanceM?: number;
}

// ---- 메인 ----
export async function runRaptor(input: RaptorInput): Promise<RaptorResult> {
  const mem = getRaptorData();

  const {
    originLat, originLon, destLat, destLon, departureSec,
    maxTransfers = 4,
    transferPenaltySec = 0,   // MK3: 환승 패널티는 GTT γ가 단독 담당
    walkSpeedMps = 1.2,
  } = input;

  // 1. 출발/도착 후보 정류장
  const originCandidates = findNearbyStops(mem, originLat, originLon, SEARCH_RADIUS_M, CANDIDATE_COUNT);
  const destCandidates = findNearbyStops(mem, destLat, destLon, SEARCH_RADIUS_M, CANDIDATE_COUNT);

  if (originCandidates.length === 0 || destCandidates.length === 0) {
    return { success: false, routes: [] };
  }

  // 2. τ[k][stopId] = 라운드 k까지 도달 최소 시각
  //    bestArr = 전 라운드 통틀어 베스트 (pruning용)
  const rounds = maxTransfers + 1;
  const tau: Map<string, number>[] = [];
  for (let k = 0; k <= rounds; k++) tau.push(new Map());
  const bestArr = new Map<string, number>();

  // 라운드별 parent (Pareto 경로 역추적용)
  const roundParent: Map<string, Parent>[] = [];
  for (let k = 0; k <= rounds; k++) roundParent.push(new Map());

  // 3. 초기화 (라운드 0): 출발지 → 후보 정류장 도보
  const marked = new Set<string>();
  for (const c of originCandidates) {
    const walkSec = Math.round(c.distanceM / walkSpeedMps);
    const arr = departureSec + walkSec;
    tau[0].set(c.stop.stopId, arr);
    bestArr.set(c.stop.stopId, arr);
    roundParent[0].set(c.stop.stopId, {
      kind: 'init',
      fromStopId: null,
      walkTimeSec: walkSec,
      walkDistanceM: Math.round(c.distanceM),
    });
    marked.add(c.stop.stopId);
  }

  // 4. 라운드 루프
  for (let k = 1; k <= rounds; k++) {
    // 이전 라운드 tau 복사
    for (const [s, t] of tau[k - 1]) tau[k].set(s, t);

    // (a)+(b) marked stop별 route 개별 탐색 (stop-by-stop boarding)
    //
    // [기존 버그] Q에 routeId당 1개 stop(min-seq)만 저장 →
    //   출발지 근처 stop A(seq 5)와 stop B(seq 35)가 모두 marked여도
    //   A만 탑승 후보로 선택 → B에서 더 빠른 탑승 경우를 영구적으로 누락
    //
    // [수정] marked stop 각각에서 독립적으로 route 탐색.
    //   같은 route가 여러 stop에서 처리되더라도 bestArr 비교로 최적값만 유지.
    const newMarked = new Set<string>();

    for (const boardStopId of marked) {
      const boardArr = tau[k - 1].get(boardStopId);
      if (boardArr === undefined) continue;

      const stopRouteEntries = mem.stopRoutes.get(boardStopId);
      if (!stopRouteEntries) continue;

      // 이 stop에서 탑승 가능한 routeId별로 그룹화 (O(N) 전처리)
      const routeGroups = new Map<string, { tripId: string; seq: number }[]>();
      for (const r of stopRouteEntries) {
        if (!routeGroups.has(r.routeId)) routeGroups.set(r.routeId, []);
        routeGroups.get(r.routeId)!.push({ tripId: r.tripId, seq: r.seq });
      }

      for (const [, candidates] of routeGroups) {
        let bestTripId: string | null = null;
        let bestTripDepSec = INF;
        let secondTripDepSec = INF;
        let bestBoardSeq = -1;

        for (const c of candidates) {
          const times = mem.tripStopTimes.get(c.tripId);
          if (!times) continue;
          const boardSt = times.find((t) => t.seq === c.seq && t.stopId === boardStopId);
          if (!boardSt) continue;
          if (boardSt.depSec < boardArr) continue;
          if (boardSt.depSec < bestTripDepSec) {
            secondTripDepSec = bestTripDepSec;
            bestTripDepSec = boardSt.depSec;
            bestTripId = c.tripId;
            bestBoardSeq = c.seq;
          } else if (boardSt.depSec < secondTripDepSec) {
            secondTripDepSec = boardSt.depSec;
          }
        }
        if (!bestTripId) continue;

        // 배차간격: 1·2번째 출발 시각 차이. 없으면 mode별 기본값
        const trip = mem.trips.get(bestTripId);
        const tripMode = trip?.mode ?? 'bus';
        const defaultHeadwaySec = tripMode === 'subway' ? 360 : 720;
        const headwaySec = secondTripDepSec < INF
          ? Math.min(secondTripDepSec - bestTripDepSec, 3600)
          : defaultHeadwaySec;

        const times = mem.tripStopTimes.get(bestTripId)!;
        const boardStTime = times.find((t) => t.seq === bestBoardSeq && t.stopId === boardStopId);
        if (!boardStTime) continue;

        for (const st of times) {
          if (st.seq <= bestBoardSeq) continue;
          const arrAtStop = st.arrSec;
          const prevBest = bestArr.get(st.stopId) ?? INF;
          if (arrAtStop < prevBest) {
            tau[k].set(st.stopId, arrAtStop);
            bestArr.set(st.stopId, arrAtStop);
            roundParent[k].set(st.stopId, {
              kind: 'trip',
              fromStopId: boardStopId,
              tripId: bestTripId,
              boardStopId,
              alightStopId: st.stopId,
              boardDepSec: boardStTime.depSec,
              alightArrSec: arrAtStop,
              mode: tripMode,
              headwaySec,
            });
            newMarked.add(st.stopId);
          }
        }
      }
    }

    // (c) 도보 릴랙스 (환승)
    for (const p of new Set([...newMarked])) {
      const links = mem.walkLinks.get(p);
      if (!links) continue;
      const baseArr = tau[k].get(p);
      if (baseArr === undefined) continue;
      for (const wl of links) {
        const arrAt = baseArr + wl.walkTimeSec + transferPenaltySec;
        const prev = bestArr.get(wl.toStopId) ?? INF;
        if (arrAt < prev) {
          tau[k].set(wl.toStopId, arrAt);
          bestArr.set(wl.toStopId, arrAt);
          roundParent[k].set(wl.toStopId, {
            kind: 'walk',
            fromStopId: p,
            walkTimeSec: wl.walkTimeSec,
            walkDistanceM: wl.distanceM,
          });
          newMarked.add(wl.toStopId);
        }
      }
    }

    if (newMarked.size === 0) break;
    marked.clear();
    for (const s of newMarked) marked.add(s);
  }

  // 5. Pareto-최적 경로 수집 (각 라운드별, 이전 라운드보다 빠른 경우만)
  const paretoRoutes: RaptorRouteOption[] = [];
  let bestTimeSoFar = INF;

  for (let k = 1; k <= rounds; k++) {
    let bestTotalSec = INF;
    let bestDestStopId: string | null = null;
    let bestDestWalkSec = 0;
    let bestDestWalkM = 0;

    for (const c of destCandidates) {
      const arr = tau[k].get(c.stop.stopId);
      if (arr === undefined) continue;
      const walkSec = Math.round(c.distanceM / walkSpeedMps);
      const total = arr + walkSec;
      if (total < bestTotalSec) {
        bestTotalSec = total;
        bestDestStopId = c.stop.stopId;
        bestDestWalkSec = walkSec;
        bestDestWalkM = Math.round(c.distanceM);
      }
    }

    if (!bestDestStopId || bestTotalSec >= bestTimeSoFar) continue;
    bestTimeSoFar = bestTotalSec;

    const option = buildRouteOption(
      k, bestDestStopId, bestDestWalkSec, bestDestWalkM,
      bestTotalSec, destLat, destLon, originLat, originLon,
      roundParent, mem, departureSec
    );
    if (option) paretoRoutes.push(option);
  }

  // totalTimeMin 오름차순 (빠른 경로 먼저)
  paretoRoutes.sort((a, b) => a.totalTimeMin - b.totalTimeMin);

  return { success: paretoRoutes.length > 0, routes: paretoRoutes };
}

// ---- 헬퍼: 라운드 r 이하에서 stopId의 parent 찾기 ----
function getParentAtOrBefore(
  stopId: string,
  maxK: number,
  roundParent: Map<string, Parent>[]
): { p: Parent; k: number } | null {
  for (let r = maxK; r >= 0; r--) {
    const p = roundParent[r].get(stopId);
    if (p) return { p, k: r };
  }
  return null;
}

// ---- 경로 옵션 역추적 ----
function buildRouteOption(
  k: number,
  destStopId: string,
  destWalkSec: number,
  destWalkM: number,
  totalArrSec: number,
  destLat: number,
  destLon: number,
  originLat: number,
  originLon: number,
  roundParent: Map<string, Parent>[],
  mem: RaptorMemory,
  departureSec: number,
): RaptorRouteOption | null {
  const legs: RaptorLeg[] = [];

  // 마지막 도보 leg: 하차 정류장 → 목적지
  const destStop = mem.stops.get(destStopId);
  if (destStop && destWalkSec > 0) {
    legs.push({
      mode: 'walk',
      coords: [{ lat: destStop.lat, lon: destStop.lon }, { lat: destLat, lon: destLon }],
      durationSec: destWalkSec,
    });
  }

  let curStop = destStopId;
  let curK = k;
  let walkTimeSec = destWalkSec;
  let walkDistanceM = destWalkM;
  let waitTimeSec = 0;
  let transferCount = 0;
  let hasBus = false;
  let hasSubway = false;
  let prevTripId: string | null = null;

  while (curStop) {
    const found = getParentAtOrBefore(curStop, curK, roundParent);
    if (!found) break;
    const { p, k: parentK } = found;

    if (p.kind === 'trip') {
      if (p.mode === 'bus') hasBus = true;
      if (p.mode === 'subway') hasSubway = true;

      // 대기시간: 배차간격의 절반 (쿼리 시각 무관한 기댓값)
      // headwaySec이 없으면 mode별 기본값 (지하철 6분, 버스 12분)
      const defaultHw = p.mode === 'subway' ? 360 : 720;
      const hw = p.headwaySec ?? defaultHw;
      waitTimeSec += Math.min(hw / 2, 900);  // 최대 15분 캡

      // 환승 카운트 (trip이 바뀔 때마다)
      if (prevTripId && prevTripId !== p.tripId) transferCount++;
      prevTripId = p.tripId!;

      // 대중교통 leg 빌드
      const leg = buildTransitLeg(p, mem);
      if (leg) legs.push(leg);

      curStop = p.boardStopId!;
      curK = parentK - 1;

    } else if (p.kind === 'walk') {
      walkTimeSec += p.walkTimeSec!;
      walkDistanceM += p.walkDistanceM!;

      const fromStop = mem.stops.get(p.fromStopId!);
      const toStop = mem.stops.get(curStop);
      if (fromStop && toStop) {
        legs.push({
          mode: 'walk',
          coords: [
            { lat: fromStop.lat, lon: fromStop.lon },
            { lat: toStop.lat, lon: toStop.lon },
          ],
          durationSec: p.walkTimeSec!,
        });
      }
      curStop = p.fromStopId!;

    } else if (p.kind === 'init') {
      walkTimeSec += p.walkTimeSec!;
      walkDistanceM += p.walkDistanceM!;

      const firstStop = mem.stops.get(curStop);
      if (firstStop) {
        legs.push({
          mode: 'walk',
          coords: [
            { lat: originLat, lon: originLon },
            { lat: firstStop.lat, lon: firstStop.lon },
          ],
          durationSec: p.walkTimeSec!,
        });
      }
      break;
    } else {
      break;
    }
  }

  legs.reverse();

  const totalSec = totalArrSec - departureSec;
  const totalTimeMin = Math.max(1, Math.round(totalSec / 60));
  const isSubwayOnly = hasSubway && !hasBus;

  return { totalTimeMin, transferCount, walkDistanceM, walkTimeSec, waitTimeSec, isSubwayOnly, legs };
}

// ---- 대중교통 leg 빌드 (boardStop → alightStop 경유 정류장 좌표) ----
function buildTransitLeg(p: Parent, mem: RaptorMemory): RaptorLeg | null {
  const { tripId, boardStopId, alightStopId, mode } = p;
  if (!tripId || !boardStopId || !alightStopId) return null;

  const times = mem.tripStopTimes.get(tripId);
  if (!times) return null;

  const boardEntry = times.find((t) => t.stopId === boardStopId);
  const alightEntry = times.find((t) => t.stopId === alightStopId);
  if (!boardEntry || !alightEntry) return null;

  const boardSeq = boardEntry.seq;
  const alightSeq = alightEntry.seq;

  // board ~ alight 사이 정류장 좌표 수집 (seq 순서 보장)
  const coords: { lat: number; lon: number }[] = [];
  for (const st of times) {
    if (st.seq >= boardSeq && st.seq <= alightSeq) {
      const stop = mem.stops.get(st.stopId);
      if (stop) coords.push({ lat: stop.lat, lon: stop.lon });
    }
  }

  const trip = mem.trips.get(tripId);
  const boardStop = mem.stops.get(boardStopId);
  const alightStop = mem.stops.get(alightStopId);

  return {
    mode: mode ?? 'bus',
    routeShortName: trip?.routeShortName,
    boardStopName: boardStop?.name,
    alightStopName: alightStop?.name,
    coords,
    durationSec: (p.alightArrSec ?? 0) - (p.boardDepSec ?? 0),
  };
}
