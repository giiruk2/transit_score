'use client';

import { useState } from 'react';
import type { Attraction } from '@/app/page';

interface SearchBarProps {
  searchQuery: string;
  onSearch: (query: string) => void;
  attractions: Attraction[];
  onSelectAttraction: (attraction: Attraction) => void;
}

const CATEGORY_COLOR: Record<string, { bg: string; text: string }> = {
  '자연':    { bg: 'rgba(34,197,94,0.18)',   text: '#166534' },
  '바다/해변':{ bg: 'rgba(14,165,233,0.18)', text: '#0369a1' },
  '역사/전통':{ bg: 'rgba(234,179,8,0.18)',  text: '#854d0e' },
  '문화/예술':{ bg: 'rgba(236,72,153,0.15)', text: '#9d174d' },
  '박물관':  { bg: 'rgba(168,85,247,0.15)',  text: '#6b21a8' },
  '종교':    { bg: 'rgba(249,115,22,0.15)',  text: '#9a3412' },
  '공원/레저':{ bg: 'rgba(20,184,166,0.15)', text: '#115e59' },
};

export default function SearchBar({
  searchQuery, onSearch, attractions, onSelectAttraction,
}: SearchBarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const dropdownResults = searchQuery.trim()
    ? attractions
        .filter((a) => {
          const q = searchQuery.toLowerCase();
          return a.name.toLowerCase().includes(q) || (a.address ?? '').toLowerCase().includes(q);
        })
        .slice(0, 6)
    : [];

  const handleSelectFromDropdown = (attraction: Attraction) => {
    onSelectAttraction(attraction);
    onSearch('');
    setDropdownOpen(false);
  };


  return (
    <div className="px-4 shrink-0 relative z-10" style={{ borderBottom: '1px solid var(--panel-border)' }}>
      {/* 헤더 */}
      <div className="py-4 mb-1 flex items-center gap-2">
        <div>
          <h1 className="font-extrabold tracking-tight" style={{ fontSize: 'var(--font-lg)', color: 'var(--panel-text)' }}>
            Transit<span style={{ color: 'var(--accent)' }}>Score</span>
          </h1>
          <p style={{ fontSize: 'var(--font-2xs)', color: 'var(--panel-text-muted)' }}>부산 관광지 대중교통 접근성</p>
        </div>
      </div>

      {/* 관광지 검색 + 드롭다운 */}
      <div className="relative mb-3">
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base">🔍</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { onSearch(e.target.value); setDropdownOpen(true); }}
            onFocus={(e) => {
              setDropdownOpen(true);
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(73,180,222,0.35)';
              e.currentTarget.style.borderColor = 'var(--accent)';
            }}
            onBlur={(e) => {
              setTimeout(() => setDropdownOpen(false), 150);
              e.currentTarget.style.boxShadow = '0 0 0 2px rgba(73,180,222,0.2)';
              e.currentTarget.style.borderColor = 'rgba(73,180,222,0.6)';
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { onSearch(''); setDropdownOpen(false); }
            }}
            placeholder="관광지명 또는 주소로 검색..."
            className="w-full pl-10 pr-8 rounded-xl font-medium placeholder-gray-400 outline-none transition-all"
            style={{
              fontSize: 'var(--font-sm)',
              color: 'var(--panel-text)',
              background: 'rgba(73,180,222,0.08)',
              border: '1px solid rgba(73,180,222,0.5)',
              boxShadow: '0 0 0 2px rgba(73,180,222,0.15)',
              padding: '11px 2rem 11px 2.5rem',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => { onSearch(''); setDropdownOpen(false); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* 드롭다운 */}
        {dropdownOpen && dropdownResults.length > 0 && (
          <div
            className="absolute left-0 right-0 top-full mt-1 rounded-xl overflow-hidden z-50 shadow-xl"
            style={{ background: 'var(--panel-bg)', border: '1px solid var(--panel-border)' }}
          >
            {dropdownResults.map((attraction) => {
              const c = attraction.category ? (CATEGORY_COLOR[attraction.category] ?? null) : null;
              return (
                <div
                  key={attraction.id}
                  className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer transition-all"
                  style={{ borderBottom: '1px solid var(--panel-border)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--panel-surface)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  onClick={() => handleSelectFromDropdown(attraction)}
                >
                  {/* 썸네일 */}
                  <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-gray-200">
                    {attraction.imageUrl
                      ? <img src={attraction.imageUrl} alt={attraction.name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">📍</div>
                    }
                  </div>
                  {/* 텍스트 */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate" style={{ fontSize: 'var(--font-sm)', color: 'var(--panel-text)' }}>
                      {attraction.name}
                    </p>
                    <p className="truncate" style={{ fontSize: 'var(--font-2xs)', color: 'var(--panel-text-muted)' }}>
                      {attraction.address}
                    </p>
                  </div>
                  {/* 카테고리 배지 */}
                  {c && (
                    <span
                      className="shrink-0 px-1.5 py-0.5 rounded font-medium"
                      style={{ fontSize: 'var(--font-2xs)', background: c.bg, color: c.text }}
                    >
                      {attraction.category}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
