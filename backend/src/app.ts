import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { fetchOdsayRoute } from './services/routeService';
import { calculateAccessibilityScore } from './services/score';
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

  // 2. ODsay 대중교통 경로 탐색 API 호출
  const routeResult = await fetchOdsayRoute(originLat, originLng, destLat, destLng);
  
  if (!routeResult.success) {
    return res.status(502).json({
      success: false,
      message: routeResult.message || "ODsay 경로 탐색 실패"
    });
  }

  // 3. 경로 데이터를 바탕으로 0~100점 정규화 가중합 산출
  const scoreResult = calculateAccessibilityScore(routeResult);

  // 4. 최종 결과 반환
  return res.json({
    success: true,
    data: {
      attractionId, // 숫자가 아니라 문자열(string)로 반환하거나 원본 유지
      originLocation: { lat: originLat, lng: originLng },
      scoreDetails: scoreResult
    }
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`[server]: Server is running at http://0.0.0.0:${port} (Accessible via network IP)`);
});
