넵 주인님

# 부산 관광지 대중교통 접근성 점수화 웹서비스 MVP 연구 보고서

## Executive Summary

본 프로젝트의 핵심은 “부산 내 관광지(POI)를 **대중교통으로 얼마나 ‘편하게’ 갈 수 있는지**를 0~100점으로 수치화”하고, 이를 지도 기반 웹서비스로 보여주는 것입니다. (프로젝트 기획서 기준: 한 학기(약 4개월) 내 MVP 구현 목표) fileciteturn0file0

결론적으로, 4개월·학생팀(3~5명) MVP에서는 **정교한 교통 시뮬레이션(시각표/혼잡도/지연 예측)**보다, 다음 “가용 데이터로 안정적으로 계산 가능한 접근성”에 집중하는 편이 성공 확률이 높습니다.

- **접근성 점수(0~100)** = (대중교통 경로검색 결과 기반) **총 이동시간 + 환승 + 도보 + 대기/배차 + (가능하면) 무장애 요소**를 가중 합산해 정규화  
- **관광지 데이터**: 공공데이터포털의 부산 관광명소 API(좌표/주소/개요 등) + (보완용) 한국관광공사 TourAPI(전국 레벨 상세/이미지/카테고리) 조합이 현실적 citeturn3view0turn10view0turn10view1  
- **경로/시간 분석**: 한국 대중교통 길찾기는 “지도 사업자 기본 API만으로는 공백이 생길 가능성”이 있어서, **대중교통 경로탐색을 명시적으로 제공하는 API(예: TMAP 대중교통 API, ODsay)**를 백엔드에서 통합하는 전략을 권장 citeturn38search3turn38search16turn37search18  
- **지도 렌더링**: 지도 SDK는 (국내 UX/POI/지오코딩 편의까지 감안하면) **카카오맵/네이버 지도 중 하나**를 택하고, 검색/좌표변환은 카카오 로컬 API 같은 REST API를 보조로 쓰는 구성이 개발 속도에 유리 citeturn36search12turn36search15turn37search2turn37search14  

image_group{"layout":"carousel","aspect_ratio":"16:9","query":["Busan tourist attractions map Haeundae Gamcheon Taejongdae","Kakao Map API JavaScript example","Naver Maps JavaScript API v3 example web"],"num_per_query":1}

## 문제 정의와 MVP 범위

### 용어 정의

- **접근성 점수(Accessibility Score)**: 사용자가 지정한 출발 기준점(예: 부산역/숙소/현재위치)에서 특정 관광지까지 **대중교통 + 도보**로 이동할 때의 “부담”을 정량화한 점수(0~100). 점수가 높을수록 **더 빨리, 덜 걷고, 덜 갈아타고, 덜 기다리는** 경향을 의미합니다(본 보고서 제안 정의).  
- **MVP**: “핵심 가설 검증에 필요한 최소 기능”만 갖춘 초기 제품. 이 프로젝트에서는 (1) 관광지 목록/지도 표출, (2) 경로 기반 접근성 점수 산출, (3) 점수 기반 정렬/필터 정도가 MVP 최소 단위입니다. fileciteturn0file0

### MVP가 반드시 포함해야 하는 사용자 플로우

1. 사용자가 지도 또는 목록에서 관광지 탐색  
2. 출발 기준점(기본값 1~2개 프리셋 + 사용자 입력 1개 정도)을 선택  
3. 관광지 카드에서 “접근성 점수”와 **점수 분해(시간/환승/도보/대기 등)**를 확인  
4. 점수 높은 순으로 정렬 및 필터(예: 70점 이상, 환승 1회 이하)

### “한 학기 내 구현”을 위해 MVP에서 제외/추가 권장

- 제외(또는 “추가 기능”으로 후순위): 실시간 혼잡도(승하차/차내 혼잡), 정시성 예측, 계단/엘리베이터 실측 기반 최적 무장애 동선(데이터 난이도↑)  
- 추가 권장(체감가치↑, 구현난이도 중간): “시간대 선택(현재/주말/야간)”에 따른 점수 변화(운영시간·막차 반영은 2차)  

## 권장 기술스택과 비용·난이도 비교

아래는 “학생팀·4개월·MVP·지도 기반”을 기준으로, **학습곡선/개발속도/운영 부담**을 최소화하는 선택지입니다. (오픈소스 프레임워크는 라이선스 비용이 없으나, 배포/외부 API는 사용량에 따라 유료가 될 수 있어 ‘정책 확인’이 필요합니다.)

### 권장 스택(기본안)

