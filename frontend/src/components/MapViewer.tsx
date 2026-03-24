'use client';

import { useEffect, useRef, useState } from 'react';
import { Map, MapMarker, CustomOverlayMap } from 'react-kakao-maps-sdk';
import axios from 'axios';
import type { Attraction } from '@/app/page';

interface MapViewerProps {
  selectedAttraction: Attraction | null;
  onMarkerClick: (attraction: Attraction) => void;
  onAttractionsLoaded: (data: Attraction[]) => void;
  currentOrigin: { name: string; lat: number; lng: number; dongKey?: string };
  onOriginChange: (origin: { name: string; lat: number; lng: number; dongKey?: string }) => void;
}

export default function MapViewer({
  selectedAttraction, onMarkerClick, onAttractionsLoaded,
  currentOrigin, onOriginChange,
}: MapViewerProps) {
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [mapCenter, setMapCenter] = useState({ lat: 35.1152, lng: 129.0422 });
  const [mapLevel, setMapLevel] = useState(7);
  const clustererRef = useRef<any>(null);

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

  // 지도 + 관광지 데이터 준비되면 클러스터러 생성
  useEffect(() => {
    if (!mapInstance || attractions.length === 0) return;
    if (!window.kakao?.maps?.MarkerClusterer) return;

    // 기존 클러스터러 제거
    if (clustererRef.current) {
      clustererRef.current.clear();
    }

    const markers = attractions.map((attraction) => {
      const marker = new window.kakao.maps.Marker({
        position: new window.kakao.maps.LatLng(attraction.lat, attraction.lng),
        title: attraction.name,
      });
      window.kakao.maps.event.addListener(marker, 'click', () => {
        onMarkerClick(attraction);
      });
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

    return () => {
      clusterer.clear();
    };
  }, [mapInstance, attractions, onMarkerClick]);

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
            name = addr.length > 12 ? addr.slice(0, 12) + '...' : addr;
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
    <Map
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
      {/* 출발지 마커 (CustomOverlay) */}
      <CustomOverlayMap
        position={{ lat: currentOrigin.lat, lng: currentOrigin.lng }}
        yAnchor={1.3}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none' }}>
          {/* 라벨 */}
          <div style={{
            background: 'rgba(249,115,22,0.95)',
            color: '#fff',
            fontSize: '11px',
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: '999px',
            marginBottom: '4px',
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
          }}>
            📍 {currentOrigin.name}
          </div>
          {/* 펄스 원 */}
          <div style={{ position: 'relative', width: '20px', height: '20px' }}>
            <div style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: 'rgba(249,115,22,0.3)',
              animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite',
            }} />
            <div style={{
              position: 'absolute',
              inset: '4px',
              borderRadius: '50%',
              background: 'rgba(249,115,22,1)',
              border: '2px solid #fff',
              boxShadow: '0 0 0 2px rgba(249,115,22,0.5)',
            }} />
          </div>
        </div>
      </CustomOverlayMap>
    </Map>
  );
}
