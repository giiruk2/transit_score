'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const res = await fetch(`${API_URL}/api/favorites/${user.id}`);
      const json = await res.json();
      if (json.success) setFavorites(new Set(json.data));
    };
    load();

    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session?.user) { setFavorites(new Set()); setUserId(null); }
      else load();
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const toggle = async (attractionId: string) => {
    if (!userId) return;
    const isFav = favorites.has(attractionId);
    setFavorites((prev) => {
      const next = new Set(prev);
      isFav ? next.delete(attractionId) : next.add(attractionId);
      return next;
    });
    await fetch(`${API_URL}/api/favorites`, {
      method: isFav ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, attractionId }),
    });
  };

  return { favorites, toggle, isLoggedIn: !!userId };
}
