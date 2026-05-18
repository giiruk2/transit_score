'use client';

import { useEffect, useRef, useState } from 'react';
import { Map as KakaoMap, CustomOverlayMap } from 'react-kakao-maps-sdk';
import axios from 'axios';
import type { Attraction } from '@/app/page';
import type { SavedOrigin } from '@/hooks/useSavedOrigins';

const SELECTED_MARKER_SRC = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="52">
    <path d="M20 0C9 0 0 9 0 20c0 15 20 32 20 32s20-17 20-32C40 9 31 0 20 0z" fill="#49B4DE" stroke="white" stroke-width="2"/>
    <circle cx="20" cy="20" r="9" fill="white"/>
    <circle cx="20" cy="20" r="5.5" fill="#49B4DE"/>
  </svg>`
)}`;

const DEFAULT_MARKER_SRC = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="30">
    <path d="M11 0C4.9 0 0 4.9 0 11c0 8.25 11 19 11 19s11-10.75 11-19C22 4.9 17.1 0 11 0z" fill="#ef4444" stroke="white" stroke-width="1.5"/>
    <circle cx="11" cy="11" r="4" fill="white"/>
  </svg>`
)}`;


export interface RouteLeg {
  mode: 'walk' | 'bus' | 'subway';
  routeShortName?: string;
  boardStopName?: string;
  alightStopName?: string;
  coords: { lat: number; lng: number }[];
  durationSec: number;
  // 고도 데이터 (도보 구간만)
  elevationProfile?: { lat: number; lng: number; elevation: number }[];
  slopeSegments?: number[];  // rise/run 경사도 배열
}


interface MapViewerProps {
  selectedAttraction: Attraction | null;
  onMarkerClick: (attraction: Attraction) => void;
  onAttractionsLoaded: (data: Attraction[]) => void;
  currentOrigin: { name: string; lat: number; lng: number; dongKey?: string };
  onOriginChange: (origin: { name: string; lat: number; lng: number; dongKey?: string }) => void;
  selectedCategory: string | null;
  favorites?: Set<string>;
  savedOrigins?: SavedOrigin[];
  activeLegs?: RouteLeg[];
  onSaveRoute?: () => void;  // 폴리라인 우클릭 → 경로 저장 요청
}

type SubwayLineData = { segments: { lat: number; lng: number }[][]; colour: string };

