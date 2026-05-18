import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { fetchOtpRoute } from './services/otpService';
import { calculateGtt, DEFAULT_COEFFICIENTS, GttCoefficients } from './services/score';
import { mockAttractions, mockScores } from './mockData';

// 동 중심좌표 JSON 로드
const dongCentersPath = path.join(__dirname, '../../data/dong_centers.json');
const dongCenters: Record<string, { lat: number; lng: number }> = fs.existsSync(dongCentersPath)
  ? JSON.parse(fs.readFileSync(dongCentersPath, 'utf-8'))
  : {};

dotenv.config();

const app: Express = express();
const port = Number(process.env.PORT) || 5001;
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

// 헬스체크
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    message: 'TransitScore Backend API is running.',
    timestamp: new Date().toISOString()
  });
});

// 1. 관광지 목록 반환 API (Prisma PostgreSQL 조회)
app.get('/api/attractions', async (req: Request, res: Response): Promise<any> => {
  try {
    const attractions = await prisma.attraction.findMany({
      orderBy: { createdAt: 'desc' }
    });

    if (attractions.length > 0) {
      return res.json({ success: true, data: attractions });
    }

    // DB가 비어있으면 기존 mockData 반환 (Fallback)
    return res.json({
      success: true,
      data: mockAttractions
    });
  } catch (error) {
    console.error("DB 조회 중 에러 발생:", error);
    return res.status(500).json({ success: false, message: "서버 에러가 발생했습니다." });
  }
});

// 2. 단건 관광지에 대한 접근성 점수 분석 API (MK3 GTT 기반)
app.get('/api/score/:attractionId', async (req: Request, res: Response): Promise<any> => {
  const { attractionId } = req.params;
  const originLatStr = req.query.originLat as string;
  const originLngStr = req.query.originLng as string;
  const destLatStr = req.query.destLat as string;
  const destLngStr = req.query.destLng as string;

  // 1. 필수 파라미터 검증
  if (!originLatStr || !originLngStr || !destLatStr || !destLngStr) {
    return res.status(400).json({
      success: false,
      message: "originLat, originLng, destLat, destLng 쿼리 파라미터가 모두 필요합니다."
    });
  }

  const originLat = parseFloat(originLatStr);
  const originLng = parseFloat(originLngStr);
  const destLat = parseFloat(destLatStr);
  const destLng = parseFloat(destLngStr);

  if ([originLat, originLng, destLat, destLng].some(isNaN)) {
    return res.status(400).json({ success: false, message: "좌표값이 유효하지 않습니다." });
  }

  // 2. MK3 GTT 계수 파라미터 파싱 (없으면 기본값 사용)
  const alphaRaw = parseFloat(req.query.alpha as string);
  const betaRaw  = parseFloat(req.query.beta  as string);
  const gammaRaw = parseFloat(req.query.gamma as string);
  const tMaxRaw  = parseInt(req.query.tMax   as string, 10);

  const coefficients: GttCoefficients = {
    alpha: isNaN(alphaRaw) ? DEFAULT_COEFFICIENTS.alpha : alphaRaw,
    beta:  isNaN(betaRaw)  ? DEFAULT_COEFFICIENTS.beta  : betaRaw,
    gamma: isNaN(gammaRaw) ? DEFAULT_COEFFICIENTS.gamma : gammaRaw,
    tMax:  isNaN(tMaxRaw)  ? (DEFAULT_COEFFICIENTS.tMax ?? 0) : tMaxRaw,
  };

  // 3. OTP2 대중교통 경로 탐색
  let routeResult;
  try {
    routeResult = await fetchOtpRoute(originLat, originLng, destLat, destLng);
  } catch (error) {
    console.error('fetchOtpRoute 예외:', error);
    return res.status(500).json({ success: false, message: '경로 탐색 중 서버 오류가 발생했습니다.' });
  }

  // 4. MK3 GTT 채점
  const gttResult = calculateGtt(routeResult, coefficients);

  // 5. dongKey가 있으면 DongScore에 원시 시간 컴포넌트 저장
  //    (계수 독립적으로 저장 → 조회 시 프론트에서 GTT 계산)
  const dongKey = req.query.dongKey as string | undefined;
  if (dongKey) {
    const dongCenter = dongCenters[dongKey];
    if (dongCenter) {
      fetchOtpRoute(dongCenter.lat, dongCenter.lng, destLat, destLng)
        .then((dongRouteResult) => {
          const dongGtt = calculateGtt(dongRouteResult);
          const bd = dongGtt.breakdown;
          return prisma.dongScore.upsert({
            where: { dongKey_attractionId: { dongKey, attractionId } },
            create: {
              dongKey,
              attractionId,
              tInvehicle: bd.T_invehicle,
              tWalk:      bd.T_walk_raw,
              tWait:      bd.T_wait_raw,
              nTransfer:  bd.N_transfer,
              hasLowFloor: dongRouteResult.hasLowFloor,
              dongLat: dongCenter.lat,
              dongLng: dongCenter.lng,
            },
            update: {
              tInvehicle: bd.T_invehicle,
              tWalk:      bd.T_walk_raw,
              tWait:      bd.T_wait_raw,
              nTransfer:  bd.N_transfer,
              hasLowFloor: dongRouteResult.hasLowFloor,
              dongLat: dongCenter.lat,
              dongLng: dongCenter.lng,
              computedAt: new Date(),
            }
          });
        })
        .catch(() => {});
    }
  }

  // 6. 로그인 사용자면 ScoreSnapshot 저장
  const userId = req.query.userId as string | undefined;
  if (userId) {
    prisma.scoreSnapshot.create({
      data: {
        userId,
        attractionId,
        originName: req.query.originName as string || '',
        originLat,
        originLng,
        totalTimeMin: routeResult.totalTimeMin,
        transferCount: routeResult.transferCount,
        walkDistanceM: routeResult.walkDistanceM,
        waitTimeMin: Math.round(routeResult.waitTimeMin),
        gtt: gttResult.gtt,
        grade: gttResult.grade,
        alpha: coefficients.alpha,
        beta:  coefficients.beta,
        gamma: coefficients.gamma,
        finalScore: gttResult.gtt,  // 하위 호환용
        breakdown: gttResult.breakdown as object,
      }
    }).catch(() => {});
  }

  // 7. 최종 결과 반환
  return res.json({
    success: true,
    data: {
      attractionId,
      originLocation: { lat: originLat, lng: originLng },
      scoreDetails: gttResult,
    }
  });
});

