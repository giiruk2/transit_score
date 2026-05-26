'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import MapViewer from '@/components/MapViewer';
import SearchBar from '@/components/SearchBar';
import AttractionList from '@/components/AttractionList';
import ScorePanel from '@/components/ScorePanel';
import WeightSurvey from '@/components/WeightSurvey';
import { useWeights, GttCoefficients } from '@/hooks/useWeights';
import { useWeightPresets } from '@/hooks/useWeightPresets';
import { useFavorites } from '@/hooks/useFavorites';
import { useSavedOrigins } from '@/hooks/useSavedOrigins';
import { useSavedRoutes } from '@/hooks/useSavedRoutes';
import LoginButton from '@/components/LoginButton';
import OriginPanel from '@/components/OriginPanel';
import { signInWithGoogle } from '@/lib/auth';
import { IconMap, IconRoute, IconUser, IconSettings, IconPin, IconPencil, IconSparkle, IconChevronLeft, IconChevronRight } from '@/components/icons';

// 관광지 데이터 타입
export interface Attraction {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  imageUrl?: string;
  description?: string;
  category?: string;
}

// 동 캐시에서 받는 MK3 시간 컴포넌트
interface DongComponents {
  tInvehicle: number;
  tWalk:      number;
  tWait:      number;
  nTransfer:  number;
  hasLowFloor: boolean;
}

// 기본 출발지 (부산역)
const defaultOrigin = { name: '부산역', lat: 35.1152, lng: 129.0422, dongKey: '동구 초량동' };

// 관광지 이름에서 언어 표기 제거 (한,영,중간,중번,일)
function cleanName(name: string): string {
  return name.replace(/\s*[\(\（][한영중일번,\s간]+[\)\）]/g, '').trim();
}