- 프론트: Next.js(React) + TypeScript  
- 백엔드: Node.js(NestJS 또는 Express) **또는** Python(FastAPI)  
- DB: PostgreSQL(+PostGIS 권장: 좌표/거리 연산)  
- 캐시: Redis(경로 API 응답 캐싱에 효과적)  
- 배포: 프론트(Vercel 계열) + 백엔드(컨테이너 배포 가능한 저비용 PaaS) + DB(관리형 Postgres 또는 Supabase 계열)  
- CI/CD: GitHub Actions  
- 지도 렌더링: 카카오맵 또는 네이버 지도 JS SDK(둘 중 택1), 보조로 카카오 로컬 API(좌표/장소검색) citeturn36search12turn36search15turn37search2turn37search14  

### 기술스택 비교 표

| 구분 | 후보 | 선택 이유(요약) | 학습 난이도 | 개발 속도 | 비용(라이선스/호출) |
|---|---|---|---|---|---|
| 프론트엔드 | Next.js(React) | SPA+SSR 혼합, SEO/공유용 메타 처리 용이, 팀 협업(컴포넌트) 적합 | 중 | 빠름 | 오픈소스(무료) |
| 프론트엔드 | Vite+React | 단순·가벼움(SSR 필요 없으면 유리) | 하 | 빠름 | 오픈소스(무료) |
| 백엔드 | Node.js(Express/Nest) | 프론트와 언어 통일(TS), API 래핑/캐싱 구현 빠름 | 중 | 빠름 | 오픈소스(무료) |
| 백엔드 | Python(FastAPI) | 문서 자동화(Swagger), 데이터처리/배치 작업 구현 편함 | 중 | 빠름 | 오픈소스(무료) |
| DB | PostgreSQL(+PostGIS) | 좌표·거리·반경 검색/정렬이 1차 기능이므로 GIS에 강함 | 중 | 중 | 오픈소스(무료) |
| 캐시 | Redis | 경로탐색 API 비용/쿼터 방어에 가장 직접적 | 중 | 중 | 오픈소스(무료) |
| 지도 SDK | 카카오맵 JS | ‘지도 사용 설정’ 필요(2024-12-01~), 쿼터/유료정책 존재. 로컬 API 결합 용이 | 중 | 빠름 | 쿼터/유료정책(건당 과금 가능) citeturn36search15turn37search14 |
| 지도 SDK | 네이버 지도 JS v3 | Client ID 기반 인증, 설정 미흡 시 429(Quota Exceed) 가능 | 중 | 빠름 | 정책/한도는 NCP 쪽 확인 필요(문서상 quota 언급) citeturn36search12turn36search13 |
| 지도 렌더링(대안) | Leaflet/MapLibre | 지도 SDK 종속 줄임(단, 국내 POI/타일/정확도/약관 이슈는 별도 검토 필요) | 하~중 | 중 | 오픈소스(무료) |
| 경로/시간 | TMAP 대중교통 API | 대중교통 경로탐색을 명시 제공, 호출 URL/헤더/샘플이 문서에 명시 | 중 | 빠름 | SK 오픈API 상품 구매·AppKey 필요(요금은 상품/정책 확인) citeturn38search3turn38search6 |
| 경로/시간 | ODsay | 대중교통 길찾기/정류장·노선/역 시간표 등 광범위 기능, apiKey 기반 호출 예시 제공 | 중 | 빠름 | 요금/쿼터는 콘솔 기준(문서에서 apiKey 사용 확인) citeturn37search18turn38search16 |
| 경로/시간 | Google Directions | 과금형(빌링 필수), 분당 3,000 req 등 사용 제한/정책이 명확 | 중 | 중 | Pay-as-you-go(빌링 필요) citeturn36search0 |
| CI/CD | GitHub Actions | 단순·표준, 학생팀에 가장 보편적 | 하 | 빠름 | 무료/유료 플랜 정책은 GitHub 기준(여기서는 정책 수치 미기재) |
| 배포 | 컨테이너 PaaS + 관리형 DB | 운영 부담 최소화(학생팀), 장애 대응/스케일링 간단 | 중 | 빠름 | 무료/유료 혼재(정책 확인 필요) |

### 지도/경로 API 선택에 대한 현실적 코멘트

- **네이버 Directions 5**는 공식 문서에서 **자동차 길찾기**를 전제로 설계되고, 네이버 개발자 포럼에서도 대중교통 길찾기 제공이 “아직 없거나 제한적”임이 반복적으로 확인됩니다(즉, 대중교통 ‘경로탐색’을 네이버 단독으로 해결하기는 어려울 수 있음). citeturn0search3turn0search12turn0search18  
- 카카오의 경우, “지도 SDK + 로컬(Local) API”는 명확하지만, **웹에서 ‘대중교통 경로탐색’을 REST로 제공한다는 공식 문서 근거는 제한적**이어서, 대중교통 경로탐색은 TMAP/ODsay 같은 전용 API를 붙이는 구성이 안전합니다. citeturn37search2turn38search3turn38search16  

## OpenAPI·공공데이터 후보군

