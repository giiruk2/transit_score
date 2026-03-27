'use client';

import { useEffect, useState } from 'react';
import { getUser, signOut, onAuthStateChange, type User } from '@/lib/auth';
import AuthModal from './AuthModal';

export default function LoginButton() {
  const [user, setUser] = useState<User | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    getUser().then(setUser);
    const unsubscribe = onAuthStateChange((u) => {
      setUser(u);
      if (u) setShowModal(false);
    });
    return unsubscribe;
  }, []);

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[11px]" style={{ color: 'var(--sidebar-text-muted)' }}>
          {user.user_metadata?.name ?? user.email}
        </span>
        <button
          onClick={signOut}
          className="text-[10px] px-2 py-1 rounded-lg transition-all"
          style={{
            background: 'rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.5)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          로그아웃
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="text-[11px] px-3 py-1.5 rounded-lg font-medium transition-all"
        style={{
          background: 'rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.75)',
          border: '1px solid rgba(255,255,255,0.12)',
        }}
      >
        로그인
      </button>
      {showModal && <AuthModal onClose={() => setShowModal(false)} />}
    </>
  );
}
