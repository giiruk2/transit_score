'use client';

import { useState } from 'react';
import axios from 'axios';
import { calculateAhp, AhpInputs } from '@/utils/ahp';
import { Weights } from '@/hooks/useWeights';

interface Props {
  onComplete: (weights: Weights, cr: number) => void;
  onClose: () => void;
}

const PAIRS: { key: keyof AhpInputs; left: string; right: string }[] = [
  { key: 'a12', left: '이동 시간', right: '환승 횟수' },
  { key: 'a13', left: '이동 시간', right: '도보 부담' },
  { key: 'a14', left: '이동 시간', right: '대기 시간' },
  { key: 'a15', left: '이동 시간', right: '무장애 접근성' },
  { key: 'a23', left: '환승 횟수', right: '도보 부담' },
  { key: 'a24', left: '환승 횟수', right: '대기 시간' },
  { key: 'a25', left: '환승 횟수', right: '무장애 접근성' },
  { key: 'a34', left: '도보 부담', right: '대기 시간' },
  { key: 'a35', left: '도보 부담', right: '무장애 접근성' },
  { key: 'a45', left: '대기 시간', right: '무장애 접근성' },
];

// 1~9 척도 (왼쪽 중요 → 오른쪽 중요)
// 양수: 왼쪽이 더 중요, 음수: 오른쪽이 더 중요 (UI용)
const SCALE = [
  { value: -9, label: '9', side: 'right' },
  { value: -7, label: '7', side: 'right' },
  { value: -5, label: '5', side: 'right' },
  { value: -3, label: '3', side: 'right' },
  { value:  1, label: '1', side: 'center' },
  { value:  3, label: '3', side: 'left' },
  { value:  5, label: '5', side: 'left' },
  { value:  7, label: '7', side: 'left' },
  { value:  9, label: '9', side: 'left' },
];

// UI 값 → AHP 실수값 변환 (음수면 역수)
function toAhpValue(v: number): number {
  return v < 0 ? 1 / Math.abs(v) : v;
}

export default function WeightSurvey({ onComplete, onClose }: Props) {
  const [answers, setAnswers] = useState<Partial<Record<keyof AhpInputs, number>>>({});
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0); // 현재 질문 인덱스

  const current = PAIRS[step];
  const totalSteps = PAIRS.length;
  const answered = answers[current.key];

  const handleSelect = (value: number) => {
    setAnswers((prev) => ({ ...prev, [current.key]: value }));
  };

  const handleNext = () => {
    if (answered === undefined) return;
    if (step < totalSteps - 1) {
      setStep((s) => s + 1);
    } else {
      handleSubmit();
    }
  };

  const handlePrev = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const handleSubmit = async () => {
    const inputs = Object.fromEntries(
      PAIRS.map(({ key }) => [key, toAhpValue(answers[key] ?? 1)])
    ) as unknown as AhpInputs;

    const result = calculateAhp(inputs);

    if (!result.consistent) {
      setError(`응답이 일관되지 않습니다. (CR = ${result.cr.toFixed(3)}, 기준: 0.1 미만)\n처음부터 다시 응답해주세요.`);
      setStep(0);
      setAnswers({});
      return;
    }

    // 서버에 원본 응답 저장 (비동기, 실패해도 무시)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
    axios.post(`${apiUrl}/api/weights`, { ...inputs, cr: result.cr }).catch(() => {});

    onComplete(result.weights, result.cr);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)' }}
    >
      <div
        className="w-full max-w-lg rounded-2xl p-6 mx-4"
        style={{ background: 'var(--sidebar-bg)', border: '1px solid var(--sidebar-border)' }}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold" style={{ color: 'var(--sidebar-text)' }}>
            맞춤 가중치 설정
          </h2>
          <button onClick={onClose} style={{ color: 'var(--sidebar-text-muted)' }}>✕</button>
        </div>

        {/* 진행바 */}
        <div className="w-full h-1 rounded-full mb-5" style={{ background: 'var(--sidebar-surface)' }}>
          <div
            className="h-1 rounded-full transition-all"
            style={{ width: `${((step + 1) / totalSteps) * 100}%`, background: 'var(--accent)' }}
          />
        </div>

        {/* 오류 메시지 */}
        {error && (
          <div className="text-[11px] px-3 py-2 rounded-lg mb-4 whitespace-pre-line"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
            ⚠️ {error}
          </div>
        )}

        {/* 질문 */}
        <p className="text-[11px] mb-2 text-center" style={{ color: 'var(--sidebar-text-muted)' }}>
          {step + 1} / {totalSteps}
        </p>
        <p className="text-[13px] font-semibold text-center mb-5" style={{ color: 'var(--sidebar-text)' }}>
          대중교통 이용 시 어느 쪽이 더 불편하게 느껴지나요?
        </p>

        {/* 쌍대비교 UI */}
        <div className="flex items-center justify-between mb-6 gap-2">
          <span className="text-[13px] font-semibold w-20 text-right" style={{ color: 'var(--accent-light)' }}>
            {current.left}
          </span>

          <div className="flex gap-1">
            {SCALE.map(({ value, label, side }) => (
              <button
                key={value}
                onClick={() => handleSelect(value)}
                className="w-8 h-8 rounded-lg text-[11px] font-bold transition-all"
                style={{
                  background: answered === value
                    ? 'var(--accent)'
                    : 'var(--sidebar-surface)',
                  color: answered === value
                    ? '#fff'
                    : side === 'center'
                    ? 'var(--sidebar-text)'
                    : side === 'left'
                    ? 'var(--accent-light)'
                    : '#f87171',
                  border: `1px solid ${answered === value ? 'var(--accent)' : 'var(--sidebar-border)'}`,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <span className="text-[13px] font-semibold w-20 text-left" style={{ color: '#f87171' }}>
            {current.right}
          </span>
        </div>

        {/* 척도 설명 */}
        <div className="flex justify-between text-[10px] mb-6 px-2" style={{ color: 'var(--sidebar-text-muted)' }}>
          <span>← {current.left}이 중요</span>
          <span>동등</span>
          <span>{current.right}이 중요 →</span>
        </div>

        {/* 버튼 */}
        <div className="flex gap-2">
          <button
            onClick={handlePrev}
            disabled={step === 0}
            className="flex-1 py-2 rounded-xl text-[12px] font-semibold transition-all"
            style={{
              background: 'var(--sidebar-surface)',
              color: step === 0 ? 'var(--sidebar-text-muted)' : 'var(--sidebar-text)',
              border: '1px solid var(--sidebar-border)',
            }}
          >
            이전
          </button>
          <button
            onClick={handleNext}
            disabled={answered === undefined}
            className="flex-2 flex-grow py-2 rounded-xl text-[12px] font-semibold transition-all"
            style={{
              background: answered !== undefined ? 'var(--accent)' : 'var(--sidebar-surface)',
              color: answered !== undefined ? '#fff' : 'var(--sidebar-text-muted)',
              border: '1px solid var(--sidebar-border)',
            }}
          >
            {step === totalSteps - 1 ? '완료' : '다음'}
          </button>
        </div>
      </div>
    </div>
  );
}
