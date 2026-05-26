'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import type { Attraction } from '@/app/page';
import { GttCoefficients, DEFAULT_COEFFICIENTS } from '@/hooks/useWeights';
import { getUser } from '@/lib/auth';
import { IconPin, IconWarning, IconWalk, IconBus, IconSubway, IconHourglass, IconTransfer } from '@/components/icons';

const CATEGORY_COLOR: Record<string, { bg: string; text: string }> = {
  '자연':    { bg: 'rgba(34,197,94,0.18)',   text: '#166534' },
  '바다/해변':{ bg: 'rgba(14,165,233,0.18)', text: '#0369a1' },
  '역사/전통':{ bg: 'rgba(234,179,8,0.18)',  text: '#854d0e' },
  '문화/예술':{ bg: 'rgba(236,72,153,0.15)', text: '#9d174d' },
  '박물관':  { bg: 'rgba(168,85,247,0.15)',  text: '#6b21a8' },
  '종교':    { bg: 'rgba(249,115,22,0.15)',  text: '#9a3412' },
  '공원/레저':{ bg: 'rgba(20,184,166,0.15)', text: '#115e59' },
};

interface ElevationPoint {
  lat: number;
  lng: number;
  elevation: number;
}

interface RouteLeg {
  mode: 'walk' | 'bus' | 'subway';
  routeShortName?: string;
  boardStopName?: string;
  alightStopName?: string;
  coords: { lat: number; lng: number }[];
  durationSec: number;
  elevationProfile?: ElevationPoint[];
  slopeSegments?: number[];
}

interface RouteOption {
  totalTimeMin: number;
  transferCount: number;
  walkDistanceM: number;
  walkTimeSec: number;
  waitTimeSec: number;
  isSubwayOnly: boolean;
  legs: RouteLeg[];
}

interface ScorePanelProps {
  attraction: Attraction;
  origin: { name: string; lat: number; lng: number };
  onClose: () => void;
  coefficients?: GttCoefficients;
  dongKey?: string;
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
  isLoggedIn: boolean;
  onLegsChange?: (legs: RouteLeg[]) => void;
}

type GttGrade = 'S' | 'A' | 'B' | 'C' | 'D';

interface ScoreDetails {
  gtt: number;
  grade: GttGrade;
  isTMaxExceeded: boolean;
  breakdown: {
    T_invehicle: number;
    T_walk_weighted: number;
    T_wait_weighted: number;
    T_transfer_penalty: number;
    T_walk_raw: number;
    T_walk_flat: number;
    T_wait_raw: number;
    N_transfer: number;
    elevation_gain?: number;
    elevation_loss?: number;
    slope_penalty_min?: number;
  };
  rawParams: {
    totalTimeMin: number;
    transferCount: number;
    walkDistanceM: number;
    walkTimeMin?: number;
    waitTimeMin: number;
    hasLowFloor: boolean;
    isFallback?: boolean;
    fallbackReason?: 'tooClose' | 'apiError';
    legs?: RouteLeg[];
    routes?: RouteOption[];
    elevationGain?: number;
    elevationLoss?: number;
    slopePenaltyMin?: number;
    walkTimeSlopeMin?: number;
    walkTimeFlatMin?: number;
  };
}

// ── 고도 프로파일 미니 차트 ───────────────────────────────────────────────────
function ElevationChart({ legs }: { legs?: RouteLeg[] }) {
  if (!legs) return null;

  // 도보 leg 중 elevationProfile이 있는 것만 합산
  const allPoints: ElevationPoint[] = [];
  for (const leg of legs) {
    if (leg.mode === 'walk' && leg.elevationProfile && leg.elevationProfile.length > 0) {
      allPoints.push(...leg.elevationProfile);
    }
  }
  if (allPoints.length < 2) return null;

  const elevs = allPoints.map((p) => p.elevation);
  const minE = Math.min(...elevs);
  const maxE = Math.max(...elevs);
  const range = Math.max(maxE - minE, 5); // 최소 5m 범위

  const W = 240;
  const H = 48;
  const pad = 4;

  const points = allPoints.map((p, i) => {
    const x = pad + ((i / (allPoints.length - 1)) * (W - pad * 2));
    const y = H - pad - (((p.elevation - minE) / range) * (H - pad * 2));
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <div className="mt-3">
      <p className="mb-1" style={{ fontSize: 'var(--font-2xs)', color: 'var(--panel-text-muted)' }}>
        📈 도보 구간 고도 프로파일
      </p>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }}>
        <defs>
          <linearGradient id="elevGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        {/* 채움 영역 */}
        <polygon
          points={`${pad},${H - pad} ${points} ${W - pad},${H - pad}`}
          fill="url(#elevGrad)"
        />
        {/* 선 */}
        <polyline
          points={points}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* 최고점 표시 */}
        {maxE - minE >= 5 && (() => {
          const maxIdx = elevs.indexOf(maxE);
          const x = pad + ((maxIdx / (allPoints.length - 1)) * (W - pad * 2));
          const y = H - pad - (((maxE - minE) / range) * (H - pad * 2));
          return (
            <g>
              <circle cx={x} cy={y} r={3} fill="#ef4444" />
              <text x={x + 4} y={y - 2} fontSize={8} fill="#ef4444">{maxE}m</text>
            </g>
          );
        })()}
      </svg>
      <div className="flex justify-between mt-0.5" style={{ fontSize: '9px', color: 'var(--panel-text-muted)' }}>
        <span>출발</span>
        <span>도착</span>
      </div>
    </div>
  );
}

