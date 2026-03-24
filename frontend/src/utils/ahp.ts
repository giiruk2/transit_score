// AHP (Analytic Hierarchy Process) 계산 유틸
// 방법론: Saaty, T.L. (1980). The Analytic Hierarchy Process. McGraw-Hill.

export interface AhpInputs {
  a12: number; // 이동시간 vs 환승
  a13: number; // 이동시간 vs 도보
  a14: number; // 이동시간 vs 대기
  a15: number; // 이동시간 vs 접근성
  a23: number; // 환승 vs 도보
  a24: number; // 환승 vs 대기
  a25: number; // 환승 vs 접근성
  a34: number; // 도보 vs 대기
  a35: number; // 도보 vs 접근성
  a45: number; // 대기 vs 접근성
}

export interface AhpResult {
  weights: {
    time: number;
    transfer: number;
    walk: number;
    wait: number;
    access: number;
  };
  cr: number;
  consistent: boolean; // CR < 0.2
}

// n=5일 때 Saaty의 랜덤 일관성 지수
const RI = 1.12;

export function calculateAhp(inputs: AhpInputs): AhpResult {
  const { a12, a13, a14, a15, a23, a24, a25, a34, a35, a45 } = inputs;

  // Step 1 — 5×5 쌍대비교 행렬 구성 (역수 자동 채움)
  const A: number[][] = [
    [1,       a12,     a13,     a14,     a15    ],
    [1/a12,   1,       a23,     a24,     a25    ],
    [1/a13,   1/a23,   1,       a34,     a35    ],
    [1/a14,   1/a24,   1/a34,   1,       a45    ],
    [1/a15,   1/a25,   1/a35,   1/a45,   1      ],
  ];

  const n = 5;

  // Step 2 — 열 합산
  const colSums = Array(n).fill(0);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      colSums[j] += A[i][j];
    }
  }

  // Step 3 — 열 정규화
  const normalized: number[][] = A.map((row) =>
    row.map((val, j) => val / colSums[j])
  );

  // Step 4 — 행 평균 = 가중치 벡터
  const w = normalized.map((row) => row.reduce((sum, v) => sum + v, 0) / n);

  // Step 5 — λmax 계산
  const Aw = Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      Aw[i] += A[i][j] * w[j];
    }
  }
  const lambdaMax = Aw.reduce((sum, val, i) => sum + val / w[i], 0) / n;

  // Step 6 — 일관성 지수 및 CR 계산
  const ci = (lambdaMax - n) / (n - 1);
  const cr = ci / RI;

  return {
    weights: {
      time:     parseFloat(w[0].toFixed(4)),
      transfer: parseFloat(w[1].toFixed(4)),
      walk:     parseFloat(w[2].toFixed(4)),
      wait:     parseFloat(w[3].toFixed(4)),
      access:   parseFloat(w[4].toFixed(4)),
    },
    cr: parseFloat(cr.toFixed(4)),
    consistent: cr < 0.2,
  };
}