아래는 “학생팀이 사용하기 쉬운 순(우선순위 높음→낮음)”으로, 실제 활용 가능성이 큰 데이터/API를 묶어서 정리했습니다. “요청주소/샘플”은 공식 문서에 드러난 범위로만 기재하고, 문서가 Swagger UI 중심이라 텍스트로 확인이 어려운 항목은 **‘Swagger UI에서 확인’**로 표시했습니다.

### 관광 데이터 OpenAPI

| 우선순위 | 데이터/서비스 | 제공 데이터(요약) | 인증 방식 | 호출 제한/트래픽 | 비용 | 엔드포인트/문서 | 응답 예시(요약) |
|---|---|---|---|---|---|---|---|
| 높음 | 부산 관광명소(OpenAPI) | 부산 관광명소(명칭/주소/좌표/개요/이미지 등) | ServiceKey(query) | 개발계정 10,000 citeturn3view0 | 무료 citeturn2view3 | 서비스URL `http://apis.data.go.kr/6260000/AttractionService` / 호출 `.../getAttractionKr` citeturn2view3 | `response.header.resultCode`, `items.item[*].LAT/LNG/...` citeturn3view0 |
| 높음 | 한국관광공사 TourAPI(국문 관광정보) | 지역기반/위치기반/키워드검색/공통·소개·반복·이미지 등 “약 26만 건” 국문 관광정보 | ServiceKey(query) | 개발계정 1,000 citeturn10view0 | 무료 citeturn10view0 | 문서: data.go.kr(15101578) citeturn10view0 / 서비스 URL 변경: `KorService1→KorService2` citeturn10view1 | (기능별 응답은 Swagger/UI 중심. 핵심: 지역/좌표/콘텐츠ID 기반 조회) citeturn10view0 |
| 중간 | 관광지별 연관 관광지 정보 | 내비 데이터 기반 “연관 관광지” 랭킹/목록(차량 이동 기반이므로 해석 주의) | ServiceKey(query) | 개발계정 1,000 citeturn16view0 | 무료 citeturn16view0 | (서비스 URL 변경 공지) `TarRlteTarService→TarRlteTarService1`, op `/areaBasedList1`, `/searchKeyword1` citeturn22search2 | 연관관광지 코드/순위류 중심(세부는 Swagger/UI) citeturn22search2 |

### 버스/도시철도(정류장·노선·실시간) 데이터

| 우선순위 | 데이터/서비스 | 제공 데이터(요약) | 인증 방식 | 호출 제한/트래픽 | 비용 | 엔드포인트/문서 | 응답 예시(요약) |
|---|---|---|---|---|---|---|---|
| 높음 | 부산버스정보시스템(BIMS) OpenAPI | 정류소 조회(ARS/이름 검색 등), 노선/정류소 등(페이지 내 “정류소정보 조회” 확인) | ServiceKey(query) | 개발계정 10,000 citeturn2view3 | 무료 citeturn2view3 | 호출 `http://apis.data.go.kr/6260000/BusanBIMS/busStopList` citeturn2view3 | `items.item[*].bstopid`, `arsno`, `gpsx/gpsy`, `stoptype` citeturn2view3 |
| 중간 | 버스정보안내기(BIT) 설치 현황 | BIT 설치 정류장/좌표/설치연도 등(접근성 보조지표 가능) | ServiceKey(query) | 개발계정 10,000 citeturn33search1 | 무료 citeturn33search1 | 호출 `http://apis.data.go.kr/6260000/BusanTblBusinfoeqStusService/getTblBusinfoeqStusInfo` citeturn33search1 | `stationNum`, `stationLoc`, `lat/lng`, `insYear` citeturn33search1 |

### 도로교통/통행시간(선택적 활용)

아래 데이터는 “대중교통 접근성 점수”의 핵심이라기보다는 **버스 지연/도로혼잡 요인을 보정**하는 확장에 가깝습니다.

| 우선순위 | 데이터/서비스 | 제공 데이터(요약) | 인증 방식 | 호출 제한/트래픽 | 비용 | 엔드포인트/문서 | 비고 |
|---|---|---|---|---|---|---|---|
| 낮음(추가) | DSRC 구간 속도 | 도로 구간 평균 주행 속도 | (문서상 REST) | 개발계정 500 citeturn28view0 | 무료 citeturn28view0 | 문서 페이지에 요청주소가 텍스트로 노출되지 않음(“Swagger UI 기반” 안내) citeturn32view0 | MVP에서는 미사용 권장(복잡도↑) |
| 낮음(추가) | AVI 교통량 | AVI 지점/좌표/교통량 | (문서상 REST) | 개발계정 500 citeturn28view1 | 무료 citeturn28view1 | 동일(요청주소 텍스트 미노출) citeturn28view1 | 확장 단계에서 “정시성 페널티”에 활용 가능 |

### 지도 API(렌더링) 후보