function getGradeStyle(grade: GttGrade): { color: string; label: string; desc: string } {
  switch (grade) {
    case 'S': return { color: '#22c55e', label: 'S등급', desc: '대중교통 최적 경로입니다' };
    case 'A': return { color: '#84cc16', label: 'A등급', desc: '충분히 쾌적하게 이동 가능합니다' };
    case 'B': return { color: '#f59e0b', label: 'B등급', desc: '무난하게 이동 가능합니다' };
    case 'C': return { color: '#f97316', label: 'C등급', desc: '다소 불편할 수 있습니다' };
    case 'D': return { color: '#ef4444', label: 'D등급', desc: '차량 이용을 권장합니다' };
  }
}

export default function ScorePanel({
  attraction, origin, onClose, coefficients = DEFAULT_COEFFICIENTS, dongKey,
  favorites, onToggleFavorite, isLoggedIn, onLegsChange,
}: ScorePanelProps) {
  const [scoreData, setScoreData] = useState<ScoreDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedRouteIdx, setSelectedRouteIdx] = useState(0);

  useEffect(() => {
    const fetchScore = async () => {
      setLoading(true);
      setError(false);
      setScoreData(null);

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
        const user = await getUser();
        const response = await axios.get(`${apiUrl}/api/score/${attraction.id}`, {
          params: {
            originLat: origin.lat,
            originLng: origin.lng,
            destLat: attraction.lat,
            destLng: attraction.lng,
            alpha: coefficients.alpha,
            beta:  coefficients.beta,
            gamma: coefficients.gamma,
            tMax:  coefficients.tMax,
            ...(dongKey ? { dongKey } : {}),
            ...(user ? { userId: user.id, originName: origin.name } : {}),
          },
        });

        if (response.data.success) {
          const details = response.data.data.scoreDetails;
          setScoreData(details);
          setSelectedRouteIdx(0);
          const legs = details?.rawParams?.routes?.[0]?.legs ?? details?.rawParams?.legs;
          if (legs && onLegsChange) onLegsChange(legs);
        } else {
          setError(true);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchScore();
  }, [attraction.id, origin.lat, origin.lng, attraction.lat, attraction.lng, coefficients]);

  const gradeStyle = scoreData ? getGradeStyle(scoreData.grade) : null;

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      {/* 뒤로가기 + 헤더 */}
      <div className="px-4 pt-3 pb-2">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 mb-3 transition-colors"
          style={{ fontSize: 'var(--font-sm)', color: 'var(--accent)' }}
        >
          ← 목록으로
        </button>
      </div>

      {/* 이미지 */}
      <div className="px-4 mb-4">
        <div className="w-full h-44 rounded-xl overflow-hidden bg-gray-100">
          {attraction.imageUrl ? (
            <img src={attraction.imageUrl} alt={attraction.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <IconPin size={48} strokeWidth={1.5} />
            </div>
          )}
        </div>
      </div>

      {/* 이름/주소 */}
      <div className="px-4 mb-4">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-bold" style={{ color: 'var(--panel-text)' }}>{attraction.name}</h2>
          {isLoggedIn && (
            <button
              onClick={() => onToggleFavorite(attraction.id)}
              className="text-xl shrink-0 transition-colors"
              style={{ color: favorites.has(attraction.id) ? '#f43f5e' : 'var(--panel-text-muted)' }}
            >
              {favorites.has(attraction.id) ? '♥' : '♡'}
            </button>
          )}
        </div>
        <p className="mt-1" style={{ fontSize: 'var(--font-sm)', color: 'var(--panel-text-muted)' }}>{attraction.address}</p>
        {attraction.category && (() => {
          const c = CATEGORY_COLOR[attraction.category] ?? { bg: 'rgba(100,100,100,0.2)', text: '#aaa' };
          return (
            <span
              className="inline-block mt-2 text-sm px-3 py-1 rounded-lg font-semibold"
              style={{ background: c.bg, color: c.text }}
            >
              {attraction.category}
            </span>
          );
        })()}
      </div>

      {/* 점수 영역 */}
      <div className="px-4">
        <div
          className="rounded-xl p-4"
          style={{ background: 'var(--panel-surface)', border: '1px solid var(--panel-border)' }}
        >
          <p className="mb-3 flex items-center gap-1" style={{ fontSize: 'var(--font-xs)', color: 'var(--panel-text-muted)' }}>
            🚩 출발: <span className="font-semibold" style={{ color: 'var(--accent)' }}>{origin.name}</span>
          </p>

          {loading ? (
            <div className="flex flex-col items-center py-8">
              <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
              <p className="mt-3" style={{ fontSize: 'var(--font-xs)', color: 'var(--panel-text-muted)' }}>경로를 분석하고 있습니다...</p>
            </div>
          ) : error || !scoreData ? (
            <div className="flex flex-col items-center py-6">
              <div className="mb-2" style={{ color: 'var(--score-poor)' }}>
                <IconWarning size={36} strokeWidth={1.8} />
              </div>
              <p style={{ fontSize: 'var(--font-sm)', color: 'var(--score-poor)' }}>점수를 불러오지 못했습니다.</p>
            </div>
          ) : (
            <>
              {/* Fallback 경고 */}
              {scoreData.rawParams.isFallback && scoreData.rawParams.fallbackReason === 'tooClose' && (
                <div
                  className="text-[10px] px-3 py-2 rounded-lg mb-3 flex items-start gap-1.5"
                  style={{ background: 'rgba(73, 180, 222, 0.12)', color: '#0369a1', border: '1px solid rgba(73, 180, 222, 0.3)' }}
                >
                  <IconWalk size={14} className="shrink-0 mt-px" />
                  <span>출발지와 목적지가 너무 가까워 <b>도보 이동 가능</b> 거리입니다.</span>
                </div>
              )}
              {scoreData.rawParams.isFallback && scoreData.rawParams.fallbackReason === 'apiError' && (
                <div
                  className="text-[10px] px-3 py-2 rounded-lg mb-3 flex items-start gap-1.5"
                  style={{ background: 'rgba(249, 115, 22, 0.1)', color: 'var(--score-average)', border: '1px solid rgba(249, 115, 22, 0.2)' }}
                >
                  <IconWarning size={14} className="shrink-0 mt-px" />
                  <span>경로 탐색 실패로 <b>직선 경로 기반 추정치</b>입니다.</span>
                </div>
              )}

              {/* tMax 초과 경고 */}
              {scoreData.isTMaxExceeded && (
                <div
                  className="text-[10px] px-3 py-2 rounded-lg mb-3 flex items-start gap-1.5"
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
                >
                  <IconHourglass size={13} className="shrink-0 mt-px" />
                  <span>설정한 최대 이동시간({coefficients.tMax}분)을 초과합니다. ({scoreData.rawParams.totalTimeMin}분 소요)</span>
                </div>
              )}

              {/* 등급 카드 */}
              <div
                className="rounded-xl p-4 mb-4 flex items-center gap-4"
                style={{ background: `${gradeStyle?.color}18`, border: `1px solid ${gradeStyle?.color}40` }}
              >
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 font-black text-3xl"
                  style={{ background: gradeStyle?.color, color: '#fff' }}
                >
                  {scoreData.grade}
                </div>
                <div>
                  <p className="font-bold text-base mb-0.5" style={{ color: gradeStyle?.color }}>{gradeStyle?.label}</p>
                  <p style={{ fontSize: 'var(--font-xs)', color: 'var(--panel-text-muted)' }}>{gradeStyle?.desc}</p>
                  <p className="mt-1 font-semibold" style={{ fontSize: 'var(--font-sm)', color: 'var(--panel-text)' }}>
                    GTT {scoreData.gtt}점
                    <span className="ml-1 font-normal" style={{ fontSize: 'var(--font-xs)', color: 'var(--panel-text-muted)' }}>
                      (환산 이동시간)
                    </span>
                  </p>
                </div>
              </div>

              {/* 배지 */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {scoreData.rawParams.hasLowFloor && (
                  <span
                    className="px-2 py-1 rounded-full"
                    style={{ fontSize: 'var(--font-2xs)', background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)' }}
                  >
                    ♿ 저상버스 탑승 가능
                  </span>
                )}
                {scoreData.rawParams.transferCount >= 2 && (
                  <span
                    className="px-2 py-1 rounded-full inline-flex items-center gap-1"
                    style={{ fontSize: 'var(--font-2xs)', background: 'rgba(249,115,22,0.12)', color: 'var(--score-average)', border: '1px solid rgba(249,115,22,0.25)' }}
                  >
                    <IconTransfer size={11} />
                    <span>환승 {scoreData.rawParams.transferCount}회</span>
                  </span>
                )}
                {scoreData.rawParams.totalTimeMin > 60 && (
                  <span
                    className="px-2 py-1 rounded-full"
                    style={{ fontSize: 'var(--font-2xs)', background: 'rgba(249,115,22,0.12)', color: 'var(--score-average)', border: '1px solid rgba(249,115,22,0.25)' }}
                  >
                    🕐 {scoreData.rawParams.totalTimeMin}분 소요
                  </span>
                )}
                {/* 고도 배지 */}
                {(scoreData.rawParams.elevationGain ?? 0) >= 5 && (
                  <span
                    className="px-2 py-1 rounded-full"
                    style={{ fontSize: 'var(--font-2xs)', background: 'rgba(239,68,68,0.1)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.25)' }}
                  >
                    ↑ {scoreData.rawParams.elevationGain}m 오르막
                  </span>
                )}
                {(scoreData.rawParams.elevationLoss ?? 0) >= 5 && (
                  <span
                    className="px-2 py-1 rounded-full"
                    style={{ fontSize: 'var(--font-2xs)', background: 'rgba(59,130,246,0.1)', color: '#2563eb', border: '1px solid rgba(59,130,246,0.25)' }}
                  >
                    ↓ {scoreData.rawParams.elevationLoss}m 내리막
                  </span>
                )}
                {(scoreData.rawParams.slopePenaltyMin ?? 0) >= 0.5 && (
                  <span
                    className="px-2 py-1 rounded-full"
                    style={{ fontSize: 'var(--font-2xs)', background: 'rgba(234,179,8,0.12)', color: '#b45309', border: '1px solid rgba(234,179,8,0.3)' }}
                  >
                    ⛰ 경사 +{scoreData.rawParams.slopePenaltyMin}분
                  </span>
                )}
              </div>

              {/* GTT 분해 상세 */}
              <div>
                <p className="font-semibold mb-3" style={{ fontSize: 'var(--font-xs)', color: 'var(--panel-text)' }}>
                  GTT 상세 분해
                </p>
                <div className="flex flex-col gap-2">
                  {/* 탑승 시간 */}
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5" style={{ fontSize: 'var(--font-xs)', color: 'var(--panel-text)' }}>
                      <IconBus size={14} style={{ color: 'var(--accent)' }} />
                      <span>탑승 시간</span>
                    </span>
                    <span className="font-semibold" style={{ fontSize: 'var(--font-sm)', color: 'var(--accent)' }}>
                      {scoreData.breakdown.T_invehicle}분
                    </span>
                  </div>
                  {/* 도보 시간 (경사 보정 표시) */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="inline-flex items-center gap-1.5" style={{ fontSize: 'var(--font-xs)', color: 'var(--panel-text)' }}>
                        <IconWalk size={14} style={{ color: '#22c55e' }} />
                        <span>도보 시간</span>
                      </span>
                      {scoreData.breakdown.slope_penalty_min !== undefined && scoreData.breakdown.slope_penalty_min >= 0.5 ? (
                        <span className="ml-2" style={{ fontSize: 'var(--font-2xs)', color: '#b45309' }}>
                          {scoreData.breakdown.T_walk_flat}분→{scoreData.breakdown.T_walk_raw}분 (경사 +{scoreData.breakdown.slope_penalty_min}분) × α{coefficients.alpha}
                        </span>
                      ) : (
                        <span className="ml-2" style={{ fontSize: 'var(--font-2xs)', color: 'var(--panel-text-muted)' }}>
                          {scoreData.breakdown.T_walk_raw}분 × α{coefficients.alpha}
                        </span>
                      )}
                    </div>
                    <span className="font-semibold" style={{ fontSize: 'var(--font-sm)', color: '#22c55e' }}>
                      {scoreData.breakdown.T_walk_weighted}분
                    </span>
                  </div>
                  {/* 대기 시간 */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="inline-flex items-center gap-1.5" style={{ fontSize: 'var(--font-xs)', color: 'var(--panel-text)' }}>
                        <IconHourglass size={13} style={{ color: '#f59e0b' }} />
                        <span>대기 시간</span>
                      </span>
                      <span className="ml-2" style={{ fontSize: 'var(--font-2xs)', color: 'var(--panel-text-muted)' }}>
                        {scoreData.breakdown.T_wait_raw}분 × β{coefficients.beta}
                      </span>
                    </div>
                    <span className="font-semibold" style={{ fontSize: 'var(--font-sm)', color: '#f59e0b' }}>
                      {scoreData.breakdown.T_wait_weighted}분
                    </span>
                  </div>
                  {/* 환승 패널티 */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="inline-flex items-center gap-1.5" style={{ fontSize: 'var(--font-xs)', color: 'var(--panel-text)' }}>
                        <IconTransfer size={14} style={{ color: '#8b5cf6' }} />
                        <span>환승 패널티</span>
                      </span>
                      <span className="ml-2" style={{ fontSize: 'var(--font-2xs)', color: 'var(--panel-text-muted)' }}>
                        {scoreData.breakdown.N_transfer}회 × γ{coefficients.gamma}분
                      </span>
                    </div>
                    <span className="font-semibold" style={{ fontSize: 'var(--font-sm)', color: '#8b5cf6' }}>
                      {scoreData.breakdown.T_transfer_penalty}분
                    </span>
                  </div>
                  <div
                    className="flex items-center justify-between pt-2 mt-1"
                    style={{ borderTop: '1px solid var(--panel-border)' }}
                  >
                    <span className="font-bold" style={{ fontSize: 'var(--font-xs)', color: 'var(--panel-text)' }}>GTT 합계</span>
                    <span className="font-bold" style={{ fontSize: 'var(--font-sm)', color: gradeStyle?.color }}>{scoreData.gtt}점</span>
                  </div>
                </div>

                {/* 고도 프로파일 차트 */}
                <ElevationChart legs={scoreData.rawParams.legs} />
              </div>

              {/* 경로 옵션 */}
              {scoreData.rawParams.routes && scoreData.rawParams.routes.length > 1 && (
                <div className="mt-4">
                  <p className="font-semibold mb-2" style={{ fontSize: 'var(--font-xs)', color: 'var(--panel-text)' }}>
                    경로 옵션
                  </p>
                  <div className="flex flex-col gap-2">
                    {scoreData.rawParams.routes.map((route, idx) => {
                      const isSelected = idx === selectedRouteIdx;
                      const modeLabel = route.isSubwayOnly ? '지하철만' : route.transferCount === 0 ? '직행' : `환승 ${route.transferCount}회`;
                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            setSelectedRouteIdx(idx);
                            if (onLegsChange) onLegsChange(route.legs);
                          }}
                          className="w-full text-left px-3 py-2 rounded-lg transition-all"
                          style={{
                            background: isSelected ? 'rgba(73,180,222,0.15)' : 'var(--panel-surface)',
                            border: `1px solid ${isSelected ? 'rgba(73,180,222,0.5)' : 'var(--panel-border)'}`,
                            color: 'var(--panel-text)',
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: isSelected ? 'var(--accent)' : 'var(--panel-text)' }}>
                                {modeLabel}
                              </span>
                              <div className="flex items-center gap-1.5">
                                {route.legs.map((leg, li) => (
                                  <span key={li} className="inline-flex items-center gap-1" style={{ fontSize: '11px', color: 'var(--panel-text-muted)' }}>
                                    {leg.mode === 'walk' ? (
                                      <IconWalk size={14} />
                                    ) : leg.mode === 'subway' ? (
                                      <IconSubway size={14} />
                                    ) : (
                                      <>
                                        <IconBus size={14} />
                                        {leg.routeShortName && <span>{leg.routeShortName}</span>}
                                      </>
                                    )}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <span className="font-bold" style={{ fontSize: 'var(--font-sm)', color: isSelected ? 'var(--accent)' : 'var(--panel-text)' }}>
                              {route.totalTimeMin}분
                            </span>
                          </div>
                          <div className="flex gap-3 mt-1" style={{ fontSize: '10px', color: 'var(--panel-text-muted)' }}>
                            <span>도보 {route.walkDistanceM}m</span>
                            <span>대기 {Math.round(route.waitTimeSec / 60)}분</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 하단 여백 */}
      <div className="h-4" />
    </div>
  );
}
