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
        <span className="text-[11px]" style={{ color: 'var(--panel-text-muted)' }}>
          {user.user_metadata?.name ?? user.email}
        </span>
        <button
          onClick={signOut}
          className="text-[10px] px-2 py-1 rounded-lg transition-all"
          style={{
            background: 'var(--panel-surface)',
            color: 'var(--panel-text-muted)',
            border: '1px solid var(--panel-border)',
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
          background: 'var(--accent)',
          color: '#fff',
          border: 'none',
        }}
      >
        로그인
      </button>
      {showModal && <AuthModal onClose={() => setShowModal(false)} />}
    </>
  );
}
