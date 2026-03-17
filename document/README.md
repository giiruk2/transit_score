# 🚌 TransitScore — 부산 관광지 대중교통 접근성 분석 플랫폼

## 프로젝트 소개

**TransitScore**는 부산 주요 관광지까지의 **대중교통 접근성을 0~100점으로 수치화**하여 시각적으로 보여주는 웹 애플리케이션입니다.

> "부산역에서 감천문화마을까지 대중교통으로 얼마나 쉽게 갈 수 있을까?"

이 질문에 대해, 이동시간 · 환승 횟수 · 도보 거리 · 대기시간 등 4가지 핵심 지표를 실시간으로 분석하고, 가중치 기반 종합 점수를 산출하여 카카오맵 위에 직관적으로 표시합니다.

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| 🗺️ **카카오맵 기반 시각화** | 부산 관광지 100곳을 지도 위 마커로 표시 |
| 📊 **실시간 접근성 점수** | ODsay 대중교통 길찾기 API를 활용한 0~100점 산출 |
| 🚩 **동적 출발지 선택** | 부산역, 서면역, 해운대역, 김해공항 등 프리셋 지원 |
| 🔄 **Fallback 시스템** | API 장애 시 하버사인 공식 기반 자체 추정 로직 자동 전환 |
| 📋 **상세 정보 패널** | 마커 클릭 시 이동시간, 환승, 도보거리 등 상세 지표 표시 |

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS, react-kakao-maps-sdk |
| **Backend** | Express.js, TypeScript, Prisma ORM, Axios |
| **Database** | MySQL (Homebrew) |
| **외부 API** | ODsay 대중교통 길찾기 API, 카카오맵 SDK |
| **개발 도구** | Nodemon, ts-node, Docker Compose (옵션) |

---

## 빠른 시작 (Quick Start)

### 사전 요구사항
- Node.js 18+
- MySQL (Homebrew: `brew install mysql`)
- ODsay API Key ([lab.odsay.com](https://lab.odsay.com))
- 카카오맵 JavaScript Key ([developers.kakao.com](https://developers.kakao.com))

### 실행 순서

```bash
# 1. 저장소 클론
git clone https://github.com/your-repo/TransitScore_2.git
cd TransitScore_2

# 2. 환경변수 설정 (DEVELOPMENT_GUIDE.md 참고)
cp backend/.env.example backend/.env
# .env 파일 내 API 키 입력

# 3. MySQL 시작
brew services start mysql

# 4. 백엔드 실행
cd backend
npm install
npx prisma db push
npx ts-node src/scripts/seed.ts   # 관광지 데이터 적재
npm run dev                        # localhost:5001

# 5. 프론트엔드 실행 (새 터미널)
cd frontend
npm install
npm run dev                        # localhost:3000
```

브라우저에서 `http://localhost:3000` 에 접속하면 지도와 마커가 표시됩니다.

---

## 프로젝트 구조

```
TransitScore_2/
├── frontend/                 # Next.js 프론트엔드
│   └── src/components/
│       └── MapViewer.tsx     # 지도 + 마커 + 점수 패널 (핵심 UI)
├── backend/                  # Express.js 백엔드 API
│   ├── src/
│   │   ├── app.ts            # 메인 서버 & 라우팅
│   │   └── services/
│   │       ├── routeService.ts  # ODsay API 연동 + Fallback 로직
│   │       └── score.ts         # 접근성 점수 산출 알고리즘
│   ├── prisma/
│   │   └── schema.prisma     # DB 스키마 정의
│   └── data/                 # 원본 관광지 JSON 데이터
├── document/                 # 프로젝트 문서
└── .gitignore
```

---

## 관련 문서

- [ARCHITECTURE.md](./ARCHITECTURE.md) — 시스템 아키텍처 및 데이터 흐름
- [API_SPEC.md](./API_SPEC.md) — 백엔드 API 명세서
- [SCORING_LOGIC.md](./SCORING_LOGIC.md) — 접근성 점수 산출 알고리즘 상세
- [DATA_PIPELINE.md](./DATA_PIPELINE.md) — 데이터 수집 및 가공 파이프라인
- [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md) — 개발 환경 세팅 가이드
