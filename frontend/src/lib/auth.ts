/**
 * 인증 추상화 레이어
 * 인증 서비스를 교체할 때 이 파일만 수정하면 됩니다.
 * 현재 구현: Supabase Auth
 */

import { supabase } from './supabase';
import type { User } from '@supabase/supabase-js';

export type { User };

export type AuthStateCallback = (user: User | null) => void;

/** 현재 로그인된 유저 반환 (없으면 null) */
export async function getUser(): Promise<User | null> {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

/** 이메일/비밀번호 로그인 */
export async function signInWithEmail(email: string, password: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: '이메일 또는 비밀번호가 올바르지 않습니다.' };
  return { error: null };
}

/** 이메일/비밀번호 회원가입 */
export async function signUpWithEmail(email: string, password: string, name: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });
  if (error) return { error: error.message };
  return { error: null };
}

/** 구글 OAuth 로그인 */
export async function signInWithGoogle(): Promise<void> {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  });
}

/** 로그아웃 */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/** 인증 상태 변화 구독. 반환값(unsubscribe)을 cleanup에서 호출하세요. */
export function onAuthStateChange(callback: AuthStateCallback): () => void {
  const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
  return () => listener.subscription.unsubscribe();
}

/** OAuth 콜백 코드를 세션으로 교환 (서버 사이드) */
export async function exchangeCodeForSession(code: string): Promise<void> {
  await supabase.auth.exchangeCodeForSession(code);
}