| 우선순위 | 지도 SDK | 제공 기능(요약) | 인증/키 | 호출 제한/비용 단서 | 문서/근거 |
|---|---|---|---|---|---|
| 높음 | 카카오맵 | 웹/모바일 지도 SDK, 지도 API 사용 설정 필요 | 플랫폼 키(JS 키 등) citeturn36search15 | 월간/일간 쿼터 적용, 추가 쿼터 유료 가능. 월간 “전체 API 3,000,000건” 및 일부 일간 쿼터/유료단가(지도 0.1원/건 등) 문서화 citeturn36search15turn37search14 | citeturn36search15turn37search14 |
| 높음 | 네이버 지도 JS v3 | 지도 표시/오버레이/서브모듈 | Client ID/Secret, NCP 콘솔 등록 citeturn36search13 | 설정 미흡 시 429(Quota Exceed) 언급(즉, quota 존재) citeturn36search13 | citeturn36search12turn36search13 |

### 경로/이동시간 분석 API(대중교통 포함)

| 우선순위 | API | 제공 데이터(요약) | 인증 방식 | 호출 제한/비용 | 엔드포인트(예시) | 응답 예시(요약) |
|---|---|---|---|---|---|---|
| 높음 | TMAP 대중교통 API | 대중교통 경로탐색(출발/도착 좌표 기반), 에러코드/샘플 제공 | header `appKey` citeturn38search3 | 상품 구매·AppKey 발급 절차 안내 citeturn38search6turn38search3 | `https://apis.openapi.sk.com/transit/routes` citeturn38search3 | `metaData.requestParameters...`, 경로 후보(요약) citeturn38search3 |
| 높음 | ODsay 대중교통 | 대중교통 길찾기(및 정류장/노선/지하철 시간표 등) | query `apiKey=...` citeturn38search16 | 요금/쿼터는 콘솔/정책 기준(여기서는 호출 방식만 공식 근거 확보) citeturn38search16turn37search18 | 예: `https://api.odsay.com/v1/api/searchPubTransPathT?...&apiKey=...` citeturn38search16 | 대중교통 경로검색 결과 JSON(샘플 코드에 기반) citeturn38search16 |
| 중간 | Google Directions | 경로(기본/고급 SKU), 분당 3,000 req, 빌링/키 필수 | API key 또는 OAuth citeturn36search0 | Pay-as-you-go(빌링 필수) citeturn36search0 | (문서 기반. 프로젝트/키 설정 필요) citeturn36search0 | Waypoint/쿼터/요금 구조 안내 citeturn36search0 |

### 카카오 로컬 API(검색/지오코딩 보조)

“지도 렌더링”과는 별개로, **관광지/정류장 좌표 정규화, 검색 자동완성, 주소→좌표 변환**을 빠르게 구현할 때 유용합니다.

- 주소→좌표: `GET https://dapi.kakao.com/v2/local/search/address.{FORMAT}` (인증: REST API 키) citeturn37search2  
- 카테고리 검색: `GET https://dapi.kakao.com/v2/local/search/category.{FORMAT}` (인증: REST API 키) citeturn37search2  
- 쿼터: 카카오 전체 API 월간 3,000,000건, 로컬(카테고리/키워드 장소검색) 일간 100,000건, 유료단가(키워드/카테고리 2원/건 등) 명시 citeturn37search14  

## 접근성 점수 알고리즘 설계

### 목적과 전제

목적은 “관광지 간 비교가 가능한 단일 점수”입니다. 대중교통 접근성은 **시간 + 불편 요소(환승/도보/대기)**의 결합으로 체감되므로, 각 요소를 정규화한 뒤 가중합하는 방식이 MVP에 적합합니다(설명 가능한 점수). 경로탐색 결과는 TMAP 대중교통 API 또는 ODsay 등에서 확보하는 것을 기본 전제로 둡니다. citeturn38search3turn38search16turn37search18  

### 점수 구성요소와 데이터 소스 매핑

| 항목 | 의미 | 채우는 방법(권장 데이터 소스) | 불확실/대체 가정 |
|---|---|---|---|
| 총 이동시간 T (분) | 도보+차내+환승 포함 총 소요 | TMAP 대중교통 API 응답(총 소요/구간별) citeturn38search3 또는 ODsay 경로검색 결과 citeturn38search16 | API가 제공하는 값이 없으면 구간 합산(도보속도 4.5km/h 가정) |
| 환승수 N | 갈아탄 횟수 | 경로 API의 환승 정보(구간 타입 변화) citeturn38search3turn37search18 | 민감도 낮게(0~3 구간) |
| 도보거리 D (m) | 정류장/역 접근 및 환승 도보 합 | 경로 API의 도보 구간 거리/시간(없으면 좌표 거리 추정) citeturn38search3 | 좌표만 있으면 직선거리→보행거리 보정(×1.2~1.4 가정, MVP에서는 ×1.3 고정) |
| 대기/배차 W (분) | 초기/환승 대기 | 경로 API가 “대기”를 직접 주면 사용, 없으면 보수적으로 1구간당 5~8분 가정 | 실시간 도착 API가 충분히 확보되기 전까지는 “고정 대기 페널티”가 현실적 |
| 운영시간/막차 | 야간 접근성 | 2차(추가 기능): 관광지 운영시간은 TourAPI/관광명소 데이터에 존재하면 반영 citeturn10view0turn3view0 | MVP에서는 “주간(10~18시) 기준 점수”로 고정 |
| 무장애(계단/엘리베이터) | 휠체어/유모차 고려 | TourAPI의 무장애 정보(별도 서비스 존재 공지) citeturn10view1 | 데이터 부족 시 ‘중립(0.5)’ 처리 + 사용자에게 “정보 부족” 표시 |

