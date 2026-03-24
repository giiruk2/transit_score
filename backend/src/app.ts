import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { fetchOdsayRoute } from './services/routeService';
import { calculateAccessibilityScore, DEFAULT_WEIGHTS, Weights } from './services/score';
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

// 1. 관광지 목록 반환 API (Prisma MySQL 조회)
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

// 2. 단건 관광지에 대한 접근성 점수 분석 API (ODsay 실시간 경로 탐색 연동)
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

  // 2. DB에서 관광지의 무장애 점수 조회
  let accessScore = 0.5;
  try {
    const attraction = await prisma.attraction.findFirst({
      where: { OR: [{ contentId: attractionId }, { id: attractionId }] },
      select: { accessScore: true }
    });
    if (attraction) accessScore = attraction.accessScore;
  } catch (_) {
    // DB 조회 실패 시 기본값 0.5 유지
  }

  // 3. ODsay 대중교통 경로 탐색 API 호출
  let routeResult;
  try {
    routeResult = await fetchOdsayRoute(originLat, originLng, destLat, destLng);
  } catch (error) {
    console.error('fetchOdsayRoute 예외:', error);
    return res.status(500).json({ success: false, message: '경로 탐색 중 서버 오류가 발생했습니다.' });
  }

  // 4. 가중치 파라미터 파싱 (없으면 기본값 사용)
  let weights: Weights = DEFAULT_WEIGHTS;
  const wTime     = parseFloat(req.query.w_time as string);
  const wTransfer = parseFloat(req.query.w_transfer as string);
  const wWalk     = parseFloat(req.query.w_walk as string);
  const wWait     = parseFloat(req.query.w_wait as string);
  const wAccess   = parseFloat(req.query.w_access as string);

  if (![wTime, wTransfer, wWalk, wWait, wAccess].some(isNaN)) {
    const sum = wTime + wTransfer + wWalk + wWait + wAccess;
    if (Math.abs(sum - 1.0) > 0.01) {
      return res.status(400).json({ success: false, message: '가중치 합이 1.0이어야 합니다.' });
    }
    weights = { time: wTime, transfer: wTransfer, walk: wWalk, wait: wWait, access: wAccess };
  }

  // 5. 경로 데이터를 바탕으로 0~100점 정규화 가중합 산출
  const scoreResult = calculateAccessibilityScore(routeResult, accessScore, weights);

  // 6. 최종 결과 반환
  return res.json({
    success: true,
    data: {
      attractionId,
      originLocation: { lat: originLat, lng: originLng },
      scoreDetails: scoreResult
    }
  });
});

// 3. 동별 관광지 점수 조회 API
// GET /api/dong-scores?dong=해운대구 중동
// - DB에 캐시된 점수 반환
// - 누락된 관광지는 ODsay로 계산 후 DB 저장
app.get('/api/dong-scores', async (req: Request, res: Response): Promise<any> => {
  const dongKey = req.query.dong as string;
  if (!dongKey) {
    return res.status(400).json({ success: false, message: 'dong 파라미터가 필요합니다.' });
  }

  const center = dongCenters[dongKey];
  if (!center) {
    return res.status(404).json({ success: false, message: `'${dongKey}'의 중심좌표를 찾을 수 없습니다.` });
  }

  // 전체 관광지 목록 조회
  let allAttractions: { id: string; lat: number; lng: number; accessScore: number }[] = [];
  try {
    allAttractions = await prisma.attraction.findMany({
      select: { id: true, lat: true, lng: true, accessScore: true }
    });
  } catch {
    return res.status(500).json({ success: false, message: 'DB 조회 오류' });
  }

  if (allAttractions.length === 0) {
    return res.json({ success: true, data: {} });
  }

  // DB에서 이미 계산된 점수 조회
  const existing = await prisma.dongScore.findMany({ where: { dongKey } });
  const cachedMap: Record<string, number> = {};
  existing.forEach((row) => { cachedMap[row.attractionId] = row.score; });

  // 누락된 관광지만 계산 (ODsay 쿼터 절약)
  const missing = allAttractions.filter((a) => cachedMap[a.id] === undefined);

  if (missing.length > 0) {
    // 5개씩 병렬 처리
    const BATCH = 5;
    for (let i = 0; i < missing.length; i += BATCH) {
      const batch = missing.slice(i, i + BATCH);
      await Promise.all(batch.map(async (attraction) => {
        try {
          const route = await fetchOdsayRoute(center.lat, center.lng, attraction.lat, attraction.lng);
          const result = calculateAccessibilityScore(route, attraction.accessScore);
          await prisma.dongScore.upsert({
            where: { dongKey_attractionId: { dongKey, attractionId: attraction.id } },
            create: { dongKey, attractionId: attraction.id, score: result.finalScore, dongLat: center.lat, dongLng: center.lng },
            update: { score: result.finalScore, dongLat: center.lat, dongLng: center.lng, computedAt: new Date() }
          });
          cachedMap[attraction.id] = result.finalScore;
        } catch {
          // 단건 실패는 건너뜀
        }
      }));
    }
  }

  return res.json({ success: true, data: cachedMap });
});

// 4. AHP 설문 응답 저장 API
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

app.listen(port, '0.0.0.0', () => {
  console.log(`[server]: Server is running at http://0.0.0.0:${port} (Accessible via network IP)`);
});
