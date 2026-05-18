'use client';

import { useState, useEffect } from 'react';
import { getUser, onAuthStateChange } from '@/lib/auth';
import type { RouteLeg } from '@/components/MapViewer';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export interface SavedRoute {
  id: string;
  name: string;
  originName: string;
  originLat: number;
  originLng: number;
  attractionId: string;
  attractionName: string;
  attractionLat: number;
  attractionLng: number;
  legs: RouteLeg[];
  totalTimeMin: number;
  createdAt: string;
}

export function useSavedRoutes() {
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const user = await getUser();
      if (!user) return;
      setUserId(user.id);
      const res = await fetch(`${API_URL}/api/saved-routes/${user.id}`);
      const json = await res.json();
      if (json.success) setSavedRoutes(json.data);
    };
    load();

    const unsubscribe = onAuthStateChange((user) => {
      if (!user) { setSavedRoutes([]); setUserId(null); }
      else load();
    });
    return unsubscribe;
  }, []);

  const save = async (route: Omit<SavedRoute, 'id' | 'createdAt'>) => {
    if (!userId) return null;
    const res = await fetch(`${API_URL}/api/saved-routes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...route }),
    });
    const json = await res.json();
    if (json.success) {
      setSavedRoutes((prev) => [json.data, ...prev]);
      return json.data as SavedRoute;
    }
    return null;
  };

  const rename = async (id: string, name: string) => {
    const res = await fetch(`${API_URL}/api/saved-routes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const json = await res.json();
    if (json.success) setSavedRoutes((prev) => prev.map((r) => r.id === id ? { ...r, name } : r));
  };

  const remove = async (id: string) => {
    await fetch(`${API_URL}/api/saved-routes/${id}`, { method: 'DELETE' });
    setSavedRoutes((prev) => prev.filter((r) => r.id !== id));
  };

  return { savedRoutes, save, rename, remove, isLoggedIn: !!userId };
}