// 3. 동별 관광지 점수 조회 API (캐시 읽기 전용)
// GET /api/dong-scores?dong=해운대구 중동
app.get('/api/dong-scores', async (req: Request, res: Response): Promise<any> => {
  const dongKey = req.query.dong as string;
  if (!dongKey) {
    return res.status(400).json({ success: false, message: 'dong 파라미터가 필요합니다.' });
  }

  try {
    const rows = await prisma.dongScore.findMany({ where: { dongKey } });
    const data: Record<string, {
      tInvehicle: number; tWalk: number; tWait: number; nTransfer: number; hasLowFloor: boolean;
    }> = {};
    rows.forEach((row) => {
      data[row.attractionId] = {
        tInvehicle:  row.tInvehicle,
        tWalk:       row.tWalk,
        tWait:       row.tWait,
        nTransfer:   row.nTransfer,
        hasLowFloor: row.hasLowFloor,
      };
    });
    return res.json({ success: true, data });
  } catch {
    return res.status(500).json({ success: false, message: 'DB 조회 오류' });
  }
});

// 4. AHP 설문 응답 저장 API (레거시 보존)
app.post('/api/weights', async (req: Request, res: Response): Promise<any> => {
  const { a12, a13, a14, a15, a23, a24, a25, a34, a35, a45, cr } = req.body;

  const fields = [a12, a13, a14, a15, a23, a24, a25, a34, a35, a45, cr];
  if (fields.some((v) => typeof v !== 'number' || isNaN(v))) {
    return res.status(400).json({ success: false, message: '응답값이 올바르지 않습니다.' });
  }
  if (cr >= 0.2) {
    return res.status(400).json({ success: false, message: 'CR이 0.2 이상인 응답은 저장되지 않습니다.' });
  }

  try {
    await prisma.weightResponse.create({
      data: { a12, a13, a14, a15, a23, a24, a25, a34, a35, a45, cr }
    });
    return res.json({ success: true });
  } catch (error) {
    console.error('WeightResponse 저장 실패:', error);
    return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// 5. 즐겨찾기 조회 API
app.get('/api/favorites/:userId', async (req: Request, res: Response): Promise<any> => {
  try {
    const rows = await prisma.favoriteAttraction.findMany({ where: { userId: req.params.userId } });
    return res.json({ success: true, data: rows.map((r) => r.attractionId) });
  } catch {
    return res.status(500).json({ success: false, message: 'DB 조회 오류' });
  }
});

// 6. 즐겨찾기 추가 API
app.post('/api/favorites', async (req: Request, res: Response): Promise<any> => {
  const { userId, attractionId } = req.body;
  if (!userId || !attractionId) return res.status(400).json({ success: false, message: '필수 파라미터 누락' });
  try {
    await prisma.favoriteAttraction.create({ data: { userId, attractionId } });
    return res.json({ success: true });
  } catch {
    return res.json({ success: true }); // 이미 존재해도 무시
  }
});

// 7. 즐겨찾기 삭제 API
app.delete('/api/favorites', async (req: Request, res: Response): Promise<any> => {
  const { userId, attractionId } = req.body;
  if (!userId || !attractionId) return res.status(400).json({ success: false, message: '필수 파라미터 누락' });
  try {
    await prisma.favoriteAttraction.deleteMany({ where: { userId, attractionId } });
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ success: false, message: 'DB 오류' });
  }
});

// 8. 저장된 출발지 조회 API
app.get('/api/saved-origins/:userId', async (req: Request, res: Response): Promise<any> => {
  try {
    const rows = await prisma.savedOrigin.findMany({
      where: { userId: req.params.userId },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ success: true, data: rows });
  } catch {
    return res.status(500).json({ success: false, message: 'DB 조회 오류' });
  }
});

// 9. 저장된 출발지 추가 API
app.post('/api/saved-origins', async (req: Request, res: Response): Promise<any> => {
  const { userId, name, lat, lng, dongKey } = req.body;
  if (!userId || !name || lat == null || lng == null) return res.status(400).json({ success: false, message: '필수 파라미터 누락' });
  try {
    const row = await prisma.savedOrigin.create({ data: { userId, name, lat, lng, dongKey } });
    return res.json({ success: true, data: row });
  } catch {
    return res.status(500).json({ success: false, message: 'DB 오류' });
  }
});

// 10. 저장된 출발지 삭제 API
app.delete('/api/saved-origins/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    await prisma.savedOrigin.delete({ where: { id: req.params.id } });
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ success: false, message: 'DB 오류' });
  }
});

