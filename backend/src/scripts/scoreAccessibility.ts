/**
 * 무장애 접근성 점수 재채점 스크립트
 *
 * MIDDLE_SIZE_RM1 필드의 키워드를 기반으로 0.0~1.0 접근성 점수를 산출한다.
 * 계획서(document/upgrade-plan/알고리즘_계획서.md) 5.1절 가중합 모델을 준용.
 *
 * 실행: cd backend && npx ts-node src/scripts/scoreAccessibility.ts
 */

import fs from 'fs';
import path from 'path';

// ─────────────────────────────────────────────
// 1. 키워드 가중치 정의
// ─────────────────────────────────────────────

const POSITIVE_RULES: { keywords: string[]; score: number }[] = [
  // 엘리베이터 — 가장 결정적 요소 (독립 수직 이동 가능)
  { keywords: ['장애인전용엘리베이터', '장애인전용 엘리베이터', '장애인 엘리베이터', '엘리베이터'], score: 0.30 },

  // 저상버스 — 휠체어/유모차 승차 가능
  { keywords: ['저상버스'], score: 0.15 },

  // 휠체어리프트 — 엘리베이터 대안 (역무원 호출 필요, 낮은 가중치)
  { keywords: ['휠체어리프트', '휠체어 리프트'], score: 0.15 },

  // 점자 안내 — 시각장애인 접근성
  { keywords: ['점자블록', '점자 블록', '점자안내판', '점자안내', '점자손잡이'], score: 0.10 },

  // 장애인 화장실
  { keywords: ['장애인전용화장실', '장애인전용 화장실', '장애인용 화장실', '장애인 화장실', '장애인화장실'], score: 0.10 },

  // 경사로
  { keywords: ['경사로'], score: 0.05 },

  // 휠체어 대여
  { keywords: ['휠체어 무료대여', '휠체어 무료 대여', '휠체어대여', '휠체어 대여'], score: 0.05 },

  // 안내견 동반
  { keywords: ['안내견 동반', '안내견동반'], score: 0.05 },

  // 음성 안내
  { keywords: ['음성안내', '오디오가이드', '전시음성안내'], score: 0.05 },
];

// 휠체어 접근은 "일부구간" 여부에 따라 점수가 다름 — 별도 처리
const WHEELCHAIR_ACCESS_FULL = ['휠체어접근 가능', '휠체어 접근 가능', '휠체어통행 가능', '휠체어접근가능'];
const WHEELCHAIR_ACCESS_PARTIAL_TRIGGER = ['일부구간', '일부 구간', '일부구간 휠체어', '일부 구간 휠체어'];

const PENALTY_RULES: { keywords: string[]; score: number }[] = [
  { keywords: ['좁아 불편', '불편할 수 있'], score: -0.15 },
];

// ─────────────────────────────────────────────
// 2. 점수 산출 함수
// ─────────────────────────────────────────────

function calcAccessibilityScore(rm1: string): number {
  const text = rm1.trim();

  // 정보 없음 → 중립값 0.5 (알 수 없음)
  if (!text) return 0.5;

  let score = 0;

  // 가산점: 일반 키워드
  for (const rule of POSITIVE_RULES) {
    if (rule.keywords.some(kw => text.includes(kw))) {
      score += rule.score;
    }
  }

  // 가산점: 휠체어 접근 (부분 접근인지 전체 접근인지 구분)
  const isPartial = WHEELCHAIR_ACCESS_PARTIAL_TRIGGER.some(kw => text.includes(kw));
  const hasWheelchair = WHEELCHAIR_ACCESS_FULL.some(kw => text.includes(kw));

  if (isPartial) {
    score += 0.05; // 일부 구간만 접근 가능
  } else if (hasWheelchair) {
    score += 0.20; // 전체 접근 가능
  }

  // 감점: 패널티 키워드
  for (const rule of PENALTY_RULES) {
    if (rule.keywords.some(kw => text.includes(kw))) {
      score += rule.score; // 음수값
    }
  }

  // 0.0 ~ 1.0 범위로 clamp, 소수점 2자리 반올림
  return Math.round(Math.min(1.0, Math.max(0.0, score)) * 100) / 100;
}

// ─────────────────────────────────────────────
// 3. 메인 실행
// ─────────────────────────────────────────────

const main = () => {
  const rawPath = path.join(__dirname, '../../data/busan_attractions_raw.json');
  const outPath = path.join(__dirname, '../../../data/enriched_attractions.json');

  if (!fs.existsSync(rawPath)) {
    console.error('❌ busan_attractions_raw.json 파일이 없습니다. fetchAttractions.ts를 먼저 실행하세요.');
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(rawPath, 'utf-8'));
  const items: any[] = raw?.getAttractionKr?.item ?? [];

  if (items.length === 0) {
    console.error('❌ 데이터가 비어 있습니다.');
    process.exit(1);
  }

  console.log(`🔍 총 ${items.length}개 관광지 접근성 점수 재채점 시작...`);

  // 점수 분포 집계용
  const distribution: Record<string, number> = {};

  const enriched = items.map((item: any) => {
    const rm1: string = item.MIDDLE_SIZE_RM1 ?? '';
    const score = calcAccessibilityScore(rm1);

    // 분포 집계 (0.1 단위 버킷)
    const bucket = (Math.floor(score * 10) / 10).toFixed(1);
    distribution[bucket] = (distribution[bucket] ?? 0) + 1;

    return { ...item, accessibility_score: score };
  });

  // 저장
  const out = {
    metadata: {
      total: enriched.length,
      updatedAt: new Date().toISOString(),
      scoringVersion: '2.0',
      description: 'MIDDLE_SIZE_RM1 키워드 기반 재채점. 계획서 5.1절 가중합 모델 준용.',
    },
    items: enriched,
  };

  const outDir = path.dirname(outPath);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf-8');

  // 결과 출력
  console.log(`✅ 재채점 완료 → ${outPath}`);
  console.log('\n📊 점수 분포:');
  Object.keys(distribution).sort().forEach(k => {
    const bar = '█'.repeat(distribution[k]);
    console.log(`  ${k}점: ${bar} (${distribution[k]}개)`);
  });

  // 의심 케이스 출력 (rm1 없는데 0.5 아닌 경우 → 없어야 정상)
  const suspicious = enriched.filter((i: any) =>
    (!i.MIDDLE_SIZE_RM1 || i.MIDDLE_SIZE_RM1.trim() === '') && i.accessibility_score !== 0.5
  );
  if (suspicious.length > 0) {
    console.warn('\n⚠️ 이상 케이스 (rm1 없는데 0.5가 아님):');
    suspicious.forEach((i: any) => console.warn(`  - ${i.MAIN_TITLE}: ${i.accessibility_score}`));
  }
};

main();