export default function MapViewer({
  selectedAttraction, onMarkerClick, onAttractionsLoaded,
  currentOrigin, onOriginChange, selectedCategory,
  favorites, savedOrigins, activeLegs, onSaveRoute,
}: MapViewerProps) {
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [mapCenter, setMapCenter] = useState({ lat: 35.1152, lng: 129.0422 });
  const [mapLevel, setMapLevel] = useState(7);
  const clustererRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const prevSelectedIdRef = useRef<string | null>(null);
  const polylinesRef = useRef<any[]>([]);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [subwayLines, setSubwayLines] = useState<Map<string, SubwayLineData> | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  // 끝-끝이 붙어 있는 세그먼트들을 이어 붙여 긴 경로로 합치기
  function mergeSegments(segs: { lat: number; lng: number }[][]): { lat: number; lng: number }[][] {
    const THRESHOLD = 0.002; // ~200m 이내면 연결로 판단
    const pool = segs.map((s) => [...s]);
    const result: { lat: number; lng: number }[][] = [];
    while (pool.length > 0) {
      let current = pool.shift()!;
      let merged = true;
      while (merged) {
        merged = false;
        for (let i = 0; i < pool.length; i++) {
          const tail = current[current.length - 1];
          const head = current[0];
          const s = pool[i];
          const sHead = s[0];
          const sTail = s[s.length - 1];
          const distTailHead = Math.abs(tail.lat - sHead.lat) + Math.abs(tail.lng - sHead.lng);
          const distTailTail = Math.abs(tail.lat - sTail.lat) + Math.abs(tail.lng - sTail.lng);
          const distHeadHead = Math.abs(head.lat - sHead.lat) + Math.abs(head.lng - sHead.lng);
          const distHeadTail = Math.abs(head.lat - sTail.lat) + Math.abs(head.lng - sTail.lng);
          if (distTailHead < THRESHOLD) {
            current = [...current, ...s.slice(1)];
          } else if (distTailTail < THRESHOLD) {
            current = [...current, ...s.slice(0, -1).reverse()];
          } else if (distHeadHead < THRESHOLD) {
            current = [...s.slice(1).reverse(), ...current];
          } else if (distHeadTail < THRESHOLD) {
            current = [...s, ...current.slice(1)];
          } else {
            continue;
          }
          pool.splice(i, 1);
          merged = true;
          break;
        }
      }
      result.push(current);
    }
    return result;
  }

  // 지하철 노선 GeoJSON 로드 — 인접 세그먼트 병합 후 보관
  useEffect(() => {
    fetch('/subway-lines.geojson')
      .then((r) => r.json())
      .then((data) => {
        const raw = new Map<string, { segs: { lat: number; lng: number }[][]; colour: string }>();
        for (const feature of data.features) {
          if (feature.geometry.type !== 'LineString') continue;
          const ref: string = feature.properties.ref;
          if (!ref) continue;
          const colour: string = feature.properties.colour || '#a855f7';
          const coords = (feature.geometry.coordinates as [number, number][]).map(
            ([lng, lat]) => ({ lat, lng })
          );
          if (!raw.has(ref)) raw.set(ref, { segs: [], colour });
          raw.get(ref)!.segs.push(coords);
        }
        const map = new Map<string, SubwayLineData>();
        raw.forEach(({ segs, colour }, ref) => {
          map.set(ref, { segments: mergeSegments(segs), colour });
        });
        setSubwayLines(map);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resolveSubwayRef(routeShortName?: string): string | undefined {
    if (!routeShortName) return undefined;
    if (routeShortName.includes('동해선')) return '동해선';
    return routeShortName.match(/\d+/)?.[0];
  }

  // 지하철 leg의 탑승역~하차역 구간을 GeoJSON 세그먼트에서 추출
  function getSubwayCoords(leg: RouteLeg): { lat: number; lng: number }[] {
    if (!subwayLines || leg.coords.length < 2) return leg.coords;
    const ref = resolveSubwayRef(leg.routeShortName);
    if (!ref) return leg.coords;
    const lineData = subwayLines.get(ref);
    if (!lineData || lineData.segments.length === 0) return leg.coords;

    const boardLat = leg.coords[0].lat;
    const boardLng = leg.coords[0].lng;
    const alightLat = leg.coords[leg.coords.length - 1].lat;
    const alightLng = leg.coords[leg.coords.length - 1].lng;

    // 각 세그먼트에서 탑승/하차역까지의 최근접점 탐색
    let boardSegIdx = 0, boardPtIdx = 0, minBoardDist = Infinity;
    let alightSegIdx = 0, alightPtIdx = 0, minAlightDist = Infinity;

    lineData.segments.forEach((seg, si) => {
      for (let i = 0; i < seg.length; i++) {
        const dBoard  = (seg[i].lat - boardLat) ** 2 + (seg[i].lng - boardLng) ** 2;
        const dAlight = (seg[i].lat - alightLat) ** 2 + (seg[i].lng - alightLng) ** 2;
        if (dBoard  < minBoardDist)  { minBoardDist  = dBoard;  boardSegIdx  = si; boardPtIdx  = i; }
        if (dAlight < minAlightDist) { minAlightDist = dAlight; alightSegIdx = si; alightPtIdx = i; }
      }
    });

    // 같은 세그먼트 → 단순 slice
    if (boardSegIdx === alightSegIdx) {
      const seg = lineData.segments[boardSegIdx];
      const start = Math.min(boardPtIdx, alightPtIdx);
      const end   = Math.max(boardPtIdx, alightPtIdx);
      const slice = seg.slice(start, end + 1);
      return slice.length >= 2 ? slice : leg.coords;
    }

    // 다른 세그먼트 → 데이터 갭이 있는 경우. 직선(leg.coords)으로 폴백
    return leg.coords;
  }

  function getSubwayColour(leg: RouteLeg): string {
    if (!subwayLines) return '#a855f7';
    const ref = resolveSubwayRef(leg.routeShortName);
    if (!ref) return '#a855f7';
    return subwayLines.get(ref)?.colour ?? '#a855f7';
  }


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

  // 목적지 선택 시 출발지+목적지 둘 다 보이도록 bounds 조정
  useEffect(() => {
    if (!mapInstance || !selectedAttraction) return;
    const kakao = window.kakao?.maps;
    if (!kakao) return;
    const bounds = new kakao.LatLngBounds();
    bounds.extend(new kakao.LatLng(currentOrigin.lat, currentOrigin.lng));
    bounds.extend(new kakao.LatLng(selectedAttraction.lat, selectedAttraction.lng));
    mapInstance.setBounds(bounds, 80);
  }, [selectedAttraction, mapInstance, currentOrigin]);

  // 마커 + 클러스터 통합 effect (선택 상태 포함)
  useEffect(() => {
    if (!mapInstance || attractions.length === 0) return;
    const kakao = window.kakao?.maps;
    if (!kakao?.MarkerClusterer) return;

    // 기존 클러스터·마커 초기화
    if (clustererRef.current) { clustererRef.current.clear(); clustererRef.current = null; }
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current.clear();

    const defaultImg = new kakao.MarkerImage(DEFAULT_MARKER_SRC, new kakao.Size(22, 30), { offset: new kakao.Point(11, 30) });
    const selectedImg = new kakao.MarkerImage(SELECTED_MARKER_SRC, new kakao.Size(40, 52), { offset: new kakao.Point(20, 52) });

    const filtered = selectedCategory
      ? attractions.filter((a) => a.category === selectedCategory)
      : attractions;

    const markers = filtered
      .filter((a) => !(favorites?.has(a.id) ?? false))
      .map((attraction) => {
        const isSelected = selectedAttraction?.id === attraction.id;
        const marker = new kakao.Marker({
          position: new kakao.LatLng(attraction.lat, attraction.lng),
          title: attraction.name,
          image: isSelected ? selectedImg : defaultImg,
          zIndex: isSelected ? 100 : 1,
        });
        if (selectedAttraction) {
          marker.setOpacity(isSelected ? 1 : 0.25);
          marker.setMap(mapInstance);
        }
        kakao.event.addListener(marker, 'click', () => onMarkerClick(attraction));
        markersRef.current.set(attraction.id, marker);
        return marker;
      });

    if (!selectedAttraction) {
      // 선택 없음 → 클러스터 모드
      const clusterer = new kakao.MarkerClusterer({
        map: mapInstance,
        averageCenter: true,
        minLevel: 7,
        gridSize: 40,
        markers,
      });
      clustererRef.current = clusterer;
      return () => { clusterer.clear(); };
    }

    return () => {
      markersRef.current.forEach((m) => m.setMap(null));
    };
  }, [mapInstance, attractions, onMarkerClick, selectedCategory, favorites, selectedAttraction]);

  // 경사도에 따른 색상 반환
  // |slope| < 3%: 파랑(평지), 3~8%: 주황(완경사), ≥8%: 빨강(급경사)
  function slopeColor(slope: number): string {
    const abs = Math.abs(slope);
    if (abs >= 0.08) return '#ef4444'; // 빨강 (급경사)
    if (abs >= 0.03) return '#f97316'; // 주황 (완경사)
    return '#3b82f6';                  // 파랑 (평지)
  }

  // activeLegs → 카카오맵 폴리라인 렌더링
  useEffect(() => {
    if (!mapInstance) return;
    const kakao = window.kakao?.maps;
    if (!kakao) return;

    // 기존 폴리라인 제거
    polylinesRef.current.forEach((pl) => pl.setMap(null));
    polylinesRef.current = [];

    if (!activeLegs || activeLegs.length === 0) return;

    // 흰 테두리 + 색상 폴리라인 쌍 생성 (호버 반응 포함)
    const makePair = (path: any[], color: string, weight: number, style: any, opacity: number) => {
      const base = new kakao.Polyline({
        map: mapInstance, path,
        strokeWeight: weight + 4, strokeColor: '#ffffff',
        strokeOpacity: opacity * 0.55, strokeStyle: 'solid', zIndex: 1,
      });
      const overlay = new kakao.Polyline({
        map: mapInstance, path,
        strokeWeight: weight, strokeColor: color,
        strokeOpacity: opacity, strokeStyle: style, zIndex: 2,
      });
      const onOver = () => { base.setOptions({ strokeWeight: weight + 7 }); overlay.setOptions({ strokeWeight: weight + 3 }); };
      const onOut  = () => { base.setOptions({ strokeWeight: weight + 4 }); overlay.setOptions({ strokeWeight: weight }); };
      kakao.event.addListener(base,    'mouseover', onOver);
      kakao.event.addListener(base,    'mouseout',  onOut);
      kakao.event.addListener(overlay, 'mouseover', onOver);
      kakao.event.addListener(overlay, 'mouseout',  onOut);
      polylinesRef.current.push(base, overlay);
    };

    for (const leg of activeLegs) {
      if (leg.coords.length < 2) continue;

      if (leg.mode === 'walk' && leg.slopeSegments && leg.slopeSegments.length > 0) {
        const profile = leg.elevationProfile ?? leg.coords.map((c) => ({ ...c, elevation: 0 }));
        const segs = leg.slopeSegments;
        for (let i = 0; i < segs.length; i++) {
          if (i + 1 >= profile.length) break;
          const path = [
            new kakao.LatLng(profile[i].lat, profile[i].lng),
            new kakao.LatLng(profile[i + 1].lat, profile[i + 1].lng),
          ];
          makePair(path, slopeColor(segs[i]), 5, 'solid', 0.85);
        }
      } else {
        const color = leg.mode === 'subway'
          ? getSubwayColour(leg)
          : leg.mode === 'bus' ? '#49B4DE' : '#3b82f6';
        const strokeStyle = leg.mode === 'walk' ? 'shortdot' : 'solid';
        const coords = leg.mode === 'subway' ? getSubwayCoords(leg) : leg.coords;
        const path = coords.map((c) => new kakao.LatLng(c.lat, c.lng));
        makePair(path, color, leg.mode === 'walk' ? 4 : 6, strokeStyle, 0.8);
      }
    }

    return () => {
      polylinesRef.current.forEach((pl) => pl.setMap(null));
      polylinesRef.current = [];
      setContextMenu(null);
    };
  }, [mapInstance, activeLegs, subwayLines]);

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
    <div
      ref={mapContainerRef}
      className="w-full h-full relative"
      onClick={() => setContextMenu(null)}
      onContextMenu={(e) => {
        e.preventDefault();
        if (activeLegs && activeLegs.length > 0) {
          setContextMenu({ x: e.clientX, y: e.clientY });
        }
      }}
    >
    {contextMenu && (
      <div
        style={{
          position: 'fixed',
          left: contextMenu.x,
          top: contextMenu.y,
          zIndex: 9999,
          background: 'rgba(255,255,255,0.97)',
          borderRadius: '10px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          border: '1px solid rgba(0,0,0,0.08)',
          overflow: 'hidden',
          minWidth: '140px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => { setContextMenu(null); onSaveRoute?.(); }}
          style={{
            display: 'block', width: '100%', padding: '10px 16px',
            textAlign: 'left', fontSize: '13px', fontWeight: 600,
            color: '#1a1a1a', background: 'transparent', cursor: 'pointer',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(73,180,222,0.1)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          경로 저장
        </button>
      </div>
    )}
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
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', opacity: selectedAttraction && !isSelected ? 0.25 : 1, transition: 'opacity 0.2s' }}
              >
                <div style={{
                  background: isSelected ? '#49B4DE' : '#f43f5e',
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
                  borderTop: `6px solid ${isSelected ? '#49B4DE' : '#f43f5e'}`,
                }} />
              </div>
            </CustomOverlayMap>
          );
        })
      }

      {/* 저장된 출발지 마커 */}
      {savedOrigins?.map((o) => (
        <CustomOverlayMap key={o.id} position={{ lat: o.lat, lng: o.lng }} yAnchor={0.85}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none', opacity: selectedAttraction ? 0.25 : 1, transition: 'opacity 0.2s' }}>
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
    </div>
  );
}
