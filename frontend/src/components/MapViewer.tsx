'use client';

import { useEffect, useRef, useState } from 'react';
import { Map as KakaoMap, CustomOverlayMap, Polyline } from 'react-kakao-maps-sdk';
import axios from 'axios';
import type { Attraction } from '@/app/page';
import type { SavedOrigin } from '@/hooks/useSavedOrigins';

const SELECTED_MARKER_SRC = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="52">
    <path d="M20 0C9 0 0 9 0 20c0 15 20 32 20 32s20-17 20-32C40 9 31 0 20 0z" fill="#6366f1" stroke="white" stroke-width="2"/>
    <circle cx="20" cy="20" r="9" fill="white"/>
    <circle cx="20" cy="20" r="5.5" fill="#6366f1"/>
  </svg>`
)}`;

const DEFAULT_MARKER_SRC = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="30">
    <path d="M11 0C4.9 0 0 4.9 0 11c0 8.25 11 19 11 19s11-10.75 11-19C22 4.9 17.1 0 11 0z" fill="#ef4444" stroke="white" stroke-width="1.5"/>
    <circle cx="11" cy="11" r="4" fill="white"/>
  </svg>`
)}`;


interface MapViewerProps {
  selectedAttraction: Attraction | null;
  onMarkerClick: (attraction: Attraction) => void;
  onAttractionsLoaded: (data: Attraction[]) => void;
  currentOrigin: { name: string; lat: number; lng: number; dongKey?: string };
  onOriginChange: (origin: { name: string; lat: number; lng: number; dongKey?: string }) => void;
  selectedCategory: string | null;
  favorites?: Set<string>;
  savedOrigins?: SavedOrigin[];
}

