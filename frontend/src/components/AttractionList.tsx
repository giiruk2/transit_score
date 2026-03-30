'use client';

import { useState } from 'react';
import type { Attraction } from '@/app/page';

interface AttractionListProps {
  attractions: Attraction[];
  onSelect: (attraction: Attraction) => void;
  searchQuery: string;
  scores: Record<string, number>;
  distances: Record<string, number>;
  selectedCategory: string | null;
  onCategoryChange: (cat: string | null) => void;
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
  isLoggedIn: boolean;
}

// 카테고리별 배경색 / 텍스트색 (라이트 패널용 — 대비 강화)
const CATEGORY_COLOR: Record<string, { bg: string; text: string }> = {
  '전체':    { bg: 'rgba(73,180,222,0.18)',  text: '#1a7fa8' },
  '자연':    { bg: 'rgba(34,197,94,0.18)',   text: '#166534' },
  '바다/해변':{ bg: 'rgba(14,165,233,0.18)', text: '#0369a1' },
  '역사/전통':{ bg: 'rgba(234,179,8,0.18)',  text: '#854d0e' },
  '문화/예술':{ bg: 'rgba(236,72,153,0.15)', text: '#9d174d' },
  '박물관':  { bg: 'rgba(168,85,247,0.15)',  text: '#6b21a8' },
  '종교':    { bg: 'rgba(249,115,22,0.15)',  text: '#9a3412' },
  '공원/레저':{ bg: 'rgba(20,184,166,0.15)', text: '#115e59' },
};

// 이름 길이에 따라 폰트 크기 동적 조정
function nameFontSize(name: string): string {
  if (name.length <= 9) return '15px';
  if (name.length <= 14) return '13px';
  return '11.5px';
}

