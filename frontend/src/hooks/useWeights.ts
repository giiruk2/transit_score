'use client';

import { useState, useEffect } from 'react';

export interface Weights {
  time: number;
  transfer: number;
  walk: number;
  wait: number;
  access: number;
}

export const DEFAULT_WEIGHTS: Weights = {
  time: 0.45,
  transfer: 0.20,
  walk: 0.15,
  wait: 0.10,
  access: 0.10,
};

const STORAGE_KEY = 'transitScore_weights';

export function useWeights() {
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const [isCustom, setIsCustom] = useState(false);

  // 로컬스토리지에서 저장된 가중치 로드
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setWeights(parsed.weights);
        setIsCustom(true);
      }
    } catch {
      // 파싱 실패 시 기본값 유지
    }
  }, []);

  // 가중치 저장 (AHP 완료 시 호출)
  const saveWeights = (newWeights: Weights, cr: number) => {
    const data = {
      weights: newWeights,
      cr,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setWeights(newWeights);
    setIsCustom(true);
  };

  // 기본 가중치로 초기화
  const resetWeights = () => {
    localStorage.removeItem(STORAGE_KEY);
    setWeights(DEFAULT_WEIGHTS);
    setIsCustom(false);
  };

  return { weights, isCustom, saveWeights, resetWeights };
}
