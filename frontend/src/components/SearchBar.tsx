'use client';

import { useState } from 'react';
import { useSavedOrigins } from '@/hooks/useSavedOrigins';
import type { Attraction } from '@/app/page';

interface OriginType {
  name: string;
  lat: number;
  lng: number;
  dongKey?: string;
}

interface SearchBarProps {
  searchQuery: string;
  onSearch: (query: string) => void;
  currentOrigin: OriginType;
  onOriginChange: (origin: OriginType) => void;
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
  searchQuery, onSearch, currentOrigin, onOriginChange,
  attractions, onSelectAttraction,
}: SearchBarProps) {
  const [customAddress, setCustomAddress] = useState('');
  const [searching, setSearching] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { savedOrigins, save, remove, isLoggedIn } = useSavedOrigins();

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

  // 카카오 주소 검색 → 좌표 변환
  const handleAddressSearch = async () => {
    if (!customAddress.trim()) return;
    setSearching(true);

    try {
      if (typeof window !== 'undefined' && window.kakao?.maps?.services) {
        const geocoder = new window.kakao.maps.services.Geocoder();
        const extractDongKey = (addr: string): string | undefined => {
          const match = addr.match(/(\S+구|\S+군)\s+(\S+동|\S+읍|\S+면)/);
          return match ? `${match[1]} ${match[2]}` : undefined;
        };

        geocoder.addressSearch(customAddress, (result: any, status: any) => {
          if (status === window.kakao.maps.services.Status.OK && result.length > 0) {
            const { y, x } = result[0];
            const addr = result[0].road_address?.address_name || result[0].address?.address_name || customAddress;
            onOriginChange({
              name: customAddress,
              lat: parseFloat(y),
              lng: parseFloat(x),
              dongKey: extractDongKey(addr),
            });
            setCustomAddress('');
          } else {
            const places = new window.kakao.maps.services.Places();
            places.keywordSearch(customAddress, (placeResult: any, placeStatus: any) => {
              if (placeStatus === window.kakao.maps.services.Status.OK && placeResult.length > 0) {
                const place = placeResult[0];
                const addr = place.address_name || place.road_address_name || '';
                onOriginChange({
                  name: place.place_name,
                  lat: parseFloat(place.y),
                  lng: parseFloat(place.x),
                  dongKey: extractDongKey(addr),
                });
                setCustomAddress('');
              } else {
                alert('해당 주소를 찾을 수 없습니다. 다시 입력해주세요.');
              }
              setSearching(false);
            });
            return;
          }
          setSearching(false);
        });
      }
    } catch {
      alert('주소 검색에 실패했습니다.');
      setSearching(false);
    }
  };

  return (
    <div className="px-4 py-3 shrink-0 relative z-10" style={{ borderBottom: '1px solid var(--panel-border)' }}>
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
            className="w-full pl-10 pr-8 rounded-xl text-[13px] font-medium placeholder-gray-400 outline-none transition-all"
            style={{
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
                    <p className="text-[12px] font-semibold truncate" style={{ color: 'var(--panel-text)' }}>
                      {attraction.name}
                    </p>
                    <p className="text-[10px] truncate" style={{ color: 'var(--panel-text-muted)' }}>
                      {attraction.address}
                    </p>
                  </div>
                  {/* 카테고리 배지 */}
                  {c && (
                    <span
                      className="shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium"
                      style={{ background: c.bg, color: c.text }}
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

      {/* 출발지 - 주소 입력 + 지도 클릭 */}
      <div>
        <p className="text-[11px] mb-2 flex items-center gap-1.5" style={{ color: 'var(--panel-text-muted)' }}>
          🚩 출발지 설정 <span className="text-[9px] opacity-80">(주소 입력 또는 지도 클릭)</span>
        </p>

        {/* 현재 출발지 표시 */}
        <div
          className="px-3 py-2 rounded-lg mb-2"
          style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59,130,246,0.3)' }}
        >
          {/* 주소: 전체 폭 사용 */}
          <div className="flex items-center gap-1.5 mb-1" style={{ color: 'var(--accent)' }}>
            <span className="shrink-0">📍</span>
            <span className="text-[12px] font-semibold leading-snug">{currentOrigin.name}</span>
          </div>
          {/* 버튼: 아랫줄 우측 정렬 */}
          {isLoggedIn && (
            <div className="flex items-center justify-end gap-1.5">
              <button
                onClick={() => save({ name: currentOrigin.name, lat: currentOrigin.lat, lng: currentOrigin.lng, dongKey: currentOrigin.dongKey })}
                className="text-[10px] px-2 py-0.5 rounded transition-all"
                style={{ background: 'var(--accent)', color: '#fff' }}
                title="출발지 저장"
              >
                + 저장
              </button>
              {savedOrigins.length > 0 && (
                <button
                  onClick={() => setShowSaved((v) => !v)}
                  className="text-[10px] px-2 py-0.5 rounded transition-all"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  {showSaved ? '닫기' : `목록 (${savedOrigins.length})`}
                </button>
              )}
            </div>
          )}
        </div>

        {/* 저장된 출발지 목록 */}
        {showSaved && savedOrigins.length > 0 && (
          <div className="mb-2 rounded-lg overflow-hidden" style={{ border: '1px solid var(--panel-border)' }}>
            {savedOrigins.map((o) => (
              <div
                key={o.id}
                className="flex items-center gap-2 px-3 py-2 text-[11px] cursor-pointer transition-all"
                style={{ borderBottom: '1px solid var(--panel-border)', color: 'var(--panel-text)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--panel-surface)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span
                  className="flex-1 truncate"
                  onClick={() => { onOriginChange({ name: o.name, lat: o.lat, lng: o.lng, dongKey: o.dongKey }); setShowSaved(false); }}
                >
                  📍 {o.name}
                </span>
                <button
                  onClick={() => remove(o.id)}
                  className="shrink-0 text-[10px]"
                  style={{ color: 'var(--panel-text-muted)' }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 주소 입력 */}
        <div className="flex gap-1.5">
          <input
            type="text"
            value={customAddress}
            onChange={(e) => setCustomAddress(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddressSearch()}
            placeholder="주소 또는 장소명 입력..."
            className="flex-1 px-3 py-2 rounded-lg text-[12px] placeholder-gray-400 outline-none"
            style={{ color: 'var(--panel-text)', background: 'var(--panel-surface)', border: '1px solid var(--panel-border)' }}
          />
          <button
            onClick={handleAddressSearch}
            disabled={searching}
            className="px-3 py-2 rounded-lg text-[11px] font-semibold transition-all"
            style={{ background: 'var(--accent)', color: '#fff', opacity: searching ? 0.5 : 1 }}
          >
            {searching ? '...' : '검색'}
          </button>
        </div>

        <p className="text-[10px] mt-1.5 flex items-center gap-1" style={{ color: 'var(--panel-text-muted)' }}>
          💡 지도를 클릭해도 출발지를 지정할 수 있습니다
        </p>
      </div>
    </div>
  );
}
