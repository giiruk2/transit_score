'use client';

import { useState, useCallback } from 'react';
import MapViewer from '@/components/MapViewer';
import SearchBar from '@/components/SearchBar';
import AttractionList from '@/components/AttractionList';
import ScorePanel from '@/components/ScorePanel';

// 관광지 데이터 타입
export interface Attraction {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  imageUrl?: string;
  description?: string;
}

// 기본 출발지 (부산역)
const defaultOrigin = { name: '부산역', lat: 35.1152, lng: 129.0422 };

export default function Home() {
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [filteredAttractions, setFilteredAttractions] = useState<Attraction[]>([]);
  const [selectedAttraction, setSelectedAttraction] = useState<Attraction | null>(null);
  const [currentOrigin, setCurrentOrigin] = useState(defaultOrigin);
  const [searchQuery, setSearchQuery] = useState('');

  const handleAttractionsLoaded = useCallback((data: Attraction[]) => {
    setAttractions(data);
    setFilteredAttractions(data);
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

  const handleOriginChange = useCallback((origin: { name: string; lat: number; lng: number }) => {
    setCurrentOrigin(origin);
    setSelectedAttraction(null);
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedAttraction(null);
  }, []);

  return (
    <main className="w-full h-screen flex overflow-hidden">
      <aside
        className="h-screen flex flex-col shrink-0"
        style={{
          width: 'var(--sidebar-width)',
          background: 'var(--sidebar-bg)',
          borderRight: '1px solid var(--sidebar-border)',
        }}
      >
        {/* 헤더 */}
        <div
          className="px-5 py-4 flex items-center justify-between shrink-0"
          style={{ borderBottom: '1px solid var(--sidebar-border)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
              style={{ background: 'var(--accent)' }}>
              T
            </div>
            <div>
              <h1 className="text-white font-bold text-base tracking-wide">TransitScore</h1>
              <p className="text-[11px]" style={{ color: 'var(--sidebar-text-muted)' }}>
                부산 대중교통 접근성 분석
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-[10px]" style={{ color: 'var(--sidebar-text-muted)' }}>LIVE</span>
          </div>
        </div>

        {/* 검색바 + 출발지 */}
        <SearchBar
          searchQuery={searchQuery}
          onSearch={handleSearch}
          currentOrigin={currentOrigin}
          onOriginChange={handleOriginChange}
        />

        {/* 관광지 리스트 또는 상세 패널 */}
        <div className="flex-1 overflow-hidden">
          {selectedAttraction ? (
            <ScorePanel
              attraction={selectedAttraction}
              origin={currentOrigin}
              onClose={handleClosePanel}
            />
          ) : (
            <AttractionList
              attractions={filteredAttractions}
              onSelect={handleSelectAttraction}
              searchQuery={searchQuery}
            />
          )}
        </div>

        {/* 하단 정보 */}
        <div
          className="px-5 py-3 shrink-0 text-[10px] flex items-center justify-between"
          style={{
            borderTop: '1px solid var(--sidebar-border)',
            color: 'var(--sidebar-text-muted)',
          }}
        >
          <span>총 {filteredAttractions.length}개 관광지</span>
          <span>출발: {currentOrigin.name}</span>
        </div>
      </aside>

      {/* 우측 지도 영역 */}
      <div className="flex-1 h-screen relative">
        <MapViewer
          selectedAttraction={selectedAttraction}
          onMarkerClick={handleSelectAttraction}
          onAttractionsLoaded={handleAttractionsLoaded}
          currentOrigin={currentOrigin}
          onOriginChange={handleOriginChange}
        />
      </div>
    </main>
  );
}
