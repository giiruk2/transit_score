import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// .env 파일 로드 (src/scripts 위치 기준 상위 상위 디렉토리)
dotenv.config({ path: path.join(__dirname, '../../.env') });

const fetchAttractions = async () => {
  try {
    const serviceKey = process.env.PUBLIC_DATA_API_KEY;
    if (!serviceKey) {
      throw new Error("환경변수에 PUBLIC_DATA_API_KEY가 설정되지 않았습니다.");
    }

    console.log("🚀 부산 관광명소 OpenAPI 데이터 수집을 시작합니다...");
    console.log("사용 키:", serviceKey.substring(0, 10) + "...");

    // 부산 관광명소 API 엔드포인트 URL
    // (페이지당 100개씩 조회하여 JSON 형태로 반환 요청)
    const url = `http://apis.data.go.kr/6260000/AttractionService/getAttractionKr?serviceKey=${serviceKey}&pageNo=1&numOfRows=100&resultType=json`;

    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP 연결 에러! 상태 코드: ${response.status}`);
    }

    const data = await response.json();
    
    // 수집된 데이터를 저장할 폴더 생성
    const outDir = path.join(__dirname, '../../data');
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    // 파일로 저장
    const filePath = path.join(outDir, 'busan_attractions_raw.json');
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');

    console.log(`✅ 데이터 수집 완료! 파일 저장 위치: ${filePath}`);

    // 응답 구조 파악 후 갯수 출력
    if (data?.getAttractionKr?.item) {
      const items = data.getAttractionKr.item;
      console.log(`총 ${items.length}개의 관광지 데이터를 성공적으로 수집했습니다!`);
      
      // 첫 1개 샘플만 콘솔에 살짝 찍어보기
      if (items.length > 0) {
         console.log("\n[샘플 데이터 1건]");
         console.log(`이름: ${items[0].MAIN_TITLE}`);
         console.log(`주소: ${items[0].ADDR1}`);
         console.log(`좌표: (lat: ${items[0].LAT}, lng: ${items[0].LNG})`);
      }
    } else {
      console.log("⚠️ 예상된 'getAttractionKr.item' 구조가 응답에 없습니다. 파일에서 원본 응답을 확인하세요.");
      console.log("응답 요약:", JSON.stringify(data).substring(0, 200));
    }

  } catch (error) {
    console.error("❌ 데이터 수집 중 에러 발생:", error);
  }
};

fetchAttractions();
