import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Seeding MySQL Database...");
  const dataPath = path.join(__dirname, '../../../data/enriched_attractions.json');

  if (!fs.existsSync(dataPath)) {
    console.error("❌ 데이터를 찾을 수 없습니다:", dataPath);
    console.error("   먼저 scoreAccessibility.ts를 실행하세요: npx ts-node src/scripts/scoreAccessibility.ts");
    return;
  }

  const enrichedData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  const items = enrichedData.items || [];

  let count = 0;
  let skipped = 0;
  for (const item of items) {
    const seqString = item.UC_SEQ?.toString();
    const lat = parseFloat(item.LAT);
    const lng = parseFloat(item.LNG);

    if (!seqString || isNaN(lat) || isNaN(lng)) {
      console.warn(`⚠️ 좌표 오류 스킵: ${item.MAIN_TITLE} (LAT: ${item.LAT}, LNG: ${item.LNG})`);
      skipped++;
      continue;
    }

    // 중복 방지를 위한 upsert 로직 (contentId 기준)
    await prisma.attraction.upsert({
      where: { contentId: seqString },
      update: {
        name: item.MAIN_TITLE,
        address: item.ADDR1,
        lat,
        lng,
        imageUrl: item.MAIN_IMG_NORMAL,
        description: item.ITEMCNTNTS,
        phone: item.CNTCT_TEL || null,
        homepage: item.HOMEPAGE_URL || null,
        accessScore: item.accessibility_score ?? 0.5,
      },
      create: {
        contentId: seqString,
        name: item.MAIN_TITLE,
        address: item.ADDR1,
        lat,
        lng,
        imageUrl: item.MAIN_IMG_NORMAL,
        description: item.ITEMCNTNTS,
        phone: item.CNTCT_TEL || null,
        homepage: item.HOMEPAGE_URL || null,
        accessScore: item.accessibility_score ?? 0.5,
      }
    });
    count++;
  }

  console.log(`✅ 총 ${count} 개의 관광지 데이터가 MySQL (transitscore DB)에 성공적으로 적재되었습니다.`);
  if (skipped > 0) console.warn(`⚠️ 좌표 오류로 ${skipped}개 항목 스킵됨`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
