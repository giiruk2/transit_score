'use client';

import { useState } from 'react';
import { useSavedOrigins } from '@/hooks/useSavedOrigins';

interface OriginType {
  name: string;
  lat: number;
  lng: number;
  dongKey?: string;
}

interface OriginPanelProps {
  currentOrigin: OriginType;
  onOriginChange: (origin: OriginType) => void;
}

export default function OriginPanel({ currentOrigin, onOriginChange }: OriginPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [customAddress, setCustomAddress] = useState('');
  const [searching, setSearching] = useState(false);
  const { savedOrigins, save, remove, isLoggedIn } = useSavedOrigins();

  const extractDongKey = (addr: string): string | undefined => {
    const match = addr.match(/(\S+구|\S+군)\s+(\S+동|\S+읍|\S+면)/);
    return match ? `${match[1]} ${match[2]}` : undefined;
  };

  const handleAddressSearch = async () => {
    if (!customAddress.trim()) return;
    setSearching(true);
    try {
      if (typeof window !== 'undefined' && window.kakao?.maps?.services) {
        const geocoder = new window.kakao.maps.services.Geocoder();
        geocoder.addressSearch(customAddress, (result: any, status: any) => {
          if (status === window.kakao.maps.services.Status.OK && result.length > 0) {
            const { y, x } = result[0];
            const addr = result[0].road_address?.address_name || result[0].address?.address_name || customAddress;
            onOriginChange({ name: customAddress, lat: parseFloat(y), lng: parseFloat(x), dongKey: extractDongKey(addr) });
            setCustomAddress('');
            setExpanded(false);
          } else {
            const places = new window.kakao.maps.services.Places();
            places.keywordSearch(customAddress, (placeResult: any, placeStatus: any) => {
              if (placeStatus === window.kakao.maps.services.Status.OK && placeResult.length > 0) {
                const place = placeResult[0];
                const addr = place.address_name || place.road_address_name || '';
                onOriginChange({ name: place.place_name, lat: parseFloat(place.y), lng: parseFloat(place.x), dongKey: extractDongKey(addr) });
                setCustomAddress('');
                setExpanded(false);
              } else {
                alert('해당 주소를 찾을 수 없습니다.');
              }
              setSearching(false);
            });
            return;
          }
          setSearching(false);
        });
      }
    } catch {
      setSearching(false);
    }
  };

  return (
    <div
      className="absolute top-4 right-4 z-[1000]"
      style={{ minWidth: expanded ? '260px' : 'auto' }}
    >
      {/* collapsed: 한 줄 pill */}
      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl shadow-lg transition-all hover:brightness-105 active:scale-95"
          style={{
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(73,180,222,0.3)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
          }}
        >
          <span className="text-sm">📍</span>
          <span className="text-[12px] font-semibold max-w-[140px] truncate" style={{ color: 'var(--panel-text)' }}>
            {currentOrigin.name}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium" style={{ background: 'rgba(73,180,222,0.15)', color: 'var(--accent)' }}>
            변경
          </span>
        </button>
      )}

      {/* expanded: 입력 패널 */}
      {expanded && (
        <div
          className="rounded-2xl p-3 shadow-xl"
          style={{
            background: 'rgba(255,255,255,0.96)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(73,180,222,0.25)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
          }}
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[12px] font-bold" style={{ color: 'var(--panel-text)' }}>출발지 설정</span>
            <button onClick={() => setExpanded(false)} className="text-[13px]" style={{ color: 'var(--panel-text-muted)' }}>✕</button>
          </div>

          {/* 현재 출발지 */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg mb-2.5" style={{ background: 'rgba(73,180,222,0.08)', border: '1px solid rgba(73,180,222,0.2)' }}>
            <span className="text-sm">📍</span>
            <span className="text-[12px] font-semibold truncate flex-1" style={{ color: 'var(--accent)' }}>{currentOrigin.name}</span>
            {isLoggedIn && (
              <button
                onClick={() => save({ name: currentOrigin.name, lat: currentOrigin.lat, lng: currentOrigin.lng, dongKey: currentOrigin.dongKey })}
                className="text-[10px] px-2 py-0.5 rounded shrink-0"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                저장
              </button>
            )}
          </div>

          {/* 저장된 출발지 */}
          {isLoggedIn && savedOrigins.length > 0 && (
            <div className="mb-2.5 rounded-lg overflow-hidden" style={{ border: '1px solid var(--panel-border)' }}>
              {savedOrigins.map((o) => (
                <div
                  key={o.id}
                  className="flex items-center gap-2 px-2.5 py-1.5 text-[11px] cursor-pointer transition-all"
                  style={{ borderBottom: '1px solid var(--panel-border)', color: 'var(--panel-text)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--panel-surface)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <span className="flex-1 truncate" onClick={() => { onOriginChange({ name: o.name, lat: o.lat, lng: o.lng, dongKey: o.dongKey }); setExpanded(false); }}>
                    📍 {o.name}
                  </span>
                  <button onClick={() => remove(o.id)} className="shrink-0" style={{ color: 'var(--panel-text-muted)' }}>✕</button>
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
              placeholder="주소 또는 장소명..."
              className="flex-1 px-2.5 py-2 rounded-lg text-[12px] placeholder-gray-400 outline-none"
              style={{ color: 'var(--panel-text)', background: 'var(--panel-surface)', border: '1px solid var(--panel-border)' }}
              autoFocus
            />
            <button
              onClick={handleAddressSearch}
              disabled={searching}
              className="px-3 py-2 rounded-lg text-[11px] font-semibold"
              style={{ background: 'var(--accent)', color: '#fff', opacity: searching ? 0.5 : 1 }}
            >
              {searching ? '...' : '검색'}
            </button>
          </div>
          <p className="text-[10px] mt-1.5" style={{ color: 'var(--panel-text-muted)' }}>💡 지도를 클릭해도 출발지를 설정할 수 있습니다</p>
        </div>
      )}
    </div>
  );
}
