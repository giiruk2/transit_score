'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import type { Attraction } from '@/app/page';

interface ScorePanelProps {
  attraction: Attraction;
  origin: { name: string; lat: number; lng: number };
  onClose: () => void;
}

interface ScoreDetails {
  finalScore: number;
  breakdown: {
    timeScore: number;
    transferScore: number;
    walkScore: number;
    waitScore: number;
  };
  rawParams: {
    totalTimeMin: number;
    transferCount: number;
    walkDistanceM: number;
    waitTimeMin: number;
    isFallback?: boolean;
  };
}

function getScoreGrade(score: number) {
  if (score >= 80) return { label: '매우 우수', emoji: '🟢', color: 'var(--score-excellent)' };
  if (score >= 60) return { label: '우수', emoji: '🟡', color: 'var(--score-good)' };
  if (score >= 40) return { label: '보통', emoji: '🟠', color: 'var(--score-average)' };
  return { label: '미흡', emoji: '🔴', color: 'var(--score-poor)' };
}

function ScoreBar({ label, value, maxValue, unit, color }: { label: string; value: number; maxValue: number; unit: string; color: string }) {
  const percentage = Math.min(100, Math.max(0, (value / maxValue) * 100));
  return (
    <div className="mb-3">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[11px]" style={{ color: 'var(--sidebar-text-muted)' }}>{label}</span>
        <span className="text-[12px] font-semibold" style={{ color: 'var(--sidebar-text)' }}>
          {value}{unit}
        </span>
      </div>
      <div className="w-full h-2 rounded-full" style={{ background: 'var(--sidebar-surface)' }}>
        <div
          className="h-2 rounded-full animate-bar"
          style={{ width: `${percentage}%`, background: color }}
        />
      </div>
    </div>
  );
}

export default function ScorePanel({ attraction, origin, onClose }: ScorePanelProps) {
  const [scoreData, setScoreData] = useState<ScoreDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchScore = async () => {
      setLoading(true);
      setError(false);
      setScoreData(null);

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
        const response = await axios.get(`${apiUrl}/api/score/${attraction.id}`, {
          params: {
            originLat: origin.lat,
            originLng: origin.lng,
            destLat: attraction.lat,
            destLng: attraction.lng,
          },
        });

        if (response.data.success) {
          setScoreData(response.data.data.scoreDetails);
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
  }, [attraction.id, origin.lat, origin.lng, attraction.lat, attraction.lng]);

  const grade = scoreData ? getScoreGrade(scoreData.finalScore) : null;

  // 원형 게이지 값
  const circumference = 2 * Math.PI * 40;
  const dashoffset = scoreData ? circumference - (scoreData.finalScore / 100) * circumference : circumference;

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      {/* 뒤로가기 + 헤더 */}
      <div className="px-4 pt-3 pb-2">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-[12px] mb-3 transition-colors"
          style={{ color: 'var(--accent-light)' }}
        >
          ← 목록으로
        </button>
      </div>

      {/* 이미지 */}
      <div className="px-4 mb-4">
        <div className="w-full h-44 rounded-xl overflow-hidden bg-gray-800">
          {attraction.imageUrl ? (
            <img src={attraction.imageUrl} alt={attraction.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-500 text-4xl">📍</div>
          )}
        </div>
      </div>

      {/* 이름/주소 */}
      <div className="px-4 mb-4">
        <h2 className="text-lg font-bold" style={{ color: 'var(--sidebar-text)' }}>{attraction.name}</h2>
        <p className="text-[12px] mt-1" style={{ color: 'var(--sidebar-text-muted)' }}>{attraction.address}</p>
      </div>

      {/* 점수 영역 */}
      <div className="px-4">
        <div
          className="rounded-xl p-4"
          style={{ background: 'var(--sidebar-surface)', border: '1px solid var(--sidebar-border)' }}
        >
          <p className="text-[11px] mb-3 flex items-center gap-1" style={{ color: 'var(--sidebar-text-muted)' }}>
            🚩 출발: <span className="font-semibold" style={{ color: 'var(--accent-light)' }}>{origin.name}</span>
          </p>

          {loading ? (
            <div className="flex flex-col items-center py-8">
              <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
              <p className="text-[11px] mt-3" style={{ color: 'var(--sidebar-text-muted)' }}>경로를 분석하고 있습니다...</p>
            </div>
          ) : error || !scoreData ? (
            <div className="text-center py-6">
              <span className="text-3xl mb-2 block">⚠️</span>
              <p className="text-[12px]" style={{ color: 'var(--score-poor)' }}>점수를 불러오지 못했습니다.</p>
            </div>
          ) : (
            <>
              {/* Fallback 경고 */}
              {scoreData.rawParams.isFallback && (
                <div
                  className="text-[10px] px-3 py-2 rounded-lg mb-3"
                  style={{ background: 'rgba(249, 115, 22, 0.1)', color: 'var(--score-average)', border: '1px solid rgba(249, 115, 22, 0.2)' }}
                >
                  ⚠️ API 한도 초과로 <b>직선 경로 기반 추정치</b>입니다.
                </div>
              )}

              {/* 원형 게이지 + 등급 */}
              <div className="flex items-center gap-5 mb-5">
                <div className="relative w-24 h-24 shrink-0">
                  <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="var(--sidebar-border)" strokeWidth="6" />
                    <circle
                      cx="50" cy="50" r="40" fill="none"
                      stroke={grade?.color}
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={dashoffset}
                      style={{ transition: 'stroke-dashoffset 1s ease-out' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold" style={{ color: grade?.color }}>
                      {scoreData.finalScore}
                    </span>
                    <span className="text-[9px]" style={{ color: 'var(--sidebar-text-muted)' }}>/ 100</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{grade?.emoji}</span>
                    <span className="text-base font-bold" style={{ color: grade?.color }}>{grade?.label}</span>
                  </div>
                  <p className="text-[11px] leading-relaxed" style={{ color: 'var(--sidebar-text-muted)' }}>
                    {scoreData.finalScore >= 80 && '대중교통으로 편리하게 방문할 수 있습니다.'}
                    {scoreData.finalScore >= 60 && scoreData.finalScore < 80 && '대중교통 이용이 권장됩니다.'}
                    {scoreData.finalScore >= 40 && scoreData.finalScore < 60 && '환승이 다소 불편할 수 있습니다.'}
                    {scoreData.finalScore < 40 && '택시나 자차 이용을 권장합니다.'}
                  </p>
                </div>
              </div>

              {/* 세부 점수 막대그래프 */}
              <div>
                <p className="text-[11px] font-semibold mb-3" style={{ color: 'var(--sidebar-text)' }}>
                  세부 분석
                </p>
                <ScoreBar label="🕐 이동 시간" value={scoreData.rawParams.totalTimeMin} maxValue={120} unit="분" color="var(--accent)" />
                <ScoreBar label="🔄 환승 횟수" value={scoreData.rawParams.transferCount} maxValue={4} unit="회" color="#8b5cf6" />
                <ScoreBar label="🚶 도보 거리" value={scoreData.rawParams.walkDistanceM} maxValue={1200} unit="m" color="#06b6d4" />
                <ScoreBar label="⏳ 대기 시간" value={scoreData.rawParams.waitTimeMin} maxValue={20} unit="분" color="#f59e0b" />
              </div>
            </>
          )}
        </div>
      </div>

      {/* 하단 여백 */}
      <div className="h-4" />
    </div>
  );
}
