'use client';

import { useState, useEffect } from 'react';
import { getUser, onAuthStateChange } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export interface SavedOrigin {
  id: string;
  name: string;
  lat: number;
  lng: number;
  dongKey?: string;
}

export function useSavedOrigins() {
  const [savedOrigins, setSavedOrigins] = useState<SavedOrigin[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const user = await getUser();
      if (!user) return;
      setUserId(user.id);
      const res = await fetch(`${API_URL}/api/saved-origins/${user.id}`);
      const json = await res.json();
      if (json.success) setSavedOrigins(json.data);
    };
    load();

    const unsubscribe = onAuthStateChange((user) => {
      if (!user) { setSavedOrigins([]); setUserId(null); }
      else load();
    });
    return unsubscribe;
  }, []);

  const save = async (origin: Omit<SavedOrigin, 'id'>) => {
    if (!userId) return;
    const res = await fetch(`${API_URL}/api/saved-origins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...origin }),
    });
    const json = await res.json();
    if (json.success) setSavedOrigins((prev) => [json.data, ...prev]);
  };

  const remove = async (id: string) => {
    await fetch(`${API_URL}/api/saved-origins/${id}`, { method: 'DELETE' });
    setSavedOrigins((prev) => prev.filter((o) => o.id !== id));
  };

  return { savedOrigins, save, remove, isLoggedIn: !!userId };
}