### 정규화와 수식(제안)

점수는 0~100, 각 항목은 0~1로 정규화합니다.

- 시간 점수  
  \[
  s_{time}=\text{clamp}\left(1-\frac{T-T_{best}}{T_{worst}-T_{best}}, 0, 1\right)
  \]
  권장 기본값: \(T_{best}=20\), \(T_{worst}=120\) (MVP에서는 고정; 운영 중 재학습 가능)

- 환승 점수(설명가능한 계단형 페널티)  
  - \(N=0 \Rightarrow 1.00\)  
  - \(N=1 \Rightarrow 0.75\)  
  - \(N=2 \Rightarrow 0.50\)  
  - \(N=3 \Rightarrow 0.25\)  
  - \(N\ge 4 \Rightarrow 0.10\)

- 도보 점수  
  \[
  s_{walk}=\text{clamp}\left(1-\frac{D}{D_{max}}, 0, 1\right),\quad D_{max}=1200m
  \]

- 대기 점수  
  \[
  s_{wait}=\text{clamp}\left(1-\frac{W}{W_{max}}, 0, 1\right),\quad W_{max}=20min
  \]

- 무장애 점수 \(s_{access}\)  
  - 충분(엘리베이터/무장애 표기 확인) 0.8~1.0  
  - 부분 0.4~0.7  
  - 정보없음 0.5(중립)

- 최종 점수(가중합)  
  \[
  Score = 100\cdot(0.45s_{time}+0.20s_{transfer}+0.15s_{walk}+0.10s_{wait}+0.10s_{access})
  \]

### 예시 계산(3개 관광지, 가상 데이터)

가정: 출발지는 **entity["point_of_interest","부산역","railway station, busan"]**, 평일 14:00 기준. 경로 API가 제공하는 값이 없다는 가정 하에 대기시간 W는 “혼잡 보수치”로 입력했습니다(가상). 관광지의 무장애 점수도 데이터 부재를 가정한 임의값입니다(가상).

| 관광지(예시) | T(분) | 환승 N | 도보 D(m) | 대기 W(분) | 무장애 s_access | s_time | s_transfer | s_walk | s_wait | 최종점수 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| entity["point_of_interest","해운대해수욕장","busan, korea"] | 38 | 1 | 600 | 4 | 0.9 | 0.82 | 0.75 | 0.50 | 0.80 | 76.4 |
| entity["point_of_interest","감천문화마을","busan, korea"] | 35 | 1 | 750 | 8 | 0.4 | 0.85 | 0.75 | 0.38 | 0.60 | 68.9 |
| entity["point_of_interest","태종대","busan, korea"] | 70 | 2 | 850 | 12 | 0.6 | 0.50 | 0.50 | 0.29 | 0.40 | 46.9 |

### 단계별(알고리즘 파이프라인) 정리

1. (입력) 출발지(좌표) + 목적지(관광지 좌표) + 시간대(기본: 현재)  
2. (경로 조회) TMAP 대중교통 API 또는 ODsay로 경로 후보 1~3개 조회 citeturn38search3turn38search16  
3. (특징 추출) 각 후보에서 T/N/D/W, (가능하면) 무장애 정보를 추출  
4. (정규화) s_time, s_transfer, s_walk, s_wait, s_access 계산  
5. (최종 점수) 가중합으로 0~100 산출  
6. (저장/캐시) 동일 (출발,목적지,시간대,API버전) 조합은 TTL 캐시  
7. (표시) 점수 + “왜 이 점수인지” 분해 그래프/문장으로 제공

## 기능별 구현 설계와 예상 개발 시간

### MVP 기능 구성 원칙

- “외부 API 호출”은 백엔드로 모아 **키 보호 + 캐싱 + 장애 대응**을 통일합니다.  
- 지도 SDK는 클라이언트에서 호출되는 경우가 많으므로, 지도 키 관리/도메인 제한을 반드시 설정합니다(카카오/네이버 문서에 도메인/키 설정 요구). citeturn36search15turn36search13turn37search14  

