'use client';

import { useState, useEffect, useCallback } from 'react';
import { getUser, onAuthStateChange } from '@/lib/auth';
import type { Weights } from './useWeights';

export interface WeightPreset {
  id: string;
  name: string;
  weights: Weights;
  savedAt: string;
}

function storageKey(userId: string) {
  return `transitScore_weightPresets_${userId}`;
}

export function useWeightPresets() {
  const [presets, setPresets] = useState<WeightPreset[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const user = await getUser();
      if (!user) { setPresets([]); setUserId(null); return; }
      setUserId(user.id);
      try {
        const stored = localStorage.getItem(storageKey(user.id));
        if (stored) setPresets(JSON.parse(stored));
      } catch {}
    };
    load();

    const unsubscribe = onAuthStateChange((user) => {
      if (!user) { setPresets([]); setUserId(null); return; }
      setUserId(user.id);
      try {
        const stored = localStorage.getItem(storageKey(user.id));
        setPresets(stored ? JSON.parse(stored) : []);
      } catch { setPresets([]); }
    });
    return unsubscribe;
  }, []);

  const persist = useCallback((next: WeightPreset[], uid: string) => {
    setPresets(next);
    localStorage.setItem(storageKey(uid), JSON.stringify(next));
  }, []);

  const savePreset = useCallback((name: string, weights: Weights) => {
    if (!userId) return null;
    const preset: WeightPreset = {
      id: `preset_${Date.now()}`,
      name,
      weights,
      savedAt: new Date().toISOString(),
    };
    setPresets((prev) => {
      const next = [preset, ...prev];
      localStorage.setItem(storageKey(userId), JSON.stringify(next));
      return next;
    });
    return preset.id;
  }, [userId]);

  const renamePreset = useCallback((id: string, name: string) => {
    if (!userId) return;
    setPresets((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, name } : p));
      localStorage.setItem(storageKey(userId), JSON.stringify(next));
      return next;
    });
  }, [userId]);

  const deletePreset = useCallback((id: string) => {
    if (!userId) return;
    setPresets((prev) => {
      const next = prev.filter((p) => p.id !== id);
      localStorage.setItem(storageKey(userId), JSON.stringify(next));
      return next;
    });
  }, [userId]);

  return { presets, savePreset, renamePreset, deletePreset, isLoggedIn: !!userId };
}
