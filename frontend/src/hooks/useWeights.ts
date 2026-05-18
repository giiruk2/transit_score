'use client';

import { useState, useEffect } from 'react';
import { getUser } from '@/lib/auth';

export interface GttCoefficients {
  alpha: number;   // 도보 배율 (기본 2.0)
  beta:  number;   // 대기 배율 (기본 2.5)
  gamma: number;   // 환승 패널티/회 (기본 13분)
  tMax:  number;   // 최대 이동시간 제한 (분, 0=제한없음, totalTimeMin 기준)
}

export const DEFAULT_COEFFICIENTS: GttCoefficients = {
  alpha: 2.0,
  beta:  2.5,
  gamma: 13,
  tMax:  0,
};

const STORAGE_KEY = 'transitScore_gtt_coefficients';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export function useWeights() {
  const [coefficients, setCoefficients] = useState<GttCoefficients>(DEFAULT_COEFFICIENTS);
  const [isCustom, setIsCustom] = useState(false);

  useEffect(() => {
    const load = async () => {
      const user = await getUser();
      if (user) {
        try {
          const res = await fetch(`${API_URL}/api/user-weights/${user.id}`);
          const json = await res.json();
          if (json.success && json.data) {
            setCoefficients({
              alpha: json.data.alpha,
              beta:  json.data.beta,
              gamma: json.data.gamma,
              tMax:  json.data.tMax ?? 0,
            });
            setIsCustom(true);
            return;
          }
        } catch { /* DB 실패 시 localStorage fallback */ }
      }
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setCoefficients(parsed);
          setIsCustom(true);
        }
      } catch { /* 파싱 실패 시 기본값 유지 */ }
    };
    load();
  }, []);

  const saveCoefficients = async (newCoefficients: GttCoefficients) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newCoefficients));
    setCoefficients(newCoefficients);
    setIsCustom(true);

    const user = await getUser();
    if (user) {
      fetch(`${API_URL}/api/user-weights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, ...newCoefficients }),
      }).catch(() => {});
    }
  };

  const resetCoefficients = async () => {
    localStorage.removeItem(STORAGE_KEY);
    setCoefficients(DEFAULT_COEFFICIENTS);
    setIsCustom(false);

    const user = await getUser();
    if (user) {
      fetch(`${API_URL}/api/user-weights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, ...DEFAULT_COEFFICIENTS }),
      }).catch(() => {});
    }
  };

  return { coefficients, isCustom, saveCoefficients, resetCoefficients };
}
