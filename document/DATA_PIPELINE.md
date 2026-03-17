# 🔄 데이터 수집 및 가공 파이프라인

## 전체 데이터 흐름

```
[1. 수집]                    [2. 저장]              [3. 실시간 조회]
공공데이터포털 ──▶ JSON 파일 ──▶ MySQL DB ──▶ 프론트엔드 지도 마커
(부산 관광지 API)    (raw)      (Prisma)
                                                    ↓ 마커 클릭
                                              [4. 경로 분석]
                                              ODsay API ──▶ 점수 산출
```

---

## 1단계: 관광지 데이터 수집

### 데이터 출처

| 항목 | 내용 |
|------|------|
| **API** | 부산광역시 부산명소정보 서비스 (공공데이터포털) |
| **URL** | `https://www.data.go.kr` |
| **인증** | 공공데이터 API Key (무료, 무제한) |
| **포맷** | JSON   |

### 수집 스크립트

> 📁 파일: `backend/src/scripts/fetchAttractions.ts`

이 스크립트는 공공데이터포털의 부산 관광지 API를 호출하여 원본 JSON 데이터를 다운로드합니다.

```bash
cd backend
npx ts-node src/scripts/fetchAttractions.ts
```

### 수집 데이터 필드 매핑

| 원본 필드 (API 응답) | 변환 필드 (DB) | 설명 |
|---------------------|---------------|------|
| `UC_SEQ` | `contentId` | 관광지 고유 ID (String 변환) |
| `MAIN_TITLE` | `name` | 관광지 이름 |
| `ADDR1` | `address` | 주소 |
| `LAT` | `lat` | 위도 (Float 변환) |
| `LNG` | `lng` | 경도 (Float 변환) |
| `MAIN_IMG_NORMAL` | `imageUrl` | 대표 이미지 URL |
| `ITEMCNTNTS` | `description` | 관광지 설명 (장문) |
| `CNTCT_TEL` | `phone` | 연락처 |
| `HOMEPAGE_URL` | `homepage` | 홈페이지 URL |

### 저장 위치

```
backend/data/busan_attractions_raw.json
```

> 현재 약 **100개**의 부산 관광지 데이터가 수집되어 있습니다.

---

## 2단계: DB 시딩 (JSON → MySQL)

### 시딩 스크립트

> 📁 파일: `backend/src/scripts/seed.ts`

수집된 JSON 파일을 읽어서 MySQL 데이터베이스의 `Attraction` 테이블에 적재합니다.

```bash
cd backend
npx ts-node src/scripts/seed.ts
```

### 주요 로직

- **Upsert 패턴:** `contentId`를 기준으로 중복 검사 → 이미 있으면 `update`, 없으면 `create`
- **타입 변환:** `UC_SEQ`(숫자) → `contentId`(문자열)로 `toString()` 변환
- **좌표 변환:** `LAT`, `LNG` 문자열 → `parseFloat()`으로 실수형 변환

### 실행 결과

```
🚀 Seeding MySQL Database...
✅ 총 100 개의 관광지 데이터가 MySQL (transitscore DB)에 성공적으로 적재되었습니다.
```

---

## 3단계: 실시간 경로 분석 (ODsay API)

### 데이터 흐름

```
사용자 마커 클릭
    ↓
프론트엔드 → GET /api/score/:id?originLat=...&destLat=...
    ↓
백엔드 (routeService.ts) → ODsay searchPubTransPathT API 호출
    ↓
ODsay 응답 파싱 (path[0].info)
    ↓
score.ts → 정규화 가중합 → 최종 점수 (0~100)
    ↓
프론트엔드 패널에 렌더링
```

### ODsay API 핵심 파라미터

| 파라미터 | 의미 | 예시 |
|----------|------|------|
| `SX` | 출발지 경도 | `129.0422` |
| `SY` | 출발지 위도 | `35.1152` |
| `EX` | 도착지 경도 | `129.0844` |
| `EY` | 도착지 위도 | `35.0587` |
| `apiKey` | ODsay API Key | (환경변수) |

### ODsay 응답에서 추출하는 필드

| ODsay 필드 | 추출 정보 |
|------------|-----------|
| `path[0].info.totalTime` | 총 소요시간 (분) |
| `path[0].info.busTransitCount` | 버스 환승 횟수 |
| `path[0].info.subwayTransitCount` | 지하철 환승 횟수 |
| `path[0].info.totalWalk` | 총 도보 거리 (m) |

---

## 4단계: Fallback 추정 (API 장애 시)

ODsay API 호출이 실패하면 Haversine 공식으로 직선 거리를 계산하고, 대중교통 평균 속도(15km/h)를 적용하여 소요시간을 추정합니다.

```
Haversine 직선거리(km) → 소요시간(분) = 거리 ÷ 15km/h × 60
                       → 도보거리(m) = 직선거리 × 15%
                       → 환승횟수 = 10km 초과 시 1회, 20km 초과 시 2회
```

---

## DB 스키마 (Prisma)

> 📁 파일: `backend/prisma/schema.prisma`

### Attraction 테이블

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | String (UUID) | Primary Key |
| `contentId` | String? (Unique) | 공공데이터 고유 ID |
| `name` | String | 관광지 이름 |
| `address` | String? | 주소 |
| `lat` | Float | 위도 (WGS84) |
| `lng` | Float | 경도 (WGS84) |
| `imageUrl` | String? | 대표 이미지 URL |
| `description` | String? (Text) | 상세 설명 |
| `accessScore` | Float (기본 0.5) | 무장애 접근성 점수 |

### ScoreSnapshot 테이블

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | String (UUID) | Primary Key |
| `attractionId` | String (FK) | 관광지 참조 |
| `originName` | String | 출발지명 (예: "부산역") |
| `originLat/Lng` | Float | 출발지 좌표 |
| `totalTimeMin` | Int | 소요시간 (분) |
| `transferCount` | Int | 환승 횟수 |
| `finalScore` | Float | 최종 점수 (0~100) |
| `breakdown` | Json | 세부 점수 분해요소 |
