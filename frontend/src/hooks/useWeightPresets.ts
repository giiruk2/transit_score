'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Weights } from './useWeights';

export interface WeightPreset {
  id: string;
  name: string;
  weights: Weights;
  savedAt: string;
}

const STORAGE_KEY = 'transitScore_weightPresets';

export function useWeightPresets() {
  const [presets, setPresets] = useState<WeightPreset[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setPresets(JSON.parse(stored));
    } catch {}
  }, []);

  const persist = (next: WeightPreset[]) => {
    setPresets(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const savePreset = useCallback((name: string, weights: Weights) => {
    const preset: WeightPreset = {
      id: `preset_${Date.now()}`,
      name,
      weights,
      savedAt: new Date().toISOString(),
    };
    setPresets((prev) => {
      const next = [preset, ...prev];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    return preset.id;
  }, []);

  const renamePreset = useCallback((id: string, name: string) => {
    setPresets((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, name } : p));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const deletePreset = useCallback((id: string) => {
    setPresets((prev) => {
      const next = prev.filter((p) => p.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { presets, savePreset, renamePreset, deletePreset };
}
