import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Seeding MySQL Database...");
  const dataPath = path.join(__dirname, '../../data/busan_attractions_raw.json');
  
  if (!fs.existsSync(dataPath)) {
    console.error("❌ 데이터를 찾을 수 없습니다:", dataPath);
    return;
  }

  const rawData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  const items = rawData.getAttractionKr?.item || [];

  let count = 0;
  for (const item of items) {
    const seqString = item.UC_SEQ.toString();
    // 중복 방지를 위한 upsert 로직 (contentId 기준)
    await prisma.attraction.upsert({
      where: { contentId: seqString },
      update: {
        name: item.MAIN_TITLE,
        address: item.ADDR1,
        lat: parseFloat(item.LAT),
        lng: parseFloat(item.LNG),
        imageUrl: item.MAIN_IMG_NORMAL,
        description: item.ITEMCNTNTS,
        phone: item.CNTCT_TEL || null,
        homepage: item.HOMEPAGE_URL || null,
      },
      create: {
        contentId: seqString,
        name: item.MAIN_TITLE,
        address: item.ADDR1,
        lat: parseFloat(item.LAT),
        lng: parseFloat(item.LNG),
        imageUrl: item.MAIN_IMG_NORMAL,
        description: item.ITEMCNTNTS,
        phone: item.CNTCT_TEL || null,
        homepage: item.HOMEPAGE_URL || null,
      }
    });
    count++;
  }

  console.log(`✅ 총 ${count} 개의 관광지 데이터가 MySQL (transitscore DB)에 성공적으로 적재되었습니다.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
