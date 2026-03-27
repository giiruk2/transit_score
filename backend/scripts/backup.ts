import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

async function main() {
  const [attractions, dongScores, scoreSnapshots, weightResponses, userWeights, savedOrigins, favoriteAttractions] =
    await Promise.all([
      prisma.attraction.findMany(),
      prisma.dongScore.findMany(),
      prisma.scoreSnapshot.findMany(),
      prisma.weightResponse.findMany(),
      prisma.userWeight.findMany(),
      prisma.savedOrigin.findMany(),
      prisma.favoriteAttraction.findMany(),
    ]);

  const backup = {
    createdAt: new Date().toISOString(),
    counts: {
      attractions: attractions.length,
      dongScores: dongScores.length,
      scoreSnapshots: scoreSnapshots.length,
      weightResponses: weightResponses.length,
      userWeights: userWeights.length,
      savedOrigins: savedOrigins.length,
      favoriteAttractions: favoriteAttractions.length,
    },
    data: { attractions, dongScores, scoreSnapshots, weightResponses, userWeights, savedOrigins, favoriteAttractions },
  };

  const date = new Date().toISOString().slice(0, 10);
  const outPath = join(__dirname, '../../data', `backup_${date}.json`);
  writeFileSync(outPath, JSON.stringify(backup, null, 2), 'utf-8');

  console.log(`✅ 백업 완료: data/backup_${date}.json`);
  console.table(backup.counts);
}

main()
  .catch((e) => { console.error('❌ 백업 실패:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