### 기능별 엔드포인트·데이터 모델·우선순위·시간(3~5명 기준)

단위는 “대략적인 인일(person-day)”이며, 병렬 진행을 가정합니다.

| 기능 | MVP/추가 | 백엔드 API 엔드포인트(예시) | 데이터 모델(예시) | 주요 알고리즘/처리 | 예상 개발시간 |
|---|---|---|---|---|---:|
| 관광지 수집/동기화 | MVP | `POST /admin/sync/attractions` | Attraction(id, name, lat, lng, addr, source, updatedAt) | 부산 관광명소 API 주기적 수집 + upsert citeturn2view3turn3view0 | 3~5 |
| 관광지 목록/검색 | MVP | `GET /attractions?bbox=&q=&sort=` | Attraction + 검색 인덱스(옵션) | bbox 필터(PostGIS), 텍스트 검색 | 4~6 |
| 점수 계산(단건) | MVP | `POST /score` | ScoreSnapshot(attractionId, originId, ts, score, breakdownJSON) | 경로 API 호출→특징추출→정규화→점수 citeturn38search3turn38search16 | 6~10 |
| 점수 계산(배치/프리컴퓨트) | 추가 | `POST /admin/precompute?origin=...` | ScoreSnapshot | 인기 관광지 상위 N개에 대해 캐시/DB 저장 | 4~8 |
| 지도 화면(관광지 핀/클러스터) | MVP | (프론트) | - | 지도 SDK + 클러스터링(라이브러리) | 5~8 |
| 관광지 상세(점수 분해 표시) | MVP | `GET /attractions/:id` + `GET /score?...` | - | 점수 분해(막대 그래프/배지) | 4~6 |
| 외부 API 통합 모듈 | MVP | 내부 모듈 | ExternalCallLog, ApiQuotaState | 재시도/서킷브레이커/레이트리밋 | 5~9 |
| 캐싱(경로/점수) | MVP | - | RedisCacheKeySpec | TTL(예: 1~6h), 키 설계 | 3~5 |
| 스케줄링(데이터 갱신) | MVP | - | JobRunHistory | 크론: 관광지(일 1회), 점수(주 1회) | 2~4 |
| 테스트(단위/통합) | MVP | - | - | 경로 API Mock, 점수 회귀테스트 | 5~8 |
| 에러처리/관측(로그/알림) | MVP | - | - | 429/5xx 대응, fallback(캐시) | 3~6 |

### 에러 처리·레이트리밋 대응(필수 체크)

- **카카오 쿼터 초과**(일간/월간) 시: 캐시 우선 + UI에 “일시적으로 제한” 표기 + 재시도 백오프. 카카오가 월간/일간 쿼터 및 유료단가를 명시하므로, 무료쿼터 소진을 전제로 한 방어가 필요 citeturn37search14turn38search12  
- **네이버 지도 429(Quota Exceed)**: 콘솔 설정(웹 Dynamic Map 선택 등) 문제를 가장 먼저 의심하고, 모니터링으로 조기 탐지 citeturn36search13  
- **TMAP Open API 약관 준수**: 응답 데이터 24시간 이상 저장 금지(캐시/DB 정책에 직접 영향) citeturn38search1  
- **Google Directions**: 빌링/키 설정이 필수이며, 분당 요청 제한(가이드상 3,000 QPM 등) 고려해 서버 캐싱/쿼터 설정 필요 citeturn36search0  

## 아키텍처와 배포 옵션

### 권장 아키텍처(현실적 MVP)

- 프론트는 지도 SDK로 “표시”에 집중  
- 백엔드는 “외부 API 통합·캐싱·점수화”를 담당  
- DB는 관광지/점수 스냅샷을 저장(재계산 비용 감소)  
- 캐시는 경로 결과(쿼터/비용 방어) 중심  
- 배치는 관광지 갱신 및 프리컴퓨트 점수 갱신

```mermaid
flowchart LR
  U[User Browser] --> FE[Frontend Web (Next.js)]
  FE -->|HTTPS| BE[Backend API (FastAPI/NestJS)]
  BE --> DB[(PostgreSQL + PostGIS)]
  BE --> CACHE[(Redis Cache)]
  BE --> JOB[Scheduler/Cron]

  FE --> MAPSDK[Map SDK (Kakao/Naver)]
  BE --> TOUR[Tourism APIs (Busan Attraction, TourAPI)]
  BE --> TRANSIT[Transit Route API (TMAP Transit / ODsay)]
  BE --> LOCAL[Geo/Search API (Kakao Local)]
  BE --> OBS[Logs/Monitoring]

  JOB --> TOUR
  JOB --> TRANSIT
  JOB --> DB
```

### 배포 옵션(무료/저비용 관점의 선택 기준)

