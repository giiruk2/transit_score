# 🏗️ 시스템 아키텍처 및 기술 스택

## 전체 시스템 구조도

```
┌─────────────────────────────────────────────────────────────┐
│                     사용자 브라우저                            │
│                  http://localhost:3000                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Next.js 프론트엔드 (React)                 │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  │  │
│  │  │ 카카오맵 SDK │  │ MapViewer.tsx │  │ 출발지 패널  │  │  │
│  │  └─────────────┘  └──────┬───────┘  └─────────────┘  │  │
│  └──────────────────────────┼────────────────────────────┘  │
└─────────────────────────────┼───────────────────────────────┘
                              │  axios (HTTP)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Express.js 백엔드 API (localhost:5001)           │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────┐ │
│  │   app.ts     │  │routeService.ts│  │    score.ts      │ │
│  │  (라우터)     │──▶│ (ODsay 호출)  │──▶│ (점수 산출)     │ │
│  └──────┬───────┘  └───────┬───────┘  └──────────────────┘ │
│         │                  │                                │
│         │ Prisma ORM       │ axios (HTTPS)                  │
│         ▼                  ▼                                │
│  ┌──────────────┐  ┌───────────────┐                       │
│  │  MySQL DB    │  │  ODsay API    │                       │
│  │ (관광지 100곳)│  │ (대중교통)     │                       │
│  └──────────────┘  └───────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 계층별 역할

### 1. 프론트엔드 (Next.js + React)

| 파일 | 역할 |
|------|------|
| `MapViewer.tsx` | 카카오맵 렌더링, 마커 배치, 출발지 프리셋 UI, 점수 상세 패널 |
| `layout.tsx` | 카카오맵 SDK `<Script>` 로드, 전역 레이아웃 |
| `.env.local` | `NEXT_PUBLIC_KAKAO_JS_KEY` (카카오 JavaScript 키) |

**데이터 흐름:**
1. 컴포넌트 마운트 → `GET /api/attractions` → 관광지 100곳 좌표 수신 → 마커 배치
2. 마커 클릭 → `GET /api/score/:id?originLat=...&destLat=...` → 점수 수신 → 패널에 렌더링

### 2. 백엔드 API (Express.js)

| 파일 | 역할 |
|------|------|
| `app.ts` | Express 서버 초기화, CORS, 라우팅 (`/api/attractions`, `/api/score`) |
| `routeService.ts` | ODsay API 호출 + Haversine Fallback 로직 |
| `score.ts` | 경로 데이터 → 0~100점 정규화 가중합 산출 |
| `mockData.ts` | DB 비어있을 때 사용하는 더미 데이터 |

### 3. 데이터베이스 (MySQL + Prisma)

| 테이블 | 역할 |
|--------|------|
| `Attraction` | 관광지 마스터 (이름, 주소, 위/경도, 이미지, 설명 등) |
| `ScoreSnapshot` | 출발지-목적지별 점수 기록 (향후 캐싱/사전계산 용도) |

### 4. 외부 API

| API | 용도 | 제공량 |
|-----|------|--------|
| **ODsay Lab** | 대중교통 길찾기 (이동시간, 환승, 도보) | 일 1,000건 (무료) |
| **카카오맵 SDK** | 지도 렌더링, 마커 표시 | 일 300,000건 (무료) |
| **공공데이터포털** | 부산 관광지 원본 데이터 수집 | 무제한 |

---

## Fallback 시스템 (API 장애 대비)

ODsay API 호출이 실패(쿼터 초과, 네트워크 에러, 700m 이내 근거리 등)하면, 시스템이 죽지 않고 **자체 추정 알고리즘**이 자동으로 가동됩니다.

```
[정상 흐름]  ODsay API 응답 성공 → 실제 경로 데이터 기반 점수 산출
[장애 흐름]  ODsay API 에러 catch → Haversine 직선거리 계산 → 15km/h 평균속도 기반 추정
```

| 항목 | 정상 모드 | Fallback 모드 |
|------|-----------|---------------|
| 이동시간 | ODsay 실제 경로 기준 | 직선거리 ÷ 15km/h |
| 환승 | ODsay 버스+지하철 환승 수 | 10km 이상 1회, 20km 이상 2회 |
| 도보 | ODsay 총 도보 거리 | 직선거리 × 15% |
| 대기시간 | 고정 5분 | 고정 10분 (패널티) |
| UI 표시 | 일반 점수 | ⚠️ "임시 추정치" 경고 배지 |

---

## 폴더 구조 상세

```
TransitScore_2/
├── frontend/                    # Next.js 16 프론트엔드
│   ├── src/
│   │   ├── app/                 # App Router (layout, page)
│   │   └── components/
│   │       └── MapViewer.tsx    # 핵심 UI 컴포넌트
│   ├── .env.local               # 카카오맵 JS Key
│   └── package.json
│
├── backend/                     # Express.js 백엔드
│   ├── src/
│   │   ├── app.ts               # 메인 서버 엔트리포인트
│   │   ├── mockData.ts          # DB 빈 경우 Fallback 더미 데이터
│   │   ├── services/
│   │   │   ├── routeService.ts  # ODsay API 연동 + Fallback
│   │   │   └── score.ts         # 점수 산출 알고리즘 (가중합)
│   │   └── scripts/
│   │       ├── seed.ts          # DB 시딩 (관광지 JSON → MySQL)
│   │       └── fetchAttractions.ts  # 공공데이터 API 수집 스크립트
│   ├── prisma/
│   │   └── schema.prisma        # DB 스키마 정의
│   ├── data/
│   │   └── busan_attractions_raw.json  # 수집된 원본 JSON
│   ├── .env                     # 환경변수 (Git 제외)
│   ├── .env.example             # 환경변수 템플릿
│   └── package.json
│
├── document/                    # 프로젝트 문서
├── docker-compose.yml           # MySQL Docker 설정 (옵션)
└── .gitignore
```
