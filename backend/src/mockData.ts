export const mockAttractions = [
  {
    id: "uuid-1",
    name: "해운대해수욕장",
    address: "부산광역시 해운대구 해운대해변로 264",
    lat: 35.1586975,
    lng: 129.1603842,
    imageUrl: "https://via.placeholder.com/300x200?text=Haeundae",
    description: "부산의 대표적인 해수욕장입니다.",
    accessScore: 0.8
  },
  {
    id: "uuid-2",
    name: "감천문화마을",
    address: "부산광역시 사하구 감내2로 203",
    lat: 35.097481,
    lng: 129.010595,
    imageUrl: "https://via.placeholder.com/300x200?text=Gamcheon",
    description: "계단식 주거형태와 미로미로 골목길이 있는 마을",
    accessScore: 0.4
  },
  {
    id: "uuid-3",
    name: "태종대",
    address: "부산광역시 영도구 전망로 24",
    lat: 35.053051,
    lng: 129.087265,
    imageUrl: "https://via.placeholder.com/300x200?text=Taejongdae",
    description: "해안절경이 아름다운 유원지",
    accessScore: 0.6
  }
];

export const mockScores = [
  {
    attractionId: "uuid-1", // 해운대
    originName: "부산역",
    totalTimeMin: 38,
    transferCount: 1,
    walkDistanceM: 600,
    waitTimeMin: 4,
    finalScore: 76.4,
    breakdown: { s_time: 0.82, s_transfer: 0.75, s_walk: 0.50, s_wait: 0.80 }
  },
  {
    attractionId: "uuid-2", // 감천문화마을
    originName: "부산역",
    totalTimeMin: 35,
    transferCount: 1,
    walkDistanceM: 750,
    waitTimeMin: 8,
    finalScore: 68.9,
    breakdown: { s_time: 0.85, s_transfer: 0.75, s_walk: 0.38, s_wait: 0.60 }
  },
  {
    attractionId: "uuid-3", // 태종대
    originName: "부산역",
    totalTimeMin: 70,
    transferCount: 2,
    walkDistanceM: 850,
    waitTimeMin: 12,
    finalScore: 46.9,
    breakdown: { s_time: 0.50, s_transfer: 0.50, s_walk: 0.29, s_wait: 0.40 }
  }
];
