import Script from 'next/script';
import MapViewer from '@/components/MapViewer';

export default function Home() {
  const kakaoJsKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY || '';

  return (
    <main className="w-full h-screen bg-gray-100 overflow-hidden relative">
      <Script 
        strategy="beforeInteractive"
        src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoJsKey}&libraries=services,clusterer&autoload=false`} 
      />
      
      {/* 백그라운드 전체 영역에 지도 렌더링 */}
      <div className="absolute inset-0 z-0">
        <MapViewer />
      </div>

      {/* 테스트용 UI 헤더 (지도를 가리지 않도록 Absolute 배치) */}
      <div className="absolute top-0 right-0 p-4 z-10 pointer-events-none">
        <div className="bg-black/80 backdrop-blur-md px-6 py-3 rounded-full shadow-lg flex items-center gap-3 pointer-events-auto">
          <h1 className="text-white font-bold tracking-wider">
            TransitScore <span className="text-blue-400 text-sm ml-2 font-normal">MVP</span>
          </h1>
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
        </div>
      </div>
    </main>
  );
}
