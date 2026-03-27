'use client';

import { useState, useEffect } from 'react';
import { getUser } from '@/lib/auth';

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
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export function useWeights() {
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const [isCustom, setIsCustom] = useState(false);

  useEffect(() => {
    const load = async () => {
      const user = await getUser();
      if (user) {
        try {
          const res = await fetch(`${API_URL}/api/user-weights/${user.id}`);
          const json = await res.json();
          if (json.success && json.data) {
            setWeights({ time: json.data.time, transfer: json.data.transfer, walk: json.data.walk, wait: json.data.wait, access: json.data.access });
            setIsCustom(true);
            return;
          }
        } catch { /* DB 실패 시 localStorage fallback */ }
      }
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setWeights(parsed.weights);
          setIsCustom(true);
        }
      } catch { /* 파싱 실패 시 기본값 유지 */ }
    };
    load();
  }, []);

  const saveWeights = async (newWeights: Weights, cr: number) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ weights: newWeights, cr, updatedAt: new Date().toISOString() }));
    setWeights(newWeights);
    setIsCustom(true);

    const user = await getUser();
    if (user) {
      fetch(`${API_URL}/api/user-weights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, ...newWeights, cr }),
      }).catch(() => {});
    }
  };

  const resetWeights = async () => {
    localStorage.removeItem(STORAGE_KEY);
    setWeights(DEFAULT_WEIGHTS);
    setIsCustom(false);

    const user = await getUser();
    if (user) {
      fetch(`${API_URL}/api/user-weights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, ...DEFAULT_WEIGHTS, cr: 0 }),
      }).catch(() => {});
    }
  };

  return { weights, isCustom, saveWeights, resetWeights };
}
