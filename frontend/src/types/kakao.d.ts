// 카카오맵 SDK 전역 타입 선언
interface Window {
  kakao: {
    maps: {
      load: (callback: () => void) => void;
      services: {
        Status: {
          OK: string;
          ZERO_RESULT: string;
          ERROR: string;
        };
        Geocoder: new () => {
          addressSearch: (address: string, callback: (result: any[], status: string) => void) => void;
          coord2Address: (lng: number, lat: number, callback: (result: any[], status: string) => void) => void;
        };
        Places: new () => {
          keywordSearch: (keyword: string, callback: (result: any[], status: string) => void) => void;
        };
      };
      [key: string]: any;
    };
  };
}
