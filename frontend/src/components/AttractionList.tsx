'use client';

import { useState } from 'react';
import type { Attraction } from '@/app/page';
import { useFavorites } from '@/hooks/useFavorites';

interface AttractionListProps {
  attractions: Attraction[];
  onSelect: (attraction: Attraction) => void;
  searchQuery: string;
  scores: Record<string, number>;
  distances: Record<string, number>;
}

const CATEGORIES = ['전체', '자연', '바다/해변', '역사/전통', '문화/예술', '박물관', '종교', '공원/레저'];

const CATEGORY_EMOJI: Record<string, string> = {
  '전체': '🗺️', '자연': '🌿', '바다/해변': '🌊', '역사/전통': '🏯',
  '문화/예술': '🎨', '박물관': '🏛️', '종교': '⛩️', '공원/레저': '🎡',
};

function ListBadge({ distanceKm }: { score: number | undefined; distanceKm: number | undefined }) {
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
  const [favOnly, setFavOnly] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('전체');

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

  const displayed = sorted
    .filter((a) => selectedCategory === '전체' || a.category === selectedCategory)
    .filter((a) => !favOnly || favorites.has(a.id));

  if (attractions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center">
        <span className="text-4xl mb-3">🔍</span>
        <p className="text-sm font-medium" style={{ color: 'var(--sidebar-text)' }}>검색 결과가 없습니다</p>
        <p className="text-xs mt-1" style={{ color: 'var(--sidebar-text-muted)' }}>
          &apos;{searchQuery}&apos; 에 해당하는 관광지가 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 카테고리 필터 */}
      <div className="px-3 pt-2 shrink-0">
        <div className="flex gap-1 overflow-x-auto pb-1 custom-scrollbar" style={{ scrollbarWidth: 'none' }}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className="shrink-0 text-[10px] px-2 py-1 rounded-lg transition-all whitespace-nowrap"
              style={{
                background: selectedCategory === cat ? 'var(--accent)' : 'var(--sidebar-surface)',
                color: selectedCategory === cat ? '#fff' : 'var(--sidebar-text-muted)',
                border: `1px solid ${selectedCategory === cat ? 'var(--accent)' : 'var(--sidebar-border)'}`,
              }}
            >
              {CATEGORY_EMOJI[cat]} {cat}
            </button>
          ))}
        </div>

        {/* 즐겨찾기 필터 */}
        {isLoggedIn && (
          <button
            onClick={() => setFavOnly((v) => !v)}
            className="flex items-center gap-1.5 text-[11px] px-3 py-1 rounded-lg transition-all mt-1.5"
            style={{
              background: favOnly ? 'rgba(244,63,94,0.15)' : 'transparent',
              color: favOnly ? '#f43f5e' : 'var(--sidebar-text-muted)',
              border: `1px solid ${favOnly ? 'rgba(244,63,94,0.3)' : 'transparent'}`,
            }}
          >
            {favOnly ? '♥' : '♡'} 즐겨찾기만 보기
            {favOnly && favorites.size > 0 && <span className="text-[10px] opacity-70">({favorites.size})</span>}
          </button>
        )}
      </div>

      {/* 리스트 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-2">
        {displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <span className="text-3xl mb-2">{favOnly ? '♡' : CATEGORY_EMOJI[selectedCategory]}</span>
            <p className="text-sm font-medium" style={{ color: 'var(--sidebar-text)' }}>
              {favOnly ? '즐겨찾기가 없습니다' : `${selectedCategory} 관광지가 없습니다`}
            </p>
          </div>
        ) : (
          displayed.map((attraction) => (
            <div
              key={attraction.id}
              className="w-full flex gap-3 p-3 rounded-xl mb-1.5 text-left transition-all group cursor-pointer"
              style={{ background: 'transparent' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--sidebar-surface)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              onClick={() => onSelect(attraction)}
            >
              <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-gray-700">
                {attraction.imageUrl ? (
                  <img src={attraction.imageUrl} alt={attraction.name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500 text-lg">📍</div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--sidebar-text)' }}>
                  {attraction.name}
                </h3>
                <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--sidebar-text-muted)' }}>
                  {attraction.address}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  {attraction.category && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--sidebar-surface)', color: 'var(--sidebar-text-muted)' }}>
                      {CATEGORY_EMOJI[attraction.category]} {attraction.category}
                    </span>
                  )}
                  <ListBadge score={scores[attraction.id]} distanceKm={distances[attraction.id]} />
                </div>
              </div>

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
          ))
        )}
      </div>
    </div>
  );
}
