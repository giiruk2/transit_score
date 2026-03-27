import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

const CATEGORY_MAP: Record<string, string> = {
  '흰여울문화마을': '문화/예술',
  '깡깡이 예술마을': '문화/예술',
  '국립해양박물관': '박물관',
  '태종대': '자연',
  '죽성성당': '종교',
  '아홉산 숲': '자연',
  '해동용궁사': '종교',
  '임랑해수욕장': '바다/해변',
  '문화공감 수정': '문화/예술',
  '일광해수욕장': '바다/해변',
  '구 백제병원': '역사/전통',
  '백산기념관': '역사/전통',
  '한성1918': '문화/예술',
  '조선통신사역사관': '박물관',
  '부산해양자연사박물관': '박물관',
  '보수동책방골목': '문화/예술',
  '임시수도기념관': '역사/전통',
  '동아대석당박물관': '박물관',
  '국립일제강제동원역사관': '박물관',
  '부산박물관': '박물관',
  '유엔기념공원': '역사/전통',
  '오륙도': '자연',
  '신선대': '자연',
  '송정해수욕장': '바다/해변',
  '아난티 코브': '바다/해변',
  '민락수변공원': '바다/해변',
  '송도해수욕장': '바다/해변',
  '아미산전망대': '자연',
  '아미동 비석마을': '문화/예술',
  '부산시립미술관': '문화/예술',
  '오랑대공원': '자연',
  '국립수산과학관': '박물관',
  '요산문학관': '문화/예술',
  '박차정의사 생가': '역사/전통',
  '우장춘 기념관': '역사/전통',
  '누리바라기전망대': '자연',
  '최민식갤러리': '문화/예술',
  '수영사적공원': '역사/전통',
  '부산기상관측소': '박물관',
  '을숙도': '자연',
  '부산시청자미디어센터': '문화/예술',
  '구포어린이교통공원': '공원/레저',
  '부산솔로몬로파크': '공원/레저',
  '부산어촌민속관': '박물관',
  '삼락생태공원': '자연',
  '암남공원': '자연',
  '장림포구': '바다/해변',
  '가덕도': '자연',
  '렛츠런파크': '공원/레저',
  '국립부산과학관': '박물관',
  '송상현광장': '역사/전통',
  '어린이대공원': '공원/레저',
  '국립부산국악원': '문화/예술',
  '삼광사': '종교',
  '청사포': '바다/해변',
  '부산시민공원': '공원/레저',
  '호천마을': '문화/예술',
  '봉래산': '자연',
  '영화의 거리': '문화/예술',
  'APEC나루공원': '공원/레저',
  '40계단': '역사/전통',
  '감천문화마을': '문화/예술',
  '다대포 해수욕장': '바다/해변',
  '부산영화체험박물관': '박물관',
  '용두산공원': '문화/예술',
  '영도다리': '역사/전통',
  '중앙공원': '역사/전통',
  '황령산': '자연',
  'F1963': '문화/예술',
  '해운대': '바다/해변',
  '광안리해수욕장': '바다/해변',
  '금정산': '자연',
  '금강공원': '자연',
  '범어사': '종교',
  '동래읍성': '역사/전통',
  '상해거리': '문화/예술',
  '이중섭문화거리': '문화/예술',
  '복천박물관': '박물관',
  '벡스코': '문화/예술',
  '영화의 전당': '문화/예술',
  '장안사': '종교',
  '백양산': '자연',
  '성지곡수원지': '자연',
  '장산': '자연',
  '석불사': '종교',
  '동래향교': '역사/전통',
  '가덕도 연대봉': '자연',
  '승학산': '자연',
  '대룡마을': '문화/예술',
  '대신공원': '자연',
  '화명수목원': '자연',
  '선암사': '종교',
  '운수사': '종교',
  '스포원파크': '공원/레저',
  '우암동 소막마을': '문화/예술',
  '충렬사': '역사/전통',
  '부산커피박물관': '박물관',
  '사상생활사박물관': '박물관',
  '사직야구장': '공원/레저',
  '부산타워': '문화/예술',
};

function getCategory(title: string): string {
  for (const [keyword, category] of Object.entries(CATEGORY_MAP)) {
    if (title.includes(keyword)) return category;
  }
  return '기타';
}

async function main() {
  console.log('🚀 Seeding Database...');
  const dataPath = path.join(__dirname, '../../../data/enriched_attractions.json');

  if (!fs.existsSync(dataPath)) {
    console.error('❌ 데이터를 찾을 수 없습니다:', dataPath);
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
      console.warn(`⚠️ 좌표 오류 스킵: ${item.MAIN_TITLE}`);
      skipped++;
      continue;
    }

    const category = getCategory(item.MAIN_TITLE);

    await prisma.attraction.upsert({
      where: { contentId: seqString },
      update: {
        name: item.MAIN_TITLE,
        address: item.ADDR1,
        lat, lng,
        imageUrl: item.MAIN_IMG_NORMAL,
        description: item.ITEMCNTNTS,
        phone: item.CNTCT_TEL || null,
        homepage: item.HOMEPAGE_URL || null,
        accessScore: item.accessibility_score ?? 0.5,
        category,
      },
      create: {
        contentId: seqString,
        name: item.MAIN_TITLE,
        address: item.ADDR1,
        lat, lng,
        imageUrl: item.MAIN_IMG_NORMAL,
        description: item.ITEMCNTNTS,
        phone: item.CNTCT_TEL || null,
        homepage: item.HOMEPAGE_URL || null,
        accessScore: item.accessibility_score ?? 0.5,
        category,
      }
    });
    count++;
  }

  console.log(`✅ 총 ${count}개 관광지 적재 완료`);
  if (skipped > 0) console.warn(`⚠️ ${skipped}개 스킵`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
