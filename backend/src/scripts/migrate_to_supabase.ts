import { PrismaClient } from '@prisma/client';
import mysql2 from 'mysql2/promise';

const supabase = new PrismaClient();

async function migrate() {
  const conn = await mysql2.createConnection('mysql://root@localhost:3306/transitscore');

  // 1. Attraction
  console.log('Attraction 마이그레이션...');
  const [attractions]: any = await conn.execute('SELECT * FROM Attraction');
  for (const a of attractions) {
    await supabase.attraction.upsert({
      where: { id: a.id },
      create: {
        id: a.id, contentId: a.contentId, name: a.name, address: a.address,
        lat: a.lat, lng: a.lng, imageUrl: a.imageUrl, description: a.description,
        phone: a.phone, homepage: a.homepage, accessScore: a.accessScore,
        createdAt: a.createdAt, updatedAt: a.updatedAt,
      },
      update: { accessScore: a.accessScore },
    });
  }
  console.log(`✅ Attraction ${attractions.length}개`);

  // 2. DongScore
  console.log('DongScore 마이그레이션...');
  const [dongScores]: any = await conn.execute('SELECT * FROM DongScore');
  for (const d of dongScores) {
    await supabase.dongScore.upsert({
      where: { dongKey_attractionId: { dongKey: d.dongKey, attractionId: d.attractionId } },
      create: {
        id: d.id, dongKey: d.dongKey, attractionId: d.attractionId,
        score: d.score, dongLat: d.dongLat, dongLng: d.dongLng, computedAt: d.computedAt,
      },
      update: { score: d.score },
    });
  }
  console.log(`✅ DongScore ${dongScores.length}개`);

  // 3. WeightResponse
  console.log('WeightResponse 마이그레이션...');
  const [weights]: any = await conn.execute('SELECT * FROM WeightResponse');
  for (const w of weights) {
    await supabase.weightResponse.upsert({
      where: { id: w.id },
      create: {
        id: w.id, a12: w.a12, a13: w.a13, a14: w.a14, a15: w.a15,
        a23: w.a23, a24: w.a24, a25: w.a25, a34: w.a34, a35: w.a35,
        a45: w.a45, cr: w.cr, createdAt: w.createdAt,
      },
      update: {},
    });
  }
  console.log(`✅ WeightResponse ${weights.length}개`);

  await conn.end();
  await supabase.$disconnect();
  console.log('🎉 마이그레이션 완료!');
}

migrate().catch(console.error);
