'use client';

import { useState } from 'react';
import { signInWithEmail, signUpWithEmail, signInWithGoogle } from '@/lib/auth';

interface AuthModalProps {
  onClose: () => void;
}

export default function AuthModal({ onClose }: AuthModalProps) {
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const handleLogin = async () => {
    if (!email || !password) return setMessage({ type: 'error', text: '이메일과 비밀번호를 입력해주세요.' });
    setLoading(true);
    setMessage(null);
    const { error } = await signInWithEmail(email, password);
    setLoading(false);
    if (error) return setMessage({ type: 'error', text: error });
    onClose();
  };

  const handleSignup = async () => {
    if (!email || !password || !name) return setMessage({ type: 'error', text: '모든 항목을 입력해주세요.' });
    if (password.length < 6) return setMessage({ type: 'error', text: '비밀번호는 6자 이상이어야 합니다.' });
    setLoading(true);
    setMessage(null);
    const { error } = await signUpWithEmail(email, password, name);
    setLoading(false);
    if (error) return setMessage({ type: 'error', text: error });
    setMessage({ type: 'success', text: '가입 완료! 이메일 인증 후 로그인해주세요.' });
  };

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-80 rounded-2xl p-6"
        style={{ background: 'var(--sidebar-bg)', border: '1px solid var(--sidebar-border)' }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold" style={{ color: 'var(--sidebar-text)' }}>TransitScore</h2>
          <button onClick={onClose} style={{ color: 'var(--sidebar-text-muted)' }}>✕</button>
        </div>

        <div className="flex mb-5 rounded-lg overflow-hidden" style={{ background: 'var(--sidebar-surface)' }}>
          {(['login', 'signup'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setMessage(null); }}
              className="flex-1 py-2 text-[12px] font-semibold transition-all"
              style={{
                background: tab === t ? 'var(--accent)' : 'transparent',
                color: tab === t ? '#fff' : 'var(--sidebar-text-muted)',
              }}
            >
              {t === 'login' ? '로그인' : '회원가입'}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2.5">
          {tab === 'signup' && (
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름"
              className="w-full px-3 py-2.5 rounded-lg text-[12px] text-white placeholder-gray-500 outline-none"
              style={{ background: 'var(--sidebar-surface)', border: '1px solid var(--sidebar-border)' }}
            />
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (tab === 'login' ? handleLogin() : handleSignup())}
            placeholder="이메일"
            className="w-full px-3 py-2.5 rounded-lg text-[12px] text-white placeholder-gray-500 outline-none"
            style={{ background: 'var(--sidebar-surface)', border: '1px solid var(--sidebar-border)' }}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (tab === 'login' ? handleLogin() : handleSignup())}
            placeholder="비밀번호 (6자 이상)"
            className="w-full px-3 py-2.5 rounded-lg text-[12px] text-white placeholder-gray-500 outline-none"
            style={{ background: 'var(--sidebar-surface)', border: '1px solid var(--sidebar-border)' }}
          />

          {message && (
            <p className="text-[11px] px-2" style={{ color: message.type === 'error' ? 'var(--score-poor)' : '#22c55e' }}>
              {message.text}
            </p>
          )}

          <button
            onClick={tab === 'login' ? handleLogin : handleSignup}
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-[12px] font-semibold transition-all"
            style={{ background: 'var(--accent)', color: '#fff', opacity: loading ? 0.6 : 1 }}
          >
            {loading ? '...' : tab === 'login' ? '로그인' : '회원가입'}
          </button>

          <div className="flex items-center gap-2 my-1">
            <div className="flex-1 h-px" style={{ background: 'var(--sidebar-border)' }} />
            <span className="text-[10px]" style={{ color: 'var(--sidebar-text-muted)' }}>또는</span>
            <div className="flex-1 h-px" style={{ background: 'var(--sidebar-border)' }} />
          </div>

          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-[12px] font-medium transition-all"
            style={{
              background: 'rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.75)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            구글로 계속하기
          </button>
        </div>
      </div>
    </div>
  );
}