정확한 “무료 한도/요금”은 각 서비스 정책이 자주 변하므로(특히 크레딧/무료티어), 이 보고서에서는 “고정 수치” 대신 **선택 기준**을 제시합니다.

- 프론트: 정적/SSR 배포가 쉬운 호스팅(배포 자동화, PR 프리뷰)  
- 백엔드:  
  - 선택지 A: 컨테이너 기반(스테이징/프로덕션 분리 쉬움)  
  - 선택지 B: 서버리스(콜드스타트/장기 작업은 주의)  
- DB:  
  - MVP는 관리형 Postgres가 운영 효율이 높고, 좌표 쿼리를 위해 PostGIS 지원 여부를 확인  
- 관측: 최소한 “요청 성공률/4xx-5xx/외부 API 실패율/캐시 히트율”은 대시보드화

### TMAP·카카오 약관이 아키텍처에 미치는 영향(중요)

- TMAP Open API는 “획득 데이터 24시간 이상 저장 금지”를 명시합니다. 따라서 **(1) 장기 저장은 ‘요약/파생값(점수)’ 중심**, (2) 원본 route 응답은 TTL 24시간 미만 캐시로 제한하는 정책이 안전합니다. citeturn38search1  
- 카카오는 쿼터/유료 API 설정(비즈월렛 등)과 요금표를 공식적으로 제공하므로, “무료쿼터를 초과할 수 있다”는 전제를 둔 호출량 설계가 필요합니다. citeturn37search12turn37search14  

## 16주 개발 계획과 운영 체크리스트

### 주차별 계획(16주)

1주차  
1) 요구사항 확정(MVP/추가 기능 분리) fileciteturn0file0  
2) 데이터 소스 확정(관광지/경로 API 1순위 선정) citeturn3view0turn38search3turn38search16  
산출물: ERD 초안, API 키 발급 체크리스트

2~3주차  
1) 관광지 수집 파이프라인 구현(부산 관광명소 API → DB) citeturn2view3turn3view0  
2) 지도 화면 초안(핀/클러스터/상세 패널)  
산출물: 관광지 500~수천 건 로딩, 지도에 표시

4~5주차  
1) 경로 API 1개 연동(TMAP 대중교통 또는 ODsay 중 택1) citeturn38search3turn38search16  
2) 점수 산출 v0(시간/환승/도보/대기 고정)  
산출물: 단건 점수 API, 샘플 관광지 50개 점수

6~7주차  
1) 캐싱 도입(경로 결과/점수 결과)  
2) 에러 처리(429/5xx/타임아웃) + 재시도/백오프  
산출물: 캐시 히트율/실패율 로그, 장애 시 fallback 동작

8주차(중간 점검)  
1) MVP 데모(지도+목록+점수+정렬)  
2) UX 개선 목록(점수 분해 UI, 출발지 프리셋)  
산출물: 중간발표용 데모 영상/시연

9~10주차  
1) 검색/필터 강화(bbox/q/카테고리)  
2) 출발지 관리(프리셋 + 사용자 입력 1개)  
산출물: 실제 사용 흐름 완성

11~12주차  
1) 배치 프리컴퓨트(상위 N 관광지 점수 미리 계산)  
2) 운영시간/시간대 옵션(가능하면) citeturn10view0turn3view0  
산출물: 응답 지연 감소(캐시/프리컴퓨트)

13~14주차  
1) 테스트 강화(점수 회귀/Mock 외부 API)  
2) 성능 튜닝(DB 인덱스, 캐시 키)  
산출물: 부하 테스트 결과, 장애 시나리오 문서

15주차  
1) 배포/도메인/모니터링 정리  
2) 약관/키 보안 점검(도메인 제한/서버 키 보호) citeturn38search1turn37search14turn36search13  
산출물: 릴리즈 노트, 운영 가이드

16주차  
1) 최종 발표/시연  
2) 회고: 데이터 공백(무장애/실시간 대기)과 후속 로드맵  
산출물: 최종보고서/시연 링크

### 리스크와 완화책

- 리스크: **대중교통 경로탐색 API 선택 실패**(정책/지역 제한/유료 전환)  
  - 완화: 2주차에 “TMAP vs ODsay”를 PoC로 1~2일 내 비교(부산 10개 OD 쌍 테스트) citeturn38search3turn38search16  
- 리스크: 호출량 증가로 **쿼터 초과/과금 발생**(특히 카카오)  
  - 완화: 캐시·프리컴퓨트·쿼터 모니터링. 카카오 쿼터/유료단가 문서 기반으로 호출량 상한 설정 citeturn37search14  
- 리스크: 약관 위반(예: TMAP 데이터 장기 저장)  
  - 완화: “원본 응답 저장 금지/TTL < 24h”, DB에는 “점수/요약”만 저장 citeturn38search1  

### 데이터 갱신·캐싱 정책(권장)

