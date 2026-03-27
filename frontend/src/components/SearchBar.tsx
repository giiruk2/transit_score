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
  '자연':    { bg: 'rgba(34,197,94,0.2)',   text: '#86efac' },
  '바다/해변':{ bg: 'rgba(14,165,233,0.2)', text: '#7dd3fc' },
  '역사/전통':{ bg: 'rgba(234,179,8,0.2)',  text: '#fde047' },
  '문화/예술':{ bg: 'rgba(236,72,153,0.2)', text: '#f9a8d4' },
  '박물관':  { bg: 'rgba(168,85,247,0.2)',  text: '#d8b4fe' },
  '종교':    { bg: 'rgba(249,115,22,0.2)',  text: '#fdba74' },
  '공원/레저':{ bg: 'rgba(20,184,166,0.2)', text: '#5eead4' },
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
              name: customAddress.length > 12 ? customAddress.slice(0, 12) + '...' : customAddress,
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
                  name: place.place_name.length > 12 ? place.place_name.slice(0, 12) + '...' : place.place_name,
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
    <div className="px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--sidebar-border)' }}>
      {/* 관광지 검색 + 드롭다운 */}
      <div className="relative mb-3">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => { onSearch(e.target.value); setDropdownOpen(true); }}
          onFocus={() => setDropdownOpen(true)}
          onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { onSearch(''); setDropdownOpen(false); }
          }}
          placeholder="관광지명 또는 주소로 검색..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-gray-500 outline-none transition-all focus:ring-2"
          style={{ background: 'var(--sidebar-surface)', border: '1px solid var(--sidebar-border)' }}
        />
        {searchQuery && (
          <button
            onClick={() => { onSearch(''); setDropdownOpen(false); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs"
          >
            ✕
          </button>
        )}

        {/* 드롭다운 */}
        {dropdownOpen && dropdownResults.length > 0 && (
          <div
            className="absolute left-0 right-0 top-full mt-1 rounded-xl overflow-hidden z-50 shadow-xl"
            style={{ background: 'var(--sidebar-bg)', border: '1px solid var(--sidebar-border)' }}
          >
            {dropdownResults.map((attraction) => {
              const c = attraction.category ? (CATEGORY_COLOR[attraction.category] ?? null) : null;
              return (
                <div
                  key={attraction.id}
                  className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer transition-all"
                  style={{ borderBottom: '1px solid var(--sidebar-border)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--sidebar-surface)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  onClick={() => handleSelectFromDropdown(attraction)}
                >
                  {/* 썸네일 */}
                  <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-gray-700">
                    {attraction.imageUrl
                      ? <img src={attraction.imageUrl} alt={attraction.name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">📍</div>
                    }
                  </div>
                  {/* 텍스트 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold truncate" style={{ color: 'var(--sidebar-text)' }}>
                      {attraction.name}
                    </p>
                    <p className="text-[10px] truncate" style={{ color: 'var(--sidebar-text-muted)' }}>
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
        <p className="text-[11px] mb-2 flex items-center gap-1.5" style={{ color: 'var(--sidebar-text-muted)' }}>
          🚩 출발지 설정 <span className="text-[9px] opacity-60">(주소 입력 또는 지도 클릭)</span>
        </p>

        {/* 현재 출발지 표시 */}
        <div
          className="px-3 py-2 rounded-lg text-[12px] flex items-center gap-2 mb-2"
          style={{ background: 'rgba(59, 130, 246, 0.15)', border: '1px solid var(--accent)', color: 'var(--accent-light)' }}
        >
          📍 <span className="font-semibold flex-1 truncate">{currentOrigin.name}</span>
          {isLoggedIn && (
            <button
              onClick={() => save({ name: currentOrigin.name, lat: currentOrigin.lat, lng: currentOrigin.lng, dongKey: currentOrigin.dongKey })}
              className="text-[10px] px-1.5 py-0.5 rounded shrink-0 transition-all"
              style={{ background: 'rgba(59,130,246,0.3)', color: 'var(--accent-light)' }}
              title="출발지 저장"
            >
              저장
            </button>
          )}
          {isLoggedIn && savedOrigins.length > 0 && (
            <button
              onClick={() => setShowSaved((v) => !v)}
              className="text-[10px] px-1.5 py-0.5 rounded shrink-0 transition-all"
              style={{ background: 'rgba(59,130,246,0.3)', color: 'var(--accent-light)' }}
            >
              {showSaved ? '닫기' : `목록(${savedOrigins.length})`}
            </button>
          )}
        </div>

        {/* 저장된 출발지 목록 */}
        {showSaved && savedOrigins.length > 0 && (
          <div className="mb-2 rounded-lg overflow-hidden" style={{ border: '1px solid var(--sidebar-border)' }}>
            {savedOrigins.map((o) => (
              <div
                key={o.id}
                className="flex items-center gap-2 px-3 py-2 text-[11px] cursor-pointer transition-all"
                style={{ borderBottom: '1px solid var(--sidebar-border)', color: 'var(--sidebar-text)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--sidebar-surface)'; }}
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
                  style={{ color: 'rgba(255,255,255,0.3)' }}
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
            className="flex-1 px-3 py-2 rounded-lg text-[12px] text-white placeholder-gray-500 outline-none"
            style={{ background: 'var(--sidebar-surface)', border: '1px solid var(--sidebar-border)' }}
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

        <p className="text-[10px] mt-1.5 flex items-center gap-1" style={{ color: 'var(--sidebar-text-muted)' }}>
          💡 지도를 클릭해도 출발지를 지정할 수 있습니다
        </p>
      </div>
    </div>
  );
}
