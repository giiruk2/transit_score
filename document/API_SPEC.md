# 📡 백엔드 API 명세서

**Base URL:** `http://localhost:5001`

---

## 1. 헬스체크

서버가 정상 작동 중인지 확인합니다.

| 항목 | 값 |
|------|-----|
| **Method** | `GET` |
| **URL** | `/health` |

### 응답 예시

```json
{
  "status": "ok",
  "message": "TransitScore Backend API is running.",
  "timestamp": "2026-03-16T15:00:00.000Z"
}
```

---

## 2. 관광지 목록 조회

MySQL DB에 저장된 부산 관광지 전체 목록을 반환합니다.

| 항목 | 값 |
|------|-----|
| **Method** | `GET` |
| **URL** | `/api/attractions` |

### 응답 예시

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-string",
      "contentId": "12345",
      "name": "태종대유원지",
      "address": "부산광역시 영도구 전망로...",
      "lat": 35.0587,
      "lng": 129.0844,
      "imageUrl": "https://...",
      "description": "부산을 대표하는 절경...",
      "phone": "051-405-2004",
      "homepage": "https://...",
      "accessScore": 0.5,
      "createdAt": "2026-03-16T00:00:00.000Z",
      "updatedAt": "2026-03-16T00:00:00.000Z"
    }
  ]
}
```

> **참고:** DB가 비어있을 경우 `mockData.ts`에 정의된 더미 데이터가 반환됩니다.

---

## 3. 접근성 점수 분석

지정된 출발지에서 특정 관광지까지의 대중교통 접근성 점수를 실시간으로 계산합니다.

| 항목 | 값 |
|------|-----|
| **Method** | `GET` |
| **URL** | `/api/score/:attractionId` |

### Query Parameters (필수)

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `originLat` | float | 출발지 위도 | `35.1152` |
| `originLng` | float | 출발지 경도 | `129.0422` |
| `destLat` | float | 도착지 위도 | `35.0587` |
| `destLng` | float | 도착지 경도 | `129.0844` |

### 요청 예시

```
GET /api/score/uuid-12345?originLat=35.1152&originLng=129.0422&destLat=35.0587&destLng=129.0844
```

### 성공 응답 (200)

```json
{
  "success": true,
  "data": {
    "attractionId": "uuid-12345",
    "originLocation": {
      "lat": 35.1152,
      "lng": 129.0422
    },
    "scoreDetails": {
      "finalScore": 72.5,
      "breakdown": {
        "s_time": 0.82,
        "s_transfer": 0.75,
        "s_walk": 0.65,
        "s_wait": 0.75
      },
      "rawParams": {
        "totalTimeMin": 38,
        "transferCount": 1,
        "walkDistanceM": 420,
        "waitTimeMin": 5,
        "success": true,
        "isFallback": false
      }
    }
  }
}
```

### 파라미터 누락 시 (400)

```json
{
  "success": false,
  "message": "originLat, originLng, destLat, destLng 쿼리 파라미터가 모두 필요합니다."
}
```

### ODsay API 호출 실패 시 (502)

```json
{
  "success": false,
  "message": "ODsay 경로 탐색 실패"
}
```

> **참고:** ODsay API 실패 시 Fallback 로직이 작동하면, `isFallback: true`로 표시된 추정 점수가 정상 응답(200)으로 반환됩니다.

---

## 응답 필드 설명

### `scoreDetails` 객체

| 필드 | 타입 | 설명 |
|------|------|------|
| `finalScore` | number | 최종 접근성 점수 (0~100) |
| `breakdown.s_time` | number | 이동시간 정규화 점수 (0~1) |
| `breakdown.s_transfer` | number | 환승 점수 (0~1, 계단형) |
| `breakdown.s_walk` | number | 도보거리 점수 (0~1) |
| `breakdown.s_wait` | number | 대기시간 점수 (0~1) |

### `rawParams` 객체

| 필드 | 타입 | 설명 |
|------|------|------|
| `totalTimeMin` | number | 총 소요시간 (분) |
| `transferCount` | number | 환승 횟수 |
| `walkDistanceM` | number | 총 도보 거리 (미터) |
| `waitTimeMin` | number | 예상 대기시간 (분) |
| `isFallback` | boolean | Fallback 추정치 여부 |
