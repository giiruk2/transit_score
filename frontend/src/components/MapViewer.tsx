'use client';

import { useEffect, useState } from 'react';
import { Map, MapMarker } from 'react-kakao-maps-sdk';
import axios from 'axios';
import type { Attraction } from '@/app/page';

interface MapViewerProps {
  selectedAttraction: Attraction | null;
  onMarkerClick: (attraction: Attraction) => void;
  onAttractionsLoaded: (data: Attraction[]) => void;
  currentOrigin: { name: string; lat: number; lng: number };
  onOriginChange: (origin: { name: string; lat: number; lng: number }) => void;
}

export default function MapViewer({
  selectedAttraction, onMarkerClick, onAttractionsLoaded,
  currentOrigin, onOriginChange,
}: MapViewerProps) {
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapCenter, setMapCenter] = useState({ lat: 35.1152, lng: 129.0422 });
  const [mapLevel, setMapLevel] = useState(7);

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

  // 지도 클릭 → 출발지 설정 (항상 활성화)
  const handleMapClick = (_map: any, mouseEvent: any) => {
    const lat = mouseEvent.latLng.getLat();
    const lng = mouseEvent.latLng.getLng();

    if (typeof window !== 'undefined' && window.kakao?.maps?.services) {
      const geocoder = new window.kakao.maps.services.Geocoder();
      geocoder.coord2Address(lng, lat, (result: any, status: any) => {
        let name = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        if (status === window.kakao.maps.services.Status.OK && result[0]) {
          const addr = result[0].road_address?.address_name || result[0].address?.address_name;
          if (addr) {
            name = addr.length > 12 ? addr.slice(0, 12) + '...' : addr;
          }
        }
        onOriginChange({ name, lat, lng });
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
      onZoomChanged={(map) => setMapLevel(map.getLevel())}
      onCenterChanged={(map) => {
        const center = map.getCenter();
        setMapCenter({ lat: center.getLat(), lng: center.getLng() });
      }}
      onClick={handleMapClick}
    >
      {/* 출발지 마커 (별) */}
      <MapMarker
        position={{ lat: currentOrigin.lat, lng: currentOrigin.lng }}
        image={{
          src: 'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png',
          size: { width: 24, height: 35 },
        }}
        title={`출발: ${currentOrigin.name}`}
      />

      {/* 관광지 마커 */}
      {attractions.map((attraction) => (
        <MapMarker
          key={attraction.id}
          position={{ lat: attraction.lat, lng: attraction.lng }}
          onClick={() => onMarkerClick(attraction)}
          title={attraction.name}
        />
      ))}
    </Map>
  );
}
