# 🛠️ 개발 환경 세팅 가이드

## 사전 요구사항

| 도구 | 버전 | 설치 방법 |
|------|------|-----------|
| **Node.js** | 18 이상 | [nodejs.org](https://nodejs.org) 또는 `brew install node` |
| **MySQL** | 8.0+ | `brew install mysql` |
| **npm** | 9 이상 | Node.js 설치 시 자동 포함 |

---

## 1. 저장소 클론

```bash
git clone https://github.com/your-repo/TransitScore_2.git
cd TransitScore_2
```

---

## 2. API 키 발급

이 프로젝트는 3개의 외부 API 키가 필요합니다.

### 2-1. ODsay Lab (대중교통 길찾기) — 필수

1. [lab.odsay.com](https://lab.odsay.com) 에 회원가입
2. **[My Project]** → **새 프로젝트 생성** (이름: `TransitScore`)
3. 플랫폼은 **Web** 선택
4. 도메인(URL)에 `http://localhost` 와 `http://localhost:5001` 등록
5. 발급된 **API Key** 복사

> ⚠️ 플랫폼을 **Server**로 선택하면 IP 기반 인증이 되어, 장소를 이동할 때마다 IP를 변경해야 합니다. 반드시 **Web**으로 선택하세요.

### 2-2. 카카오 개발자 (지도 SDK) — 필수

1. [developers.kakao.com](https://developers.kakao.com) 에 로그인
2. **[내 애플리케이션]** → **앱 추가** → 이름 입력
3. **[앱 키]** 메뉴에서 **JavaScript 키** 복사
4. **[플랫폼]** 메뉴에서 웹 사이트 도메인 등록: `http://localhost:3000`

### 2-3. 공공데이터포털 (관광지 데이터) — 선택

1. [data.go.kr](https://www.data.go.kr) 에 회원가입
2. **부산광역시 부산명소정보 서비스** 검색 → 활용 신청
3. 발급된 **인증키** 복사

> 이미 수집된 데이터가 `backend/data/` 폴더에 있으므로, 새로 수집하지 않을 경우 생략 가능합니다.

---

## 3. 환경변수 설정

### 백엔드 (`backend/.env`)

```bash
cd backend
cp .env.example .env
```

`.env` 파일을 열어 아래 내용을 입력합니다.

```env
PORT=5001

# 공공데이터 API Key
PUBLIC_DATA_API_KEY=your_public_data_api_key_here

# ODsay 대중교통 API Key (Web 플랫폼)
ODSAY_API_KEY=your_odsay_api_key_here

# 카카오 REST API Key
KAKAO_REST_API_KEY=your_kakao_rest_key_here

# MySQL 연결
DATABASE_URL=mysql://root@localhost:3306/transitscore

# Redis (선택, 캐싱용)
REDIS_URL=redis://localhost:6379
```

### 프론트엔드 (`frontend/.env.local`)

```env
NEXT_PUBLIC_KAKAO_JS_KEY=your_kakao_javascript_key_here
```

---

## 4. 데이터베이스 설정

### MySQL 시작

```bash
brew services start mysql
```

### 데이터베이스 생성

```bash
mysql -u root -e "CREATE DATABASE IF NOT EXISTS transitscore;"
```

### 스키마 동기화 (Prisma)

```bash
cd backend
npx prisma db push
```

### 관광지 데이터 시딩

```bash
npx ts-node src/scripts/seed.ts
```

성공 시 출력:
```
🚀 Seeding MySQL Database...
✅ 총 100 개의 관광지 데이터가 MySQL (transitscore DB)에 성공적으로 적재되었습니다.
```

---

## 5. 의존성 설치 및 서버 실행

### 백엔드

```bash
cd backend
npm install
npm run dev    # http://localhost:5001
```

### 프론트엔드 (새 터미널)

```bash
cd frontend
npm install
npm run dev    # http://localhost:3000
```

### 정상 동작 확인

- 브라우저에서 `http://localhost:3000` 접속
- 카카오맵 위에 관광지 마커들이 표시되면 성공
- 마커 클릭 시 좌측에 관광지 상세 + 접근성 점수 패널 표시

---

## 6. 자주 쓰는 명령어 모음

| 용도 | 명령어 |
|------|--------|
| MySQL 시작 | `brew services start mysql` |
| MySQL 종료 | `brew services stop mysql` |
| 백엔드 실행 | `cd backend && npm run dev` |
| 프론트엔드 실행 | `cd frontend && npm run dev` |
| DB 스키마 동기화 | `cd backend && npx prisma db push` |
| DB 시딩 | `cd backend && npx ts-node src/scripts/seed.ts` |
| Prisma Studio (DB GUI) | `cd backend && npx prisma studio` |
| 5001 포트 강제 종료 | `kill -9 $(lsof -t -i:5001)` |

---

## 7. 트러블슈팅

### `Error: listen EADDRINUSE: address already in use :::5001`

5001 포트를 이미 다른 프로세스가 점유하고 있을 때 발생합니다.

```bash
kill -9 $(lsof -t -i:5001) || true
cd backend && npm run dev
```

### `[ApiKeyAuthFailed] ApiKey authentication failed.`

ODsay API Key 인증 실패입니다. 다음 항목을 점검하세요.
- ODsay 프로젝트의 플랫폼이 **Web**으로 설정되어 있는지 확인
- 도메인에 `http://localhost` 와 `http://localhost:5001`이 등록되어 있는지 확인
- 새 프로젝트 생성 직후라면 **3~5분** 대기 후 재시도

### `카카오맵이 흰 화면으로 표시됨`

- 카카오 개발자 콘솔 → 해당 앱 → 플랫폼 도메인에 `http://localhost:3000` 이 등록되어 있는지 확인
- `frontend/.env.local` 에 `NEXT_PUBLIC_KAKAO_JS_KEY` 값이 올바른지 확인
