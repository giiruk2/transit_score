'use client';

import type { Attraction } from '@/app/page';

interface AttractionListProps {
  attractions: Attraction[];
  onSelect: (attraction: Attraction) => void;
  searchQuery: string;
  // 실제 TransitScore (0~100). 향후 동별 사전계산 DB 데이터로 채워짐
  scores: Record<string, number>;
  // 출발지까지 직선 거리 (km). scores 없을 때 정렬 기준으로 사용
  distances: Record<string, number>;
}

function ListBadge({ score, distanceKm }: { score: number | undefined; distanceKm: number | undefined }) {
  // 실제 점수가 있으면 점수 배지
  if (score !== undefined) {
    const color =
      score >= 80 ? 'var(--score-excellent)' :
      score >= 60 ? 'var(--score-good)' :
      score >= 40 ? 'var(--score-average)' :
      'var(--score-poor)';
    return (
      <span className="text-[11px] font-bold tabular-nums" style={{ color }}>
        {score}점
      </span>
    );
  }
  // 점수 없으면 거리 표시
  if (distanceKm !== undefined) {
    return (
      <span className="text-[10px]" style={{ color: 'var(--sidebar-text-muted)' }}>
        약 {distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m` : `${distanceKm.toFixed(1)}km`}
      </span>
    );
  }
  return null;
}

export default function AttractionList({ attractions, onSelect, searchQuery, scores, distances }: AttractionListProps) {
  if (attractions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center">
        <span className="text-4xl mb-3">🔍</span>
        <p className="text-sm font-medium" style={{ color: 'var(--sidebar-text)' }}>
          검색 결과가 없습니다
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--sidebar-text-muted)' }}>
          &apos;{searchQuery}&apos; 에 해당하는 관광지가 없습니다.
        </p>
      </div>
    );
  }

  // 정렬 우선순위: 실제 점수(내림차순) > 거리(오름차순) > 원래 순서 유지
  const sorted = [...attractions].sort((a, b) => {
    const sa = scores[a.id];
    const sb = scores[b.id];
    if (sa !== undefined && sb !== undefined) return sb - sa;
    if (sa !== undefined) return -1;
    if (sb !== undefined) return 1;
    const da = distances[a.id] ?? Infinity;
    const db = distances[b.id] ?? Infinity;
    return da - db;
  });

  return (
    <div className="h-full overflow-y-auto custom-scrollbar px-3 py-2">
      {sorted.map((attraction) => (
        <button
          key={attraction.id}
          onClick={() => onSelect(attraction)}
          className="w-full flex gap-3 p-3 rounded-xl mb-1.5 text-left transition-all group"
          style={{ background: 'transparent' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--sidebar-surface)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          {/* 썸네일 */}
          <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-gray-700">
            {attraction.imageUrl ? (
              <img
                src={attraction.imageUrl}
                alt={attraction.name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500 text-lg">
                📍
              </div>
            )}
          </div>

          {/* 정보 */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--sidebar-text)' }}>
              {attraction.name}
            </h3>
            <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--sidebar-text-muted)' }}>
              {attraction.address}
            </p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <ListBadge score={scores[attraction.id]} distanceKm={distances[attraction.id]} />
            </div>
          </div>

          {/* 화살표 */}
          <div className="flex items-center text-gray-600 group-hover:text-gray-400 transition-colors">
            <span className="text-xs">›</span>
          </div>
        </button>
      ))}
    </div>
  );
}