export default function MapViewer({
  selectedAttraction, onMarkerClick, onAttractionsLoaded,
  currentOrigin, onOriginChange, selectedCategory,
  favorites, savedOrigins,
}: MapViewerProps) {
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [mapCenter, setMapCenter] = useState({ lat: 35.1152, lng: 129.0422 });
  const [mapLevel, setMapLevel] = useState(7);
  const clustererRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const prevSelectedIdRef = useRef<string | null>(null);

  useEffect(() => {
    const fetchAttractions = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
        const response = await axios.get(`${apiUrl}/api/attractions`);
        if (response.data.success) {
          setAttractions(response.data.data);
          onAttractionsLoaded(response.data.data);
        }
      } catch (error) {
        console.error('Failed to fetch attractions:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAttractions();
  }, [onAttractionsLoaded]);

  useEffect(() => {
    if (selectedAttraction) {
      setMapCenter({ lat: selectedAttraction.lat, lng: selectedAttraction.lng });
      setMapLevel(4);
    }
  }, [selectedAttraction]);

  // 클러스터러 생성 (커스텀 마커 이미지 적용)
  useEffect(() => {
    if (!mapInstance || attractions.length === 0) return;
    if (!window.kakao?.maps?.MarkerClusterer) return;

    if (clustererRef.current) clustererRef.current.clear();
    markersRef.current.clear();

    const defaultImg = new window.kakao.maps.MarkerImage(
      DEFAULT_MARKER_SRC,
      new window.kakao.maps.Size(22, 30),
      { offset: new window.kakao.maps.Point(11, 30) }
    );

    const filtered = selectedCategory
      ? attractions.filter((a) => a.category === selectedCategory)
      : attractions;

    // 즐겨찾기는 CustomOverlayMap으로 별도 렌더링 → 클러스터에서 제외
    const markers = filtered
      .filter((a) => !(favorites?.has(a.id) ?? false))
      .map((attraction) => {
        const marker = new window.kakao.maps.Marker({
          position: new window.kakao.maps.LatLng(attraction.lat, attraction.lng),
          title: attraction.name,
          image: defaultImg,
          zIndex: 1,
        });
        window.kakao.maps.event.addListener(marker, 'click', () => {
          onMarkerClick(attraction);
        });
        markersRef.current.set(attraction.id, marker);
        return marker;
      });

    const clusterer = new window.kakao.maps.MarkerClusterer({
      map: mapInstance,
      averageCenter: true,
      minLevel: 7,
      gridSize: 40,
      markers,
    });

    clustererRef.current = clusterer;
    return () => { clusterer.clear(); };
  }, [mapInstance, attractions, onMarkerClick, selectedCategory, favorites]);

  // 선택된 마커 하이라이트
  useEffect(() => {
    if (!mapInstance || markersRef.current.size === 0) return;

    // 이전 선택 마커 복원 (즐겨찾기는 clusterer에 없으므로 일반 마커만 처리)
    if (prevSelectedIdRef.current) {
      const prev = markersRef.current.get(prevSelectedIdRef.current);
      if (prev) {
        const defaultImg = new window.kakao.maps.MarkerImage(
          DEFAULT_MARKER_SRC,
          new window.kakao.maps.Size(22, 30),
          { offset: new window.kakao.maps.Point(11, 30) }
        );
        prev.setImage(defaultImg);
        prev.setZIndex(1);
      }
    }

    // 새 선택 마커 하이라이트
    if (selectedAttraction) {
      const marker = markersRef.current.get(selectedAttraction.id);
      if (marker) {
        const selectedImg = new window.kakao.maps.MarkerImage(
          SELECTED_MARKER_SRC,
          new window.kakao.maps.Size(40, 52),
          { offset: new window.kakao.maps.Point(20, 52) }
        );
        marker.setImage(selectedImg);
        marker.setZIndex(100);
      }
      prevSelectedIdRef.current = selectedAttraction.id;
    } else {
      prevSelectedIdRef.current = null;
    }
  }, [selectedAttraction, mapInstance]);

  // 지도 클릭 → 출발지 설정
  const handleMapClick = (_map: any, mouseEvent: any) => {
    const lat = mouseEvent.latLng.getLat();
    const lng = mouseEvent.latLng.getLng();

    if (typeof window !== 'undefined' && window.kakao?.maps?.services) {
      const geocoder = new window.kakao.maps.services.Geocoder();
      geocoder.coord2Address(lng, lat, (result: any, status: any) => {
        let name = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        let dongKey: string | undefined;
        if (status === window.kakao.maps.services.Status.OK && result[0]) {
          const addr = result[0].road_address?.address_name || result[0].address?.address_name;
          if (addr) {
            name = addr;
            const match = addr.match(/(\S+구|\S+군)\s+(\S+동|\S+읍|\S+면)/);
            if (match) dongKey = `${match[1]} ${match[2]}`;
          }
        }
        onOriginChange({ name, lat, lng, dongKey });
      });
    } else {
      onOriginChange({ name: `${lat.toFixed(4)}, ${lng.toFixed(4)}`, lat, lng });
    }
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background: '#1a1a2e' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
          <span className="text-sm text-gray-400">지도를 불러오는 중...</span>
        </div>
      </div>
    );
  }

  return (
    <KakaoMap
      center={mapCenter}
      style={{ width: '100%', height: '100%' }}
      level={mapLevel}
      onCreate={setMapInstance}
      onZoomChanged={(map) => setMapLevel(map.getLevel())}
      onCenterChanged={(map) => {
        const center = map.getCenter();
        setMapCenter({ lat: center.getLat(), lng: center.getLng() });
      }}
      onClick={handleMapClick}
    >
      {/* 출발지 → 목적지 점선 */}
      {selectedAttraction && (
        <Polyline
          path={[
            { lat: currentOrigin.lat, lng: currentOrigin.lng },
            { lat: selectedAttraction.lat, lng: selectedAttraction.lng },
          ]}
          strokeWeight={2}
          strokeColor="#818cf8"
          strokeOpacity={0.8}
          strokeStyle="dash"
        />
      )}

      {/* 즐겨찾기 관광지 (클러스터 제외, 항상 표시) */}
      {attractions
        .filter((a) => favorites?.has(a.id))
        .filter((a) => !selectedCategory || a.category === selectedCategory)
        .map((a) => {
          const isSelected = selectedAttraction?.id === a.id;
          return (
            <CustomOverlayMap key={`fav-${a.id}`} position={{ lat: a.lat, lng: a.lng }} yAnchor={1.15} clickable>
              <div
                onClick={(e) => { e.stopPropagation(); onMarkerClick(a); }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}
              >
                <div style={{
                  background: isSelected ? '#6366f1' : '#f43f5e',
                  color: '#fff', fontSize: '11px', fontWeight: 700,
                  padding: '3px 9px', borderRadius: '999px', marginBottom: '3px',
                  whiteSpace: 'nowrap', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.45)',
                  border: isSelected ? '1.5px solid #fff' : '1px solid rgba(255,255,255,0.4)',
                  transform: isSelected ? 'scale(1.08)' : 'scale(1)',
                }}>
                  ♥ {a.name}
                </div>
                <div style={{
                  width: 0, height: 0,
                  borderLeft: '5px solid transparent',
                  borderRight: '5px solid transparent',
                  borderTop: `6px solid ${isSelected ? '#6366f1' : '#f43f5e'}`,
                }} />
              </div>
            </CustomOverlayMap>
          );
        })
      }

      {/* 저장된 출발지 마커 */}
      {savedOrigins?.map((o) => (
        <CustomOverlayMap key={o.id} position={{ lat: o.lat, lng: o.lng }} yAnchor={0.85}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none' }}>
            <div style={{
              background: 'rgba(59,130,246,0.9)', color: '#fff', fontSize: '11px', fontWeight: 700,
              padding: '3px 8px', borderRadius: '999px', marginBottom: '5px',
              whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            }}>
              ⭐ {o.name}
            </div>
            <div style={{
              width: '20px', height: '20px', borderRadius: '50%',
              background: 'rgba(59,130,246,1)', border: '2px solid #fff',
              boxShadow: '0 0 0 2px rgba(59,130,246,0.5), 0 2px 6px rgba(0,0,0,0.4)',
            }} />
          </div>
        </CustomOverlayMap>
      ))}

      {/* 출발지 마커 */}
      <CustomOverlayMap position={{ lat: currentOrigin.lat, lng: currentOrigin.lng }} yAnchor={0.85}>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none' }}>
          <div style={{
            background: 'rgba(249,115,22,1)', color: '#fff', fontSize: '15px', fontWeight: 800,
            padding: '5px 14px', borderRadius: '999px', marginBottom: '6px',
            whiteSpace: 'nowrap', boxShadow: '0 3px 10px rgba(0,0,0,0.5)',
            letterSpacing: '0.02em',
          }}>
            출발지
          </div>
          <div style={{ position: 'relative', width: '28px', height: '28px' }}>
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: 'rgba(249,115,22,0.4)',
              animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite',
            }} />
            <div style={{
              position: 'absolute', inset: '5px', borderRadius: '50%',
              background: 'rgba(249,115,22,1)', border: '2.5px solid #fff',
              boxShadow: '0 0 0 2px rgba(249,115,22,0.6), 0 2px 8px rgba(0,0,0,0.4)',
            }} />
          </div>
        </div>
      </CustomOverlayMap>
    </KakaoMap>
  );
}
