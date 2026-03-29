'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import MapViewer from '@/components/MapViewer';
import SearchBar from '@/components/SearchBar';
import AttractionList from '@/components/AttractionList';
import ScorePanel from '@/components/ScorePanel';
import WeightSurvey from '@/components/WeightSurvey';
import { useWeights } from '@/hooks/useWeights';
import { useWeightPresets } from '@/hooks/useWeightPresets';
import { useFavorites } from '@/hooks/useFavorites';
import { useSavedOrigins } from '@/hooks/useSavedOrigins';
import LoginButton from '@/components/LoginButton';

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
    setScores({});
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedAttraction(null);
  }, []);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const handleCategoryChange = useCallback((cat: string | null) => {
    setSelectedCategory((prev) => (prev === cat ? null : cat));
  }, []);

  const [activeTab, setActiveTab] = useState<'attractions' | 'profile' | 'weights'>('attractions');
  const { weights, isCustom, saveWeights, resetWeights } = useWeights();
  const { presets, savePreset, renamePreset, deletePreset } = useWeightPresets();
  const [draftWeights, setDraftWeights] = useState<typeof weights | null>(null);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [editingPresetName, setEditingPresetName] = useState('');
  const displayWeights = draftWeights ?? weights;

  const handleSliderChange = useCallback((key: keyof typeof weights, value: number) => {
    setDraftWeights((prev) => {
      const base = prev ?? weights;
      const clamped = Math.min(0.95, Math.max(0.05, value));
      const remaining = 1 - clamped;
      const otherKeys = (Object.keys(base) as (keyof typeof weights)[]).filter((k) => k !== key);
      const otherSum = otherKeys.reduce((s, k) => s + base[k], 0);
      const next = { ...base, [key]: clamped };
      if (otherSum > 0) {
        otherKeys.forEach((k) => { next[k] = base[k] * (remaining / otherSum); });
      } else {
        otherKeys.forEach((k) => { next[k] = remaining / otherKeys.length; });
      }
      return next;
    });
  }, [weights]);
  const { favorites, isLoggedIn } = useFavorites();
  const { savedOrigins, remove: removeSavedOrigin, isLoggedIn: isLoggedInOrigins } = useSavedOrigins();
  const [showSurvey, setShowSurvey] = useState(false);

  // 동별 DB 점수 (출발지 동 변경 시 API 조회로 채워짐)
  const [scores, setScores] = useState<Record<string, number>>({});
  const [categoryOpen, setCategoryOpen] = useState(true);

  // 출발지 변경 시 동 점수 조회
  useEffect(() => {
    const dongKey = currentOrigin.dongKey;
    if (!dongKey) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
    fetch(`${apiUrl}/api/dong-scores?dong=${encodeURIComponent(dongKey)}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setScores(json.data);
      })
      .catch(() => {});
  }, [currentOrigin]);

  // 거리 기반 보조 정렬값 (출발지 변경 시 즉시 재계산, API 0건)
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
        onComplete={(newWeights, cr) => {
          saveWeights(newWeights, cr);
          setShowSurvey(false);
        }}
        onClose={() => setShowSurvey(false)}
      />
    )}
    <main className="w-full h-screen flex overflow-hidden">
      <aside
        className="h-screen flex shrink-0"
        style={{ width: 'var(--sidebar-width)', borderRight: '1px solid var(--sidebar-border)' }}
      >
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
            { id: 'attractions', icon: '🗺', label: '관광지' },
            { id: 'profile',     icon: '👤', label: '내 정보' },
            { id: 'weights',     icon: '⚙️', label: '가중치' },
          ] as const).map(({ id, icon, label }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className="w-12 h-12 flex flex-col items-center justify-center rounded-xl gap-1 transition-all"
                style={{
                  background: isActive ? 'rgba(59,130,246,0.15)' : 'transparent',
                  border: isActive ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
                }}
              >
                <span className="text-lg leading-none">{icon}</span>
                <span className="text-[10px] leading-none" style={{ color: isActive ? 'var(--accent-light)' : 'var(--sidebar-text-muted)' }}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>

        {/* 오른쪽 콘텐츠 */}
        <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--sidebar-bg)' }}>

          {/* 관광지 탭 */}
          {activeTab === 'attractions' && <>
            <SearchBar
              searchQuery={searchQuery}
              onSearch={handleSearch}
              currentOrigin={currentOrigin}
              onOriginChange={handleOriginChange}
              attractions={attractions}
              onSelectAttraction={handleSelectAttraction}
            />
            <div className="flex-1 overflow-hidden">
              {selectedAttraction ? (
                <ScorePanel
                  attraction={selectedAttraction}
                  origin={currentOrigin}
                  onClose={handleClosePanel}
                  weights={weights}
                  dongKey={currentOrigin.dongKey}
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
                />
              )}
            </div>
            <div
              className="px-4 py-3 shrink-0 text-[10px] flex items-center justify-between"
              style={{ borderTop: '1px solid var(--sidebar-border)', color: 'var(--sidebar-text-muted)' }}
            >
              <span>총 {filteredAttractions.length}개 관광지</span>
              <span>출발: {currentOrigin.name}</span>
            </div>
          </>}

          {/* 내 정보 탭 */}
          {activeTab === 'profile' && (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="px-4 py-4 shrink-0" style={{ borderBottom: '1px solid var(--sidebar-border)' }}>
                <p className="text-white font-bold text-sm mb-3">내 정보</p>
                <LoginButton />
              </div>
              {!isLoggedIn && (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-[12px]" style={{ color: 'var(--sidebar-text-muted)' }}>로그인 후 이용 가능합니다</p>
                </div>
              )}
              {isLoggedIn && (
                <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4">

                  {/* 즐겨찾기 관광지 */}
                  <p className="text-[11px] font-semibold mb-2" style={{ color: 'var(--sidebar-text-muted)' }}>
                    즐겨찾기 ({favorites.size}개)
                  </p>
                  {favorites.size === 0 ? (
                    <p className="text-[11px] mb-4" style={{ color: 'var(--sidebar-text-muted)' }}>
                      하트를 눌러 관광지를 저장해보세요
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2 mb-5">
                      {attractions
                        .filter((a) => favorites.has(a.id))
                        .map((a) => (
                          <div
                            key={a.id}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all"
                            style={{ background: 'var(--sidebar-surface)' }}
                            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.8'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                            onClick={() => { handleSelectAttraction(a); setActiveTab('attractions'); }}
                          >
                            <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-gray-800">
                              {a.imageUrl ? (
                                <img src={a.imageUrl} alt={a.name} className="w-full h-full object-cover" loading="lazy" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">📍</div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] font-semibold truncate" style={{ color: 'var(--sidebar-text)' }}>{a.name}</p>
                              {a.category && (
                                <p className="text-[10px] mt-0.5" style={{ color: 'var(--sidebar-text-muted)' }}>{a.category}</p>
                              )}
                            </div>
                            <span className="text-[11px]" style={{ color: '#f43f5e' }}>♥</span>
                          </div>
                        ))}
                    </div>
                  )}

                  {/* 구분선 */}
                  <div style={{ borderTop: '1px solid var(--sidebar-border)', marginBottom: '16px' }} />

                  {/* 저장된 출발지 */}
                  <p className="text-[11px] font-semibold mb-2" style={{ color: 'var(--sidebar-text-muted)' }}>
                    저장된 출발지 ({savedOrigins.length}개)
                  </p>
                  {savedOrigins.length === 0 ? (
                    <p className="text-[11px]" style={{ color: 'var(--sidebar-text-muted)' }}>저장된 출발지가 없습니다</p>
                  ) : (
                    savedOrigins.map((o) => (
                      <div
                        key={o.id}
                        className="flex items-center justify-between px-3 py-2 rounded-lg mb-1 text-[12px]"
                        style={{ background: 'var(--sidebar-surface)', color: 'var(--sidebar-text)' }}
                      >
                        <span className="truncate flex-1">📍 {o.name}</span>
                        <button
                          onClick={() => removeSavedOrigin(o.id)}
                          className="ml-2 text-[10px] shrink-0"
                          style={{ color: 'rgba(255,255,255,0.3)' }}
                        >✕</button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* 가중치 탭 */}
          {activeTab === 'weights' && (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="px-4 py-4 shrink-0" style={{ borderBottom: '1px solid var(--sidebar-border)' }}>
                <p className="text-white font-bold text-sm">가중치 설정</p>
                <p className="text-[11px] mt-1" style={{ color: 'var(--sidebar-text-muted)' }}>
                  {draftWeights ? '수정 중 — 저장 버튼을 눌러 적용' : isCustom ? '맞춤 가중치 적용 중' : '기본 가중치 사용 중'}
                </p>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4">
                {([
                  { label: '이동시간', key: 'time',     color: '#6366f1' },
                  { label: '환승',    key: 'transfer', color: '#0ea5e9' },
                  { label: '도보',    key: 'walk',     color: '#22c55e' },
                  { label: '대기',    key: 'wait',     color: '#f59e0b' },
                  { label: '접근성',  key: 'access',   color: '#ec4899' },
                ] as const).map(({ label, key, color }) => (
                  <div key={key} className="mb-5">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[12px] font-medium" style={{ color: 'var(--sidebar-text)' }}>{label}</span>
                      <span className="text-[13px] font-bold" style={{ color }}>{Math.round(displayWeights[key] * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={95}
                      step={1}
                      value={Math.round(displayWeights[key] * 100)}
                      onChange={(e) => handleSliderChange(key, Number(e.target.value) / 100)}
                      className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                      style={{
                        accentColor: color,
                        background: `linear-gradient(to right, ${color} ${Math.round(displayWeights[key] * 100)}%, var(--sidebar-surface) ${Math.round(displayWeights[key] * 100)}%)`,
                      }}
                    />
                  </div>
                ))}

                <div className="flex gap-2 mt-2">
                  {draftWeights && (
                    <button
                      onClick={() => { saveWeights(draftWeights, 0); setDraftWeights(null); }}
                      className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold transition-all"
                      style={{ background: 'var(--accent)', color: '#fff' }}
                    >
                      저장
                    </button>
                  )}
                  {draftWeights && (
                    <button
                      onClick={() => setDraftWeights(null)}
                      className="py-2.5 px-3 rounded-xl text-[12px] transition-all"
                      style={{ background: 'var(--sidebar-surface)', color: 'var(--sidebar-text-muted)' }}
                    >
                      취소
                    </button>
                  )}
                </div>

                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => setShowSurvey(true)}
                    className="flex-1 py-2 rounded-xl text-[12px] font-medium transition-all"
                    style={{ background: 'var(--sidebar-surface)', color: 'var(--sidebar-text-muted)' }}
                  >
                    AHP 설문으로 설정
                  </button>
                  {isCustom && (
                    <button
                      onClick={() => { resetWeights(); setDraftWeights(null); }}
                      className="py-2 px-3 rounded-xl text-[12px] transition-all"
                      style={{ background: 'var(--sidebar-surface)', color: 'var(--sidebar-text-muted)' }}
                    >
                      초기화
                    </button>
                  )}
                </div>

                {/* 프리셋 저장 */}
                <div className="mt-6" style={{ borderTop: '1px solid var(--sidebar-border)', paddingTop: '16px' }}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[12px] font-semibold" style={{ color: 'var(--sidebar-text)' }}>저장된 가중치</p>
                    <button
                      onClick={() => {
                        const name = `내 설정 ${presets.length + 1}`;
                        savePreset(name, displayWeights);
                      }}
                      className="text-[11px] px-2.5 py-1 rounded-lg font-medium transition-all"
                      style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc' }}
                    >
                      + 현재 설정 저장
                    </button>
                  </div>

                  {presets.length === 0 ? (
                    <p className="text-[11px] text-center py-4" style={{ color: 'var(--sidebar-text-muted)' }}>
                      저장된 가중치가 없습니다
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {presets.map((preset) => (
                        <div
                          key={preset.id}
                          className="rounded-xl px-3 py-2.5"
                          style={{ background: 'var(--sidebar-surface)' }}
                        >
                          {/* 이름 (클릭 시 편집) */}
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
                              className="w-full text-[12px] font-semibold bg-transparent outline-none border-b pb-0.5"
                              style={{ color: 'var(--sidebar-text)', borderColor: 'var(--accent)' }}
                            />
                          ) : (
                            <div className="flex items-center justify-between gap-2">
                              <button
                                className="text-[12px] font-semibold truncate text-left flex-1"
                                style={{ color: 'var(--sidebar-text)' }}
                                onClick={() => { setEditingPresetId(preset.id); setEditingPresetName(preset.name); }}
                                title="클릭하여 이름 변경"
                              >
                                ✏️ {preset.name}
                              </button>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => { saveWeights(preset.weights, 0); setDraftWeights(null); }}
                                  className="text-[10px] px-2 py-0.5 rounded-lg font-medium"
                                  style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc' }}
                                >
                                  적용
                                </button>
                                <button
                                  onClick={() => deletePreset(preset.id)}
                                  className="text-[11px] w-5 h-5 flex items-center justify-center rounded"
                                  style={{ color: 'rgba(255,255,255,0.25)' }}
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          )}

                          {/* 미니 바 미리보기 */}
                          <div className="flex gap-1 mt-2">
                            {([
                              { key: 'time',     color: '#6366f1' },
                              { key: 'transfer', color: '#0ea5e9' },
                              { key: 'walk',     color: '#22c55e' },
                              { key: 'wait',     color: '#f59e0b' },
                              { key: 'access',   color: '#ec4899' },
                            ] as const).map(({ key, color }) => (
                              <div
                                key={key}
                                className="h-1 rounded-full"
                                style={{ flex: preset.weights[key], background: color, minWidth: '2px' }}
                              />
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
      </aside>

      {/* 우측 지도 영역 */}
      <div className="flex-1 h-screen relative">
        {/* 카테고리 필터 플로팅 버튼 */}
        <div className="absolute top-4 left-4 z-[1000] flex items-center gap-2">
          {/* 접기/펼치기 토글 버튼 (항상 맨 왼쪽 고정) */}
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

          {/* 카테고리 버튼들 */}
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
        />
      </div>
    </main>
    </>
  );
}
