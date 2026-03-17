'use client';

import { useEffect, useState } from 'react';
import { Map, MapMarker } from 'react-kakao-maps-sdk';
import axios from 'axios';

// 관광지 데이터 타입 정의
interface Attraction {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  imageUrl?: string;
  description?: string;
  accessScore?: number;
}

export default function MapViewer() {
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAttraction, setSelectedAttraction] = useState<Attraction | null>(null);
  const [scoreData, setScoreData] = useState<any>(null);
  const [loadingScore, setLoadingScore] = useState(false);

  // 자주 찾는 출발지 프리셋
  const originPresets = [
    { name: '부산역', lat: 35.1152, lng: 129.0422 },
    { name: '서면역', lat: 35.1584, lng: 129.0588 },
    { name: '해운대역', lat: 35.1631, lng: 129.1636 },
    { name: '김해공항', lat: 35.1764, lng: 128.9463 },
  ];

  // 선택된 출발지 상태 (기본값: 부산역)
  const [currentOrigin, setCurrentOrigin] = useState(originPresets[0]);

  // 마커 클릭 시 관광지 정보 세팅 및 점수 데이터 Fetch
  const handleMarkerClick = async (target: Attraction) => {
    setSelectedAttraction(target);
    setScoreData(null); // 이전 데이터 초기화
    setLoadingScore(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
      const response = await axios.get(`${apiUrl}/api/score/${target.id}`, {
        params: {
          originLat: currentOrigin.lat,
          originLng: currentOrigin.lng,
          destLat: target.lat,
          destLng: target.lng
        }
      });

      if (response.data.success) {
        setScoreData(response.data.data.scoreDetails);
      }
    } catch (error) {
      console.error('Failed to fetch score data:', error);
    } finally {
      setLoadingScore(false);
    }
  };

  // 컴포넌트 마운트 시 백엔드 API 호출
  useEffect(() => {
    const fetchAttractions = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
        const response = await axios.get(`${apiUrl}/api/attractions`);
        if (response.data.success) {
          setAttractions(response.data.data);
        }
      } catch (error) {
        console.error('Failed to fetch attractions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAttractions();
  }, []);

  if (loading) {
    return <div className="w-full h-screen flex items-center justify-center bg-gray-50">데이터를 불러오는 중입니다...</div>;
  }

  // 기본 중심 좌표 (부산역 부근)
  const defaultCenter = { lat: 35.1152, lng: 129.0422 };
  
  // 데이터가 있으면 첫 번째 데이터의 좌표를 임시 중심으로 설정
  const center = attractions.length > 0 ? { lat: attractions[0].lat, lng: attractions[0].lng } : defaultCenter;

  return (
    <div className="relative w-full h-screen">
      <Map
        center={center}
        style={{ width: '100%', height: '100vh' }}
        level={7} // 확대 레벨 (클수록 넓은 지역)
      >
        {attractions.map((target) => (
          <MapMarker
            key={target.id}
            position={{ lat: target.lat, lng: target.lng }}
            onClick={() => handleMarkerClick(target)}
            title={target.name}
          />
        ))}
      </Map>

      {/* 출발지 선택 패널 추가 */}
      <div className="absolute top-20 right-4 z-10 bg-white/90 backdrop-blur-md p-4 rounded-xl shadow-lg border border-gray-100">
        <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
          <span>🚩</span> 출발지 설정
        </h3>
        <div className="flex flex-col gap-2">
          {originPresets.map((preset) => (
            <button
              key={preset.name}
              onClick={() => {
                setCurrentOrigin(preset);
                setScoreData(null); // 출발지가 바뀌면 기존 점수 초기화
                setSelectedAttraction(null); // 선택된 패널도 초기화 (옵션)
              }}
              className={`px-4 py-2 text-sm text-left rounded-lg transition-colors ${
                currentOrigin.name === preset.name
                  ? 'bg-blue-500 text-white font-semibold shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              • {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* 선택된 관광지 정보 표시 사이드바 */}
      {selectedAttraction && (
        <div className="absolute top-4 left-4 z-10 w-80 bg-white/90 backdrop-blur-md p-6 rounded-2xl shadow-xl flex flex-col gap-3">
          <div className="flex justify-between items-start">
            <h2 className="text-xl font-bold text-gray-800">{selectedAttraction.name}</h2>
            <button 
              onClick={() => setSelectedAttraction(null)}
              className="text-gray-400 hover:text-gray-600 font-bold"
            >
              ✕
            </button>
          </div>
          <p className="text-sm text-gray-500">{selectedAttraction.address}</p>
          <div className="w-full h-40 bg-gray-200 rounded-lg overflow-hidden mt-2">
            {selectedAttraction.imageUrl ? (
              <img src={selectedAttraction.imageUrl} alt={selectedAttraction.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">이미지 없음</div>
            )}
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              대중교통 접근성 <span className="text-xs text-blue-500 font-bold ml-1">(출발: {currentOrigin.name})</span>
            </h3>
            
            {loadingScore ? (
              <div className="flex items-center justify-center p-4">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : scoreData ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full transition-all duration-500" style={{ width: `${scoreData.finalScore}%` }}></div>
                  </div>
                  <span className="text-lg font-bold text-blue-600">{scoreData.finalScore}점</span>
                </div>
                {scoreData.rawParams?.isFallback && (
                  <div className="bg-orange-50 text-orange-600 text-[10px] px-2 py-1 rounded-md mb-1 border border-orange-100">
                    ⚠️ 일일 호출 한도 초과로 인해 <b>직선 경로 기반 임시 추정치</b>로 표시됩니다.
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-gray-500">
                  <div className="flex justify-between bg-gray-50 p-1.5 rounded">
                    <span>이동시간</span>
                    <span className="font-semibold">{scoreData.rawParams.totalTimeMin}분</span>
                  </div>
                  <div className="flex justify-between bg-gray-50 p-1.5 rounded">
                    <span>환승</span>
                    <span className="font-semibold">{scoreData.rawParams.transferCount}회</span>
                  </div>
                  <div className="flex justify-between bg-gray-50 p-1.5 rounded">
                    <span>도보</span>
                    <span className="font-semibold">{scoreData.rawParams.walkDistanceM}m</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-red-400 mt-2">경로 점수를 불러오지 못했습니다.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