function ListBadge({ distanceKm }: { distanceKm: number | undefined }) {
  if (distanceKm !== undefined) {
    return (
      <span className="text-[10px]" style={{ color: 'var(--panel-text-muted)' }}>
        약 {distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m` : `${distanceKm.toFixed(1)}km`}
      </span>
    );
  }
  return null;
}

// 레이아웃 토글 아이콘 SVG
function IconList() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <rect x="1" y="2" width="13" height="2" rx="1" fill="currentColor"/>
      <rect x="1" y="6.5" width="13" height="2" rx="1" fill="currentColor"/>
      <rect x="1" y="11" width="13" height="2" rx="1" fill="currentColor"/>
    </svg>
  );
}

function IconGrid() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <rect x="1" y="1" width="5.5" height="5.5" rx="1" fill="currentColor"/>
      <rect x="8.5" y="1" width="5.5" height="5.5" rx="1" fill="currentColor"/>
      <rect x="1" y="8.5" width="5.5" height="5.5" rx="1" fill="currentColor"/>
      <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1" fill="currentColor"/>
    </svg>
  );
}

export default function AttractionList({ attractions, onSelect, searchQuery, scores, distances, selectedCategory, onCategoryChange, favorites, onToggleFavorite, isLoggedIn }: AttractionListProps) {
  const [favOnly, setFavOnly] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

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
    .filter((a) => !selectedCategory || a.category === selectedCategory)
    .filter((a) => !favOnly || favorites.has(a.id));

  if (attractions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center">
        <span className="text-4xl mb-3">🔍</span>
        <p className="text-sm font-medium" style={{ color: 'var(--panel-text)' }}>검색 결과가 없습니다</p>
        <p className="text-xs mt-1" style={{ color: 'var(--panel-text-muted)' }}>
          &apos;{searchQuery}&apos; 에 해당하는 관광지가 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 툴바: 즐겨찾기 필터 + 레이아웃 토글 */}
      <div className="px-3 pt-2 shrink-0 flex items-center justify-between">
        {isLoggedIn ? (
          <button
            onClick={() => setFavOnly((v) => !v)}
            className="flex items-center gap-1.5 text-[11px] px-3 py-1 rounded-lg transition-all mt-1.5"
            style={{
              background: favOnly ? 'rgba(244,63,94,0.15)' : 'transparent',
              color: favOnly ? '#f43f5e' : 'var(--panel-text-muted)',
              border: `1px solid ${favOnly ? 'rgba(244,63,94,0.3)' : 'transparent'}`,
            }}
          >
            {favOnly ? '♥' : '♡'} 즐겨찾기만 보기
            {favOnly && favorites.size > 0 && <span className="text-[10px] opacity-70">({favorites.size})</span>}
          </button>
        ) : (
          <div />
        )}

        {/* 레이아웃 토글 */}
        <div
          className="flex items-center mt-1.5 rounded-lg overflow-hidden"
          style={{ border: '1px solid var(--panel-border)', background: 'var(--panel-surface)' }}
        >
          <button
            onClick={() => setViewMode('list')}
            className="flex items-center justify-center w-7 h-7 transition-colors"
            style={{
              color: viewMode === 'list' ? 'var(--accent)' : 'var(--panel-text-muted)',
              background: viewMode === 'list' ? 'rgba(73,180,222,0.15)' : 'transparent',
            }}
            title="리스트 보기"
          >
            <IconList />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className="flex items-center justify-center w-7 h-7 transition-colors"
            style={{
              color: viewMode === 'grid' ? 'var(--accent)' : 'var(--panel-text-muted)',
              background: viewMode === 'grid' ? 'rgba(73,180,222,0.15)' : 'transparent',
            }}
            title="그리드 보기"
          >
            <IconGrid />
          </button>
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-2">
        {displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <p className="text-sm font-medium" style={{ color: 'var(--panel-text)' }}>
              {favOnly ? '즐겨찾기가 없습니다' : `${selectedCategory} 관광지가 없습니다`}
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          /* ── 그리드 뷰 ── */
          <div className="grid grid-cols-2 gap-2">
            {displayed.map((attraction) => {
              const c = attraction.category
                ? (CATEGORY_COLOR[attraction.category] ?? { bg: 'rgba(100,100,100,0.2)', text: '#aaa' })
                : null;
              return (
                <div
                  key={attraction.id}
                  className="rounded-xl overflow-hidden cursor-pointer transition-all"
                  style={{ background: 'var(--panel-surface)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                  onClick={() => onSelect(attraction)}
                >
                  {/* 이미지 1:1 */}
                  <div className="relative w-full" style={{ paddingBottom: '100%' }}>
                    <div className="absolute inset-0 bg-gray-100">
                      {attraction.imageUrl ? (
                        <img src={attraction.imageUrl} alt={attraction.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-2xl">📍</div>
                      )}
                    </div>
                    {isLoggedIn && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onToggleFavorite(attraction.id); }}
                        className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center rounded-full text-xs transition-colors"
                        style={{
                          background: 'rgba(0,0,0,0.45)',
                          color: favorites.has(attraction.id) ? '#f43f5e' : 'rgba(255,255,255,0.5)',
                        }}
                      >
                        {favorites.has(attraction.id) ? '♥' : '♡'}
                      </button>
                    )}
                  </div>
                  {/* 이름 + 뱃지 */}
                  <div className="px-2 py-2">
                    <h3 className="text-xs font-semibold leading-tight line-clamp-2" style={{ color: 'var(--panel-text)' }}>
                      {attraction.name}
                    </h3>
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      {c && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: c.bg, color: c.text }}>
                          {attraction.category}
                        </span>
                      )}
                      <ListBadge distanceKm={distances[attraction.id]} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ── 리스트 뷰 ── */
          <div className="flex flex-col gap-2">
            {displayed.map((attraction) => {
              const c = attraction.category
                ? (CATEGORY_COLOR[attraction.category] ?? { bg: 'rgba(73,180,222,0.25)', text: '#9bbdd4' })
                : null;
              const distKm = distances[attraction.id];
              return (
                <div
                  key={attraction.id}
                  className="w-full flex rounded-2xl overflow-hidden cursor-pointer transition-all"
                  style={{ background: 'var(--panel-surface)', height: '96px' }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                  onClick={() => onSelect(attraction)}
                >
                  {/* 이미지 */}
                  <div className="relative shrink-0" style={{ width: '128px', height: '96px' }}>
                    {attraction.imageUrl ? (
                      <img src={attraction.imageUrl} alt={attraction.name} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400 text-3xl">📍</div>
                    )}
                    {/* 즐겨찾기 오버레이 */}
                    {isLoggedIn && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onToggleFavorite(attraction.id); }}
                        className="absolute bottom-2 left-2 flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full transition-colors"
                        style={{
                          background: 'rgba(0,0,0,0.5)',
                          color: favorites.has(attraction.id) ? '#f43f5e' : 'rgba(255,255,255,0.7)',
                        }}
                      >
                        {favorites.has(attraction.id) ? '♥' : '♡'}
                      </button>
                    )}
                  </div>

                  {/* 텍스트 */}
                  <div className="flex flex-col justify-center px-3 py-2 gap-1.5 min-w-0 overflow-hidden">
                    {c && (
                      <span
                        className="self-start text-[10px] font-semibold px-2.5 py-0.5 rounded-full shrink-0"
                        style={{ background: c.bg, color: c.text }}
                      >
                        {attraction.category}
                      </span>
                    )}
                    <h3
                      className="font-bold leading-snug"
                      style={{ color: 'var(--panel-text)', fontSize: nameFontSize(attraction.name) }}
                    >
                      {attraction.name}
                    </h3>
                    {distKm !== undefined && (
                      <div className="flex items-center gap-1.5" style={{ color: 'var(--panel-text-muted)' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <circle cx="12" cy="5" r="2"/>
                          <path d="M12 7v5l-3 3M12 12l3 3M9 21l1.5-4M15 21l-1.5-4"/>
                        </svg>
                        <span className="text-xs">
                          {distKm < 1 ? `${Math.round(distKm * 1000)}m` : `${distKm.toFixed(2)}km`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
