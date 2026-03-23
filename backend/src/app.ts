import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { fetchOdsayRoute } from './services/routeService';
import { calculateAccessibilityScore, DEFAULT_WEIGHTS, Weights } from './services/score';
import { mockAttractions, mockScores } from './mockData';

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

// 3. AHP 설문 응답 저장 API
app.post('/api/weights', async (req: Request, res: Response): Promise<any> => {
  const { a12, a13, a14, a15, a23, a24, a25, a34, a35, a45, cr } = req.body;

  const fields = [a12, a13, a14, a15, a23, a24, a25, a34, a35, a45, cr];
  if (fields.some((v) => typeof v !== 'number' || isNaN(v))) {
    return res.status(400).json({ success: false, message: '응답값이 올바르지 않습니다.' });
  }
  if (cr >= 0.1) {
    return res.status(400).json({ success: false, message: 'CR이 0.1 이상인 응답은 저장되지 않습니다.' });
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