// 11. 사용자 GTT 계수 조회 API (MK3)
app.get('/api/user-weights/:userId', async (req: Request, res: Response): Promise<any> => {
  const { userId } = req.params;
  try {
    const row = await prisma.userWeight.findUnique({ where: { userId } });
    if (!row) return res.json({ success: true, data: null });
    return res.json({
      success: true,
      data: { alpha: row.alpha, beta: row.beta, gamma: row.gamma, tMax: row.tMax }
    });
  } catch {
    return res.status(500).json({ success: false, message: 'DB 조회 오류' });
  }
});

// 12. 사용자 GTT 계수 저장/업데이트 API (MK3)
app.post('/api/user-weights', async (req: Request, res: Response): Promise<any> => {
  const { userId, alpha, beta, gamma, tMax } = req.body;
  if (!userId || [alpha, beta, gamma].some((v) => typeof v !== 'number' || isNaN(v))) {
    return res.status(400).json({ success: false, message: '요청값이 올바르지 않습니다.' });
  }
  try {
    await prisma.userWeight.upsert({
      where: { userId },
      create: { userId, alpha, beta, gamma, tMax: tMax ?? 0 },
      update: { alpha, beta, gamma, tMax: tMax ?? 0 },
    });
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ success: false, message: '저장 오류' });
  }
});

// 13. 저장된 경로 조회 API
app.get('/api/saved-routes/:userId', async (req: Request, res: Response): Promise<any> => {
  try {
    const rows = await prisma.savedRoute.findMany({
      where: { userId: req.params.userId },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ success: true, data: rows });
  } catch {
    return res.status(500).json({ success: false, message: 'DB 조회 오류' });
  }
});

// 14. 저장된 경로 추가 API
app.post('/api/saved-routes', async (req: Request, res: Response): Promise<any> => {
  const { userId, name, originName, originLat, originLng, attractionId, attractionName, attractionLat, attractionLng, legs, totalTimeMin } = req.body;
  if (!userId || !name || !originName || originLat == null || originLng == null || !attractionId || !attractionName || attractionLat == null || attractionLng == null || !legs) {
    return res.status(400).json({ success: false, message: '필수 파라미터 누락' });
  }
  try {
    const row = await prisma.savedRoute.create({
      data: { userId, name, originName, originLat, originLng, attractionId, attractionName, attractionLat, attractionLng, legs, totalTimeMin: totalTimeMin ?? 0 },
    });
    return res.json({ success: true, data: row });
  } catch {
    return res.status(500).json({ success: false, message: 'DB 오류' });
  }
});

// 15. 저장된 경로 이름 변경 API
app.patch('/api/saved-routes/:id', async (req: Request, res: Response): Promise<any> => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'name 필수' });
  try {
    const row = await prisma.savedRoute.update({ where: { id: req.params.id }, data: { name } });
    return res.json({ success: true, data: row });
  } catch {
    return res.status(500).json({ success: false, message: 'DB 오류' });
  }
});

// 16. 저장된 경로 삭제 API
app.delete('/api/saved-routes/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    await prisma.savedRoute.delete({ where: { id: req.params.id } });
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ success: false, message: 'DB 오류' });
  }
});

// OTP2는 별도 컨테이너로 동작하므로 사전 데이터 로드 불필요
app.listen(port, '0.0.0.0', () => {
  console.log(`[server]: Server is running at http://0.0.0.0:${port} (Accessible via network IP)`);
  console.log(`[server]: OTP2 endpoint: ${process.env.OTP_URL || 'http://localhost:8080'}`);
});
