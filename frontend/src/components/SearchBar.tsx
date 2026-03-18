'use client';

import { useState } from 'react';

interface OriginType {
  name: string;
  lat: number;
  lng: number;
}

interface SearchBarProps {
  searchQuery: string;
  onSearch: (query: string) => void;
  currentOrigin: OriginType;
  onOriginChange: (origin: OriginType) => void;
}

export default function SearchBar({
  searchQuery, onSearch, currentOrigin, onOriginChange,
}: SearchBarProps) {
  const [customAddress, setCustomAddress] = useState('');
  const [searching, setSearching] = useState(false);

  // 카카오 주소 검색 → 좌표 변환
  const handleAddressSearch = async () => {
    if (!customAddress.trim()) return;
    setSearching(true);

    try {
      if (typeof window !== 'undefined' && window.kakao?.maps?.services) {
        const geocoder = new window.kakao.maps.services.Geocoder();
        geocoder.addressSearch(customAddress, (result: any, status: any) => {
          if (status === window.kakao.maps.services.Status.OK && result.length > 0) {
            const { y, x } = result[0];
            onOriginChange({
              name: customAddress.length > 12 ? customAddress.slice(0, 12) + '...' : customAddress,
              lat: parseFloat(y),
              lng: parseFloat(x),
            });
            setCustomAddress('');
          } else {
            const places = new window.kakao.maps.services.Places();
            places.keywordSearch(customAddress, (placeResult: any, placeStatus: any) => {
              if (placeStatus === window.kakao.maps.services.Status.OK && placeResult.length > 0) {
                const place = placeResult[0];
                onOriginChange({
                  name: place.place_name.length > 12 ? place.place_name.slice(0, 12) + '...' : place.place_name,
                  lat: parseFloat(place.y),
                  lng: parseFloat(place.x),
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
      {/* 관광지 검색 */}
      <div className="relative mb-3">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="관광지명 또는 주소로 검색..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-gray-500 outline-none transition-all focus:ring-2"
          style={{ background: 'var(--sidebar-surface)', border: '1px solid var(--sidebar-border)' }}
        />
        {searchQuery && (
          <button
            onClick={() => onSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs"
          >
            ✕
          </button>
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
          📍 <span className="font-semibold">{currentOrigin.name}</span>
          <span className="text-[10px] opacity-70">({currentOrigin.lat.toFixed(4)}, {currentOrigin.lng.toFixed(4)})</span>
        </div>

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
