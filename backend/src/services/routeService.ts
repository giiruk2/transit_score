import axios from 'axios';

// TMAP 경로 탐색 결과 인터페이스 (필요한 데이터만 추출)
export interface RouteResult {
  totalTimeMin: number;
  transferCount: number;
  walkDistanceM: number;
  waitTimeMin: number; // TMAP 응답에 없으면 기본 패널티 점수 부여
  success: boolean;
  message?: string;
  isFallback?: boolean; // TMAP 실패 시 자체 알고리즘으로 추정했는지 여부
}

// 하버사인 공식을 이용한 두 좌표 간 직선 거리 계산 (단위: km)
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // 지구 반지름 (km)
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  return R * c;
}

export const fetchOdsayRoute = async (
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<RouteResult> => {
  try {
    const odsayApiKey = process.env.ODSAY_API_KEY;
    if (!odsayApiKey) {
      throw new Error('ODSAY_API_KEY is not defined in .env');
    }

    // ODsay 대중교통 길찾기 API URL
    const url = 'https://api.odsay.com/v1/api/searchPubTransPathT';
    
    const response = await axios.get(url, {
      params: {
        SX: originLng, // 출발지 경도
        SY: originLat, // 출발지 위도
        EX: destLng,   // 도착지 경도
        EY: destLat,   // 도착지 위도
        apiKey: odsayApiKey
      },
      headers: {
        // ODsay 콘솔 Web 도메인에 등록된 정확한 URL 매칭
        'Origin': 'http://localhost:5001',
        'Referer': 'http://localhost:5001/'
      }
    });

    const data = response.data;
    
    // ODsay 응답 에러 처리
    if (data.error) {
       const errMsg = Array.isArray(data.error) ? data.error[0].message : (data.error.msg || '알 수 없는 에러');
       throw new Error(`ODsay API 에러: ${errMsg}`);
    }

    // ODsay 길찾기 결과 파싱 (첫 번째 최적 경로 기준)
    if (data && data.result && data.result.path && data.result.path.length > 0) {
      const bestPathInfo = data.result.path[0].info;
      
      return {
        success: true,
        isFallback: false,
        totalTimeMin: bestPathInfo.totalTime || 0, // 기본 분 단위 반환
        transferCount: (bestPathInfo.busTransitCount || 0) + (bestPathInfo.subwayTransitCount || 0) - 1 > 0 ? (bestPathInfo.busTransitCount || 0) + (bestPathInfo.subwayTransitCount || 0) - 1 : 0, 
        walkDistanceM: bestPathInfo.totalWalk || 0, // 기본 미터 단위 반환
        waitTimeMin: 5 // ODsay 무료 플랜에선 실시간 배차가 어려워 임의 고정값 5분 부여
      };
    } else {
      throw new Error("ODsay 응답에서 대중교통 수단 조회 결과를 찾을 수 없습니다.");
    }

  } catch (error: any) {
    console.error('ODsay 경로 호출 실패, 자체 추정 로직(Fallback) 가동:', error.response?.data || error.message);
    
    // [대체 로직] API 에러/만료 시 자체 직선 거리 기반 추정치 반환
    const distanceKm = getDistanceFromLatLonInKm(originLat, originLng, destLat, destLng);
    
    // 대중교통 평균 속도를 15km/h 로 가정하여 소요 시간(분) 계산
    const estimatedTimeMin = Math.max(5, Math.round((distanceKm / 15) * 60));
    const estimatedWalkM = Math.round(distanceKm * 1000 * 0.15); // 직선 거리의 15% 정도는 걷는다고 가정
    let estimatedTransfers = 0;
    if (distanceKm > 10) estimatedTransfers = 1;
    if (distanceKm > 20) estimatedTransfers = 2;

    return {
      success: true, // 임시로 성공 처리
      message: 'API 호출 실패: 자체 추정치로 계산되었습니다.',
      isFallback: true,
      totalTimeMin: estimatedTimeMin, 
      transferCount: estimatedTransfers, 
      walkDistanceM: estimatedWalkM, 
      waitTimeMin: 10 // 추정 대기시간 10분 패널티
    };
  }
};