- 관광지(정적 성격): 24시간 TTL 또는 일 1회 배치 갱신 citeturn3view0turn2view3  
- 경로 결과: 1~6시간 TTL(시간대별 키 분리), 단 TMAP 약관 고려 시 **24시간 초과 금지** citeturn38search1  
- 점수 결과:  
  - “실시간 점수”: 캐시 TTL 1~6시간  
  - “기본 점수(주간 평균)”는 ScoreSnapshot으로 저장(요약값이므로 약관 영향 완화)

### 개인정보·이용약관·API 이용제한 준수 체크리스트

- 위치 정보  
  - 브라우저 현재위치 사용 시: 사용자 동의 UI + 목적(점수 계산) + 저장 여부 고지(권장: 미저장)  
- 키/도메인 제한  
  - 카카오/네이버 지도 SDK는 “플랫폼 키 + 도메인 등록”이 실질적으로 필수(설정 누락 시 오류/429 가능) citeturn36search15turn36search13  
- TMAP 데이터 저장 제한  
  - “획득 데이터 24시간 이상 저장 금지” 준수 citeturn38search1  
- 카카오 유료 API 전환  
  - 무료쿼터 소진 후 유료 호출이 가능하므로, 배포 전 “유료 설정 여부/비즈월렛 연결 여부”를 점검 citeturn37search12turn37search14  
- Google Directions  
  - 빌링/키 필요, 사용 제한/요금 구조 가이드 준수 citeturn36search0  

### 성능·비용 추정(예시 시나리오)

카카오 쿼터/유료단가가 문서에 명시되어 있어, 비용 추정은 카카오 기준으로 가장 계산이 명확합니다. citeturn37search14  

가정(월간):
- 월 20,000 세션
- 세션당 지도 로드 3회(지도 SDK 호출 3회)
- 세션당 로컬 키워드/카테고리 검색 1회(장소검색)

추정 호출량:
- 지도 SDK: 60,000건/월  
- 로컬 장소검색: 20,000건/월  

단가(문서 예시):
- 카카오맵 지도 SDK(JavaScript): 0.1원/건(추가 쿼터 요금표) citeturn37search14  
- 로컬 키워드/카테고리 검색: 2원/건(추가 쿼터 요금표) citeturn37search14  

따라서 “유료 구간에 진입했다”는 가정 하의 상한 비용은:
- 지도: 60,000 × 0.1원 = 6,000원/월  
- 로컬 검색: 20,000 × 2원 = 40,000원/월  
- 합계: 약 46,000원/월(단, 실제로는 무료쿼터/일간쿼터 범위 내면 0원 가능, 정책 변동 가능) citeturn37search14  

TMAP/ODsay/Google은 요금제 구조가 서비스마다 다르므로, MVP 단계에서는 **(1) 경로 API 호출을 백엔드에서 강하게 캐시**, (2) 인기 관광지는 프리컴퓨트해 “실시간 호출” 자체를 줄이는 전략이 비용 리스크를 가장 크게 낮춥니다. citeturn38search1turn38search3turn38search16  

### 실제 사용 가능한 소스 링크(공식/우선, URL은 그대로 복사해 접속)

```text
[부산 관광명소 OpenAPI(공공데이터포털)]
https://www.data.go.kr/data/15057732/openapi.do
(호출 예: http://apis.data.go.kr/6260000/AttractionService/getAttractionKr)

[부산버스정보시스템(BIMS) OpenAPI(정류소 조회)]
https://www.data.go.kr/data/15092750/openapi.do
(호출 예: http://apis.data.go.kr/6260000/BusanBIMS/busStopList)

[한국관광공사 TourAPI(국문 관광정보 서비스)]
https://www.data.go.kr/data/15101578/openapi.do
(서비스 URL 변경 공지: https://www.data.go.kr/bbs/ntc/selectNotice.do?originId=NOTICE_0000000004082)

[카카오맵 시작하기/정책]
https://developers.kakao.com/docs/latest/ko/kakaomap
https://developers.kakao.com/docs/latest/ko/getting-started/quota

[카카오 로컬(Local) REST API]
https://developers.kakao.com/docs/latest/ko/local/dev-guide

[네이버 지도 JS API v3 문서]
https://navermaps.github.io/maps.js.ncp/docs
(클라이언트 ID 발급/설정: https://navermaps.github.io/maps.js.en/docs/tutorial-1-Getting-Client-ID.html)

[TMAP Open API 약관(무료 제공 한도/저장 제한)]
https://tmapapi.tmapmobility.com/terms.html

[TMAP 대중교통 API 이용절차/호출 예]
https://transit.tmapmobility.com/guide/procedure

[ODsay 가이드(대중교통 길찾기 호출 예시 포함)]
https://lab.odsay.com/guide/guide
(ODsay 소개: https://lab.odsay.com/)

[Google Directions API Usage and Billing]
https://developers.google.com/maps/documentation/directions/usage-and-billing
```