'use client';

import type { Attraction } from '@/app/page';
import { useFavorites } from '@/hooks/useFavorites';

interface AttractionListProps {
  attractions: Attraction[];
  onSelect: (attraction: Attraction) => void;
  searchQuery: string;
  scores: Record<string, number>;
  distances: Record<string, number>;
}

function ListBadge({ distanceKm }: { score: number | undefined; distanceKm: number | undefined }) {
  // 항상 거리만 표시 (점수는 ScorePanel에서 확인)
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
  const { favorites, toggle, isLoggedIn } = useFavorites();
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
        <div
          key={attraction.id}
          className="w-full flex gap-3 p-3 rounded-xl mb-1.5 text-left transition-all group cursor-pointer"
          style={{ background: 'transparent' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--sidebar-surface)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          onClick={() => onSelect(attraction)}
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

          {/* 즐겨찾기 + 화살표 */}
          <div className="flex flex-col items-center justify-between gap-1">
            {isLoggedIn && (
              <button
                onClick={(e) => { e.stopPropagation(); toggle(attraction.id); }}
                className="text-sm leading-none transition-colors"
                style={{ color: favorites.has(attraction.id) ? '#f43f5e' : 'rgba(255,255,255,0.2)' }}
              >
                {favorites.has(attraction.id) ? '♥' : '♡'}
              </button>
            )}
            <span className="text-xs text-gray-600 group-hover:text-gray-400 transition-colors">›</span>
          </div>
        </div>
      ))}
    </div>
  );
}