// 하버사인 직선 거리 계산 (km)
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function Home() {
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [filteredAttractions, setFilteredAttractions] = useState<Attraction[]>([]);
  const [selectedAttraction, setSelectedAttraction] = useState<Attraction | null>(null);
  const [currentOrigin, setCurrentOrigin] = useState<{ name: string; lat: number; lng: number; dongKey?: string }>(defaultOrigin);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeLegs, setActiveLegs] = useState<import('@/components/MapViewer').RouteLeg[]>([]);

  const handleAttractionsLoaded = useCallback((data: Attraction[]) => {
    const cleaned = data.map((a) => ({ ...a, name: cleanName(a.name) }));
    setAttractions(cleaned);
    setFilteredAttractions(cleaned);
  }, []);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setFilteredAttractions(attractions);
      return;
    }
    const lower = query.toLowerCase();
    setFilteredAttractions(
      attractions.filter(
        (a) => a.name.toLowerCase().includes(lower) || a.address.toLowerCase().includes(lower)
      )
    );
  }, [attractions]);

  const handleSelectAttraction = useCallback((attraction: Attraction) => {
    setSelectedAttraction(attraction);
  }, []);

  const handleOriginChange = useCallback((origin: { name: string; lat: number; lng: number; dongKey?: string }) => {
    setCurrentOrigin(origin);
    setSelectedAttraction(null);
    setActiveLegs([]);
    setSubScores({});
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedAttraction(null);
    setActiveLegs([]);
  }, []);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const handleCategoryChange = useCallback((cat: string | null) => {
    setSelectedCategory((prev) => (prev === cat ? null : cat));
  }, []);

  const [activeTab, setActiveTab] = useState<'attractions' | 'routes' | 'profile' | 'weights'>('attractions');
  const { coefficients, isCustom, saveCoefficients, resetCoefficients } = useWeights();
  const { presets, savePreset, renamePreset, deletePreset, isLoggedIn: isLoggedInPresets } = useWeightPresets();
  const [draftCoefficients, setDraftCoefficients] = useState<GttCoefficients | null>(null);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [editingPresetName, setEditingPresetName] = useState('');
  const displayCoefficients = draftCoefficients ?? coefficients;

  // 계수 슬라이더 변경 (α/β/γ/tMax 독립 변경)
  const handleCoefficientChange = useCallback((key: keyof GttCoefficients, value: number) => {
    setDraftCoefficients((prev) => ({ ...(prev ?? coefficients), [key]: value }));
  }, [coefficients]);

  const { favorites, toggle: toggleFavorite, isLoggedIn } = useFavorites();
  const { savedOrigins, remove: removeSavedOrigin, isLoggedIn: isLoggedInOrigins } = useSavedOrigins();
  const { savedRoutes, save: saveRoute, rename: renameRoute, remove: removeRoute, isLoggedIn: isLoggedInRoutes } = useSavedRoutes();
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [editingRouteName, setEditingRouteName] = useState('');
  const [showSurvey, setShowSurvey] = useState(false);

  const handleSaveRoute = useCallback(async () => {
    if (!isLoggedInRoutes) {
      signInWithGoogle();
      return;
    }
    if (!selectedAttraction || activeLegs.length === 0) return;
    const name = `${currentOrigin.name} → ${selectedAttraction.name}`;
    await saveRoute({
      name,
      originName: currentOrigin.name,
      originLat: currentOrigin.lat,
      originLng: currentOrigin.lng,
      attractionId: selectedAttraction.id,
      attractionName: selectedAttraction.name,
      attractionLat: selectedAttraction.lat,
      attractionLng: selectedAttraction.lng,
      legs: activeLegs,
      totalTimeMin: 0,
    });
    setActiveTab('routes');
  }, [isLoggedInRoutes, selectedAttraction, activeLegs, currentOrigin, saveRoute]);

  // 동별 DB 시간 컴포넌트 (출발지 동 변경 시 API 조회로 채워짐)
  const [subScores, setSubScores] = useState<Record<string, DongComponents>>({});
  const [categoryOpen, setCategoryOpen] = useState(true);
  const [dongCenters, setDongCenters] = useState<Record<string, { lat: number; lng: number }>>({});

  // 사이드바 접기 (localStorage로 상태 보존)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('sidebarCollapsed') === 'true') {
      setSidebarCollapsed(true);
    }
  }, []);
  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem('sidebarCollapsed', String(next)); } catch {}
      return next;
    });
  }, []);
  const handleTabClick = useCallback((id: 'attractions' | 'routes' | 'profile' | 'weights') => {
    setActiveTab(id);
    if (sidebarCollapsed) {
      setSidebarCollapsed(false);
      try { localStorage.setItem('sidebarCollapsed', 'false'); } catch {}
    }
  }, [sidebarCollapsed]);

  // dong_centers.json 로드
  useEffect(() => {
    fetch('/dong_centers.json')
      .then((r) => r.json())
      .then(setDongCenters)
      .catch(() => {});
  }, []);

  // lat/lng → 가장 가까운 동 중심 dongKey 찾기
  function resolveNearestDongKey(lat: number, lng: number): string | undefined {
    const entries = Object.entries(dongCenters);
    if (entries.length === 0) return undefined;
    let bestKey = '';
    let bestDist = Infinity;
    for (const [key, center] of entries) {
      const d = (center.lat - lat) ** 2 + (center.lng - lng) ** 2;
      if (d < bestDist) { bestDist = d; bestKey = key; }
    }
    return bestKey || undefined;
  }

  // 출발지 변경 시 가장 가까운 동 확정 후 점수 조회
  useEffect(() => {
    if (Object.keys(dongCenters).length === 0) return;
    const dongKey = resolveNearestDongKey(currentOrigin.lat, currentOrigin.lng);
    if (!dongKey) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
    fetch(`${apiUrl}/api/dong-scores?dong=${encodeURIComponent(dongKey)}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setSubScores(json.data);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrigin, dongCenters]);

  // GTT 계산 (계수 변경 시 즉시 재정렬, 낮을수록 좋음)
  const scores = useMemo<Record<string, number>>(() => {
    const result: Record<string, number> = {};
    Object.entries(subScores).forEach(([id, s]) => {
      result[id] = s.tInvehicle
        + coefficients.alpha * s.tWalk
        + coefficients.beta  * s.tWait
        + coefficients.gamma * s.nTransfer;
    });
    return result;
  }, [subScores, coefficients]);

  // 거리 기반 보조 정렬값 (출발지 변경 시 즉시 재계산)
  const distances = useMemo<Record<string, number>>(() => {
    const result: Record<string, number> = {};
    attractions.forEach((a) => {
      result[a.id] = haversineKm(currentOrigin.lat, currentOrigin.lng, a.lat, a.lng);
    });
    return result;
  }, [attractions, currentOrigin]);

  return (
    <>
    {showSurvey && (
      <WeightSurvey
        onComplete={(newCoefficients) => {
          saveCoefficients(newCoefficients);
          setShowSurvey(false);
        }}
        onClose={() => setShowSurvey(false)}
      />
    )}
    <main className="w-full h-screen flex overflow-hidden">
      <aside
        className="h-screen flex shrink-0 relative"
        style={{
          width: sidebarCollapsed ? '72px' : 'var(--sidebar-width)',
          borderRight: '1px solid var(--sidebar-border)',
          transition: 'width 220ms ease',
        }}
      >
        {/* 사이드바 접기/펴기 토글 — aside 오른쪽 가장자리에 floating */}
        <button
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? '사이드바 펴기' : '사이드바 접기'}
          title={sidebarCollapsed ? '사이드바 펴기' : '사이드바 접기'}
          className="absolute top-24 -right-3 w-6 h-6 rounded-full flex items-center justify-center transition-all hover:scale-110 z-20"
          style={{
            background: 'var(--panel-bg)',
            border: '1px solid var(--sidebar-border)',
            color: 'var(--accent)',
            boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
          }}
        >
          {sidebarCollapsed ? <IconChevronRight size={12} /> : <IconChevronLeft size={12} />}
        </button>
        {/* 왼쪽 탭 바 */}
        <div
          className="h-full flex flex-col items-center py-4 gap-1 shrink-0"
          style={{ width: '72px', background: 'var(--sidebar-bg)', borderRight: '1px solid var(--sidebar-border)' }}
        >
          {/* 로고 */}
          <div className="w-14 h-14 rounded-2xl overflow-hidden mb-5 shrink-0">
            <img src="/logo.png" alt="TransitScore" className="w-full h-full object-cover scale-150" />
          </div>

          {/* 탭 버튼 */}
          {([
            { id: 'attractions', Icon: IconMap,      label: '관광지' },
            { id: 'routes',      Icon: IconRoute,    label: '경로' },
            { id: 'profile',     Icon: IconUser,     label: '내 정보' },
            { id: 'weights',     Icon: IconSettings, label: '설정' },
          ] as const).map(({ id, Icon, label }) => {
            const isActive = activeTab === id && !sidebarCollapsed;
            return (
              <button
                key={id}
                onClick={() => handleTabClick(id)}
                className="w-12 h-12 flex flex-col items-center justify-center rounded-xl gap-1 transition-all"
                style={{
                  background: isActive ? 'rgba(59,130,246,0.15)' : 'transparent',
                  border: isActive ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
                  color: isActive ? 'var(--accent-light)' : 'var(--sidebar-text-muted)',
                }}
              >
                <Icon size={18} />
                <span className="text-[10px] leading-none">{label}</span>
              </button>
            );
          })}
        </div>

        {/* 오른쪽 콘텐츠 — collapse 시 부드럽게 잘려나가도록 외부 wrapper로 감쌈 */}
        <div className="flex-1 overflow-hidden">
        <div
          className="flex flex-col overflow-hidden h-full"
          style={{
            width: 'calc(var(--sidebar-width) - 72px)',
            background: 'var(--panel-bg)',
          }}
        >

          {/* 관광지 탭 */}
          {activeTab === 'attractions' && <>
            <SearchBar
              searchQuery={searchQuery}
              onSearch={handleSearch}
              attractions={attractions}
              onSelectAttraction={handleSelectAttraction}
            />
            <div className="flex-1 overflow-hidden">
              {selectedAttraction ? (
                <ScorePanel
                  attraction={selectedAttraction}
                  origin={currentOrigin}
                  onClose={handleClosePanel}
                  coefficients={coefficients}
                  dongKey={currentOrigin.dongKey}
                  favorites={favorites}
                  onToggleFavorite={toggleFavorite}
                  isLoggedIn={isLoggedIn}
                  onLegsChange={setActiveLegs}
                />
              ) : (
                <AttractionList
                  attractions={filteredAttractions}
                  onSelect={handleSelectAttraction}
                  searchQuery={searchQuery}
                  scores={scores}
                  distances={distances}
                  selectedCategory={selectedCategory}
                  onCategoryChange={handleCategoryChange}
                  favorites={favorites}
                  onToggleFavorite={toggleFavorite}
                  isLoggedIn={isLoggedIn}
                />
              )}
            </div>
            <div
              className="px-4 py-3 shrink-0 text-[10px] flex items-center justify-between"
              style={{ borderTop: '1px solid var(--panel-border)', color: 'var(--panel-text-muted)' }}
            >
              <span>총 {filteredAttractions.length}개 관광지</span>
              <span>출발: {currentOrigin.name}</span>
            </div>
          </>}

          {/* 경로 탭 */}
          {activeTab === 'routes' && (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="px-4 py-4 shrink-0" style={{ borderBottom: '1px solid var(--panel-border)' }}>
                <p className="font-bold text-sm" style={{ color: 'var(--panel-text)' }}>저장된 경로</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--panel-text-muted)' }}>폴리라인 우클릭 → 경로 저장</p>
              </div>
              {!isLoggedInRoutes ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6">
                  <p className="text-[12px] text-center" style={{ color: 'var(--panel-text-muted)' }}>로그인 후 경로를 저장할 수 있습니다</p>
                  <button
                    onClick={() => signInWithGoogle()}
                    className="px-4 py-2 rounded-xl text-[12px] font-semibold"
                    style={{ background: 'var(--accent)', color: '#fff' }}
                  >
                    로그인
                  </button>
                </div>
              ) : savedRoutes.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-[12px]" style={{ color: 'var(--panel-text-muted)' }}>저장된 경로가 없습니다</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-3 flex flex-col gap-2">
                  {savedRoutes.map((route) => (
                    <div
                      key={route.id}
                      className="rounded-xl px-3 py-2.5 cursor-pointer transition-all hover:opacity-80"
                      style={{ background: 'var(--panel-surface)' }}
                      onClick={() => {
                        const attraction = attractions.find((a) => a.id === route.attractionId);
                        if (attraction) {
                          setCurrentOrigin({ name: route.originName, lat: route.originLat, lng: route.originLng });
                          setSelectedAttraction(attraction);
                          setActiveLegs(route.legs);
                          setActiveTab('attractions');
                        }
                      }}
                    >
                      {editingRouteId === route.id ? (
                        <input
                          autoFocus
                          value={editingRouteName}
                          onChange={(e) => setEditingRouteName(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onBlur={() => { if (editingRouteName.trim()) renameRoute(route.id, editingRouteName.trim()); setEditingRouteId(null); }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { if (editingRouteName.trim()) renameRoute(route.id, editingRouteName.trim()); setEditingRouteId(null); }
                            if (e.key === 'Escape') setEditingRouteId(null);
                          }}
                          className="w-full text-[12px] font-semibold bg-transparent border-b pb-0.5"
                          style={{ color: 'var(--panel-text)', borderColor: 'var(--accent)' }}
                        />
                      ) : (
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-semibold truncate" style={{ color: 'var(--panel-text)' }}>{route.name}</p>
                            <p className="text-[10px] mt-0.5" style={{ color: 'var(--panel-text-muted)' }}>
                              {new Date(route.createdAt).toLocaleDateString('ko-KR')}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditingRouteId(route.id); setEditingRouteName(route.name); }}
                              className="text-[10px] px-2 py-0.5 rounded-lg"
                              style={{ background: 'rgba(73,180,222,0.15)', color: 'var(--accent)' }}
                            >
                              수정
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); removeRoute(route.id); }}
                              className="text-[11px] w-5 h-5 flex items-center justify-center rounded"
                              style={{ color: 'var(--panel-text-muted)' }}
                            >✕</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 내 정보 탭 */}
          {activeTab === 'profile' && (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="px-4 py-4 shrink-0" style={{ borderBottom: '1px solid var(--panel-border)' }}>
                <p className="font-bold text-sm mb-3" style={{ color: 'var(--panel-text)' }}>내 정보</p>
                <LoginButton />
              </div>
              {!isLoggedIn && (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-[12px]" style={{ color: 'var(--panel-text-muted)' }}>로그인 후 이용 가능합니다</p>
                </div>
              )}
              {isLoggedIn && (
                <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4">

                  {/* 즐겨찾기 관광지 */}
                  <p className="text-[11px] font-semibold mb-2" style={{ color: 'var(--panel-text-muted)' }}>
                    즐겨찾기 ({favorites.size}개)
                  </p>
                  {favorites.size === 0 ? (
                    <p className="text-[11px] mb-4" style={{ color: 'var(--panel-text-muted)' }}>
                      하트를 눌러 관광지를 저장해보세요
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2 mb-5">
                      {attractions
                        .filter((a) => favorites.has(a.id))
                        .map((a) => (
                          <div
                            key={a.id}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all hover:opacity-80"
                            style={{ background: 'var(--panel-surface)' }}
                            onClick={() => { handleSelectAttraction(a); setActiveTab('attractions'); }}
                          >
                            <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-gray-200">
                              {a.imageUrl ? (
                                <img src={a.imageUrl} alt={a.name} className="w-full h-full object-cover" loading="lazy" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400">
                                  <IconPin size={18} />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] font-semibold truncate" style={{ color: 'var(--panel-text)' }}>{a.name}</p>
                              {a.category && (
                                <p className="text-[10px] mt-0.5" style={{ color: 'var(--panel-text-muted)' }}>{a.category}</p>
                              )}
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleFavorite(a.id); }}
                              className="text-[15px] shrink-0 transition-transform hover:scale-125"
                              style={{ color: '#f43f5e' }}
                              title="즐겨찾기 해제"
                            >♥</button>
                          </div>
                        ))}
                    </div>
                  )}

                  {/* 구분선 */}
                  <div style={{ borderTop: '1px solid var(--panel-border)', marginBottom: '16px' }} />

                  {/* 저장된 출발지 */}
                  <p className="text-[11px] font-semibold mb-2" style={{ color: 'var(--panel-text-muted)' }}>
                    저장된 출발지 ({savedOrigins.length}개)
                  </p>
                  {savedOrigins.length === 0 ? (
                    <p className="text-[11px]" style={{ color: 'var(--panel-text-muted)' }}>저장된 출발지가 없습니다</p>
                  ) : (
                    savedOrigins.map((o) => (
                      <div
                        key={o.id}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg mb-1 text-[12px]"
                        style={{ background: 'var(--panel-surface)', color: 'var(--panel-text)' }}
                      >
                        <IconPin size={13} style={{ color: 'var(--accent)' }} />
                        <span className="truncate flex-1">{o.name}</span>
                        <button
                          onClick={() => removeSavedOrigin(o.id)}
                          className="ml-2 text-[10px] shrink-0"
                          style={{ color: 'var(--panel-text-muted)' }}
                        >✕</button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* 설정 탭 (가중치 → GTT 계수) */}
          {activeTab === 'weights' && (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="px-4 py-4 shrink-0" style={{ borderBottom: '1px solid var(--panel-border)' }}>
                <p className="font-bold text-sm" style={{ color: 'var(--panel-text)' }}>이동 조건 설정</p>
                <p className="text-[11px] mt-1" style={{ color: 'var(--panel-text-muted)' }}>
                  {draftCoefficients ? '수정 중 — 저장 버튼을 눌러 적용' : isCustom ? '맞춤 설정 적용 중' : '기본 설정 사용 중'}
                </p>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4">

                {/* α 슬라이더 */}
                {([
                  { label: '걷기 부담 (α)',    key: 'alpha' as const, min: 10, max: 25, step: 1, display: (v: number) => (v / 10).toFixed(1), parse: (v: number) => v / 10, color: '#22c55e', desc: '도보시간 가중치 (기본 2.0×)' },
                  { label: '기다림 부담 (β)',   key: 'beta'  as const, min: 10, max: 35, step: 1, display: (v: number) => (v / 10).toFixed(1), parse: (v: number) => v / 10, color: '#f59e0b', desc: '대기시간 가중치 (기본 2.5×)' },
                  { label: '환승 패널티 (γ분)', key: 'gamma' as const, min:  0, max: 20, step: 1, display: (v: number) => `${v}분`,            parse: (v: number) => v,       color: '#8b5cf6', desc: '환승당 가산 시간 (기본 13분)' },
                ] as const).map(({ label, key, min, max, step, display, parse, color, desc }) => {
                  const rawValue = key === 'alpha' ? Math.round(displayCoefficients.alpha * 10)
                    : key === 'beta' ? Math.round(displayCoefficients.beta * 10)
                    : displayCoefficients.gamma;
                  return (
                    <div key={key} className="mb-5">
                      <div className="flex justify-between items-center mb-1">
                        <div>
                          <span className="text-[12px] font-medium" style={{ color: 'var(--panel-text)' }}>{label}</span>
                        </div>
                        <span className="text-[13px] font-bold" style={{ color }}>{display(rawValue)}</span>
                      </div>
                      <p className="text-[10px] mb-1.5" style={{ color: 'var(--panel-text-muted)' }}>{desc}</p>
                      <input
                        type="range"
                        min={min}
                        max={max}
                        step={step}
                        value={rawValue}
                        onChange={(e) => handleCoefficientChange(key, parse(Number(e.target.value)))}
                        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                        style={{
                          accentColor: color,
                          background: `linear-gradient(to right, ${color} ${((rawValue - min) / (max - min)) * 100}%, var(--panel-border) ${((rawValue - min) / (max - min)) * 100}%)`,
                        }}
                      />
                    </div>
                  );
                })}

                {/* tMax 버튼 선택 */}
                <div className="mb-5">
                  <p className="text-[12px] font-medium mb-1" style={{ color: 'var(--panel-text)' }}>최대 이동시간</p>
                  <p className="text-[10px] mb-2" style={{ color: 'var(--panel-text-muted)' }}>실제 이동시간(탑승+도보+대기) 기준</p>
                  <div className="flex gap-2">
                    {([
                      { label: '제한없음', value: 0 },
                      { label: '30분', value: 30 },
                      { label: '60분', value: 60 },
                      { label: '90분', value: 90 },
                    ] as const).map(({ label, value }) => (
                      <button
                        key={value}
                        onClick={() => handleCoefficientChange('tMax', value)}
                        className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                        style={{
                          background: displayCoefficients.tMax === value ? 'var(--accent)' : 'var(--panel-surface)',
                          color: displayCoefficients.tMax === value ? '#fff' : 'var(--panel-text-muted)',
                          border: `1px solid ${displayCoefficients.tMax === value ? 'var(--accent)' : 'var(--panel-border)'}`,
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 mt-2">
                  {draftCoefficients && (
                    <button
                      onClick={() => { saveCoefficients(draftCoefficients); setDraftCoefficients(null); }}
                      className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold transition-all"
                      style={{ background: 'var(--accent)', color: '#fff' }}
                    >
                      저장
                    </button>
                  )}
                  {draftCoefficients && (
                    <button
                      onClick={() => setDraftCoefficients(null)}
                      className="py-2.5 px-3 rounded-xl text-[12px] transition-all"
                      style={{ background: 'var(--panel-surface)', color: 'var(--panel-text-muted)' }}
                    >
                      취소
                    </button>
                  )}
                </div>

                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => setShowSurvey(true)}
                    className="flex-1 py-3 rounded-xl text-[14px] font-bold transition-all hover:brightness-110 active:scale-95 flex items-center justify-center gap-2"
                    style={{
                      background: 'linear-gradient(135deg, #3450A7 0%, #49B4DE 100%)',
                      color: '#fff',
                      boxShadow: '0 0 16px rgba(73,180,222,0.5), 0 4px 12px rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.15)',
                    }}
                  >
                    <IconSparkle size={16} />
                    <span>내 취향 설정하기</span>
                  </button>
                  {isCustom && (
                    <button
                      onClick={() => { resetCoefficients(); setDraftCoefficients(null); }}
                      className="py-2 px-3 rounded-xl text-[12px] transition-all"
                      style={{ background: 'var(--panel-surface)', color: 'var(--panel-text-muted)' }}
                    >
                      초기화
                    </button>
                  )}
                </div>

                {/* 프리셋 저장 */}
                <div className="mt-6" style={{ borderTop: '1px solid var(--panel-border)', paddingTop: '16px' }}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[12px] font-semibold" style={{ color: 'var(--panel-text)' }}>저장된 설정</p>
                    {isLoggedInPresets ? (
                      <button
                        onClick={() => {
                          const name = `내 설정 ${presets.length + 1}`;
                          savePreset(name, displayCoefficients);
                        }}
                        className="text-[11px] px-2.5 py-1 rounded-lg font-medium transition-all"
                        style={{ background: 'rgba(73,180,222,0.2)', color: '#7ecfee' }}
                      >
                        + 현재 설정 저장
                      </button>
                    ) : (
                      <span className="text-[10px]" style={{ color: 'var(--panel-text-muted)' }}>로그인 필요</span>
                    )}
                  </div>

                  {!isLoggedInPresets ? (
                    <p className="text-[11px] text-center py-4" style={{ color: 'var(--panel-text-muted)' }}>
                      로그인 후 설정을 저장할 수 있습니다
                    </p>
                  ) : presets.length === 0 ? (
                    <p className="text-[11px] text-center py-4" style={{ color: 'var(--panel-text-muted)' }}>
                      저장된 설정이 없습니다
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {presets.map((preset) => (
                        <div
                          key={preset.id}
                          className="rounded-xl px-3 py-2.5"
                          style={{ background: 'var(--panel-surface)' }}
                        >
                          {editingPresetId === preset.id ? (
                            <input
                              autoFocus
                              value={editingPresetName}
                              onChange={(e) => setEditingPresetName(e.target.value)}
                              onBlur={() => {
                                if (editingPresetName.trim()) renamePreset(preset.id, editingPresetName.trim());
                                setEditingPresetId(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  if (editingPresetName.trim()) renamePreset(preset.id, editingPresetName.trim());
                                  setEditingPresetId(null);
                                }
                                if (e.key === 'Escape') setEditingPresetId(null);
                              }}
                              className="w-full text-[12px] font-semibold bg-transparent border-b pb-0.5"
                              style={{ color: 'var(--panel-text)', borderColor: 'var(--accent)' }}
                            />
                          ) : (
                            <div className="flex items-center justify-between gap-2">
                              <button
                                className="text-[12px] font-semibold truncate text-left flex-1 flex items-center gap-1.5"
                                style={{ color: 'var(--panel-text)' }}
                                onClick={() => { setEditingPresetId(preset.id); setEditingPresetName(preset.name); }}
                                title="클릭하여 이름 변경"
                              >
                                <IconPencil size={12} style={{ color: 'var(--panel-text-muted)' }} />
                                <span className="truncate">{preset.name}</span>
                              </button>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => { saveCoefficients(preset.weights); setDraftCoefficients(null); }}
                                  className="text-[10px] px-2 py-0.5 rounded-lg font-medium"
                                  style={{ background: 'rgba(73,180,222,0.2)', color: '#7ecfee' }}
                                >
                                  적용
                                </button>
                                <button
                                  onClick={() => deletePreset(preset.id)}
                                  className="text-[11px] w-5 h-5 flex items-center justify-center rounded"
                                  style={{ color: 'var(--panel-text-muted)' }}
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          )}

                          {/* 미니 바 (α/β/γ 시각화) */}
                          <div className="flex gap-2 mt-2">
                            {([
                              { key: 'alpha' as const, label: 'α', max: 2.5, color: '#22c55e' },
                              { key: 'beta'  as const, label: 'β', max: 3.5, color: '#f59e0b' },
                              { key: 'gamma' as const, label: 'γ', max: 20,  color: '#8b5cf6' },
                            ]).map(({ key, label, max, color }) => (
                              <div key={key} className="flex-1">
                                <div className="flex justify-between text-[9px] mb-0.5" style={{ color: 'var(--panel-text-muted)' }}>
                                  <span>{label}</span>
                                  <span>{preset.weights[key]}{key === 'gamma' ? '분' : '×'}</span>
                                </div>
                                <div className="h-1 rounded-full" style={{ background: 'var(--panel-border)' }}>
                                  <div
                                    className="h-1 rounded-full"
                                    style={{ width: `${Math.min(100, (preset.weights[key] / max) * 100)}%`, background: color }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
        </div>
      </aside>

      {/* 우측 지도 영역 */}
      <div className="flex-1 h-screen relative">
        {/* 출발지 플로팅 패널 */}
        <OriginPanel currentOrigin={currentOrigin} onOriginChange={handleOriginChange} />

        {/* 카테고리 필터 플로팅 버튼 */}
        <div className="absolute top-4 left-4 z-[1000] flex items-center gap-2">
          <button
            onClick={() => setCategoryOpen((v) => !v)}
            className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl text-[15px] font-bold shadow-lg transition-all"
            style={{
              background: 'rgba(255,255,255,0.15)',
              color: '#fff',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.2)',
              textShadow: '0 1px 4px rgba(0,0,0,0.6)',
            }}
          >
            {categoryOpen ? '‹' : '›'}
          </button>

          {categoryOpen && (
            <div className="flex flex-wrap gap-2">
              {([
                { key: '자연',     activeBg: 'rgba(34,197,94,0.9)',   dimBg: 'rgba(34,197,94,0.45)' },
                { key: '바다/해변', activeBg: 'rgba(14,165,233,0.9)', dimBg: 'rgba(14,165,233,0.45)' },
                { key: '역사/전통', activeBg: 'rgba(234,179,8,0.9)',  dimBg: 'rgba(234,179,8,0.45)' },
                { key: '문화/예술', activeBg: 'rgba(236,72,153,0.9)', dimBg: 'rgba(236,72,153,0.45)' },
                { key: '박물관',   activeBg: 'rgba(168,85,247,0.9)',  dimBg: 'rgba(168,85,247,0.45)' },
                { key: '종교',     activeBg: 'rgba(249,115,22,0.9)',  dimBg: 'rgba(249,115,22,0.45)' },
                { key: '공원/레저', activeBg: 'rgba(20,184,166,0.9)', dimBg: 'rgba(20,184,166,0.45)' },
              ] as const).map(({ key, activeBg, dimBg }) => {
                const isActive = selectedCategory === key;
                return (
                  <button
                    key={key}
                    onClick={() => handleCategoryChange(key)}
                    className="text-[15px] px-4 py-2 rounded-xl font-bold transition-all shadow-md"
                    style={{
                      background: isActive ? activeBg : dimBg,
                      color: '#fff',
                      border: isActive ? '1.5px solid rgba(255,255,255,0.6)' : '1.5px solid rgba(255,255,255,0.35)',
                      backdropFilter: 'blur(10px)',
                      textShadow: '0 1px 6px rgba(0,0,0,0.9)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                    }}
                  >
                    {key}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <MapViewer
          selectedAttraction={selectedAttraction}
          onMarkerClick={handleSelectAttraction}
          onAttractionsLoaded={handleAttractionsLoaded}
          currentOrigin={currentOrigin}
          onOriginChange={handleOriginChange}
          selectedCategory={selectedCategory}
          favorites={favorites}
          savedOrigins={savedOrigins}
          activeLegs={activeLegs}
          onSaveRoute={handleSaveRoute}
        />
      </div>
    </main>
    </>
  );
}
