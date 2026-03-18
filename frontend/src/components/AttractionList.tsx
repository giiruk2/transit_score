'use client';

import type { Attraction } from '@/app/page';

interface AttractionListProps {
  attractions: Attraction[];
  onSelect: (attraction: Attraction) => void;
  searchQuery: string;
}

// 점수 등급 색상 (실제 점수는 클릭 후 ScorePanel에서 계산)
function getScoreBadgeColor(index: number) {
  // 임시: 리스트에서는 아이콘만 표시
  const colors = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'];
  return colors[index % colors.length];
}

export default function AttractionList({ attractions, onSelect, searchQuery }: AttractionListProps) {
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

  return (
    <div className="h-full overflow-y-auto custom-scrollbar px-3 py-2">
      {attractions.map((attraction, index) => (
        <button
          key={attraction.id}
          onClick={() => onSelect(attraction)}
          className="w-full flex gap-3 p-3 rounded-xl mb-1.5 text-left transition-all group"
          style={{
            background: 'transparent',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--sidebar-surface)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
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
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ background: getScoreBadgeColor(index) }}
              />
              <span className="text-[10px]" style={{ color: 'var(--sidebar-text-muted)' }}>
                클릭하여 접근성 점수 확인
              </span>
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
