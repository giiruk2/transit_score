'use client';

import { useState } from 'react';
import { GttCoefficients, DEFAULT_COEFFICIENTS } from '@/hooks/useWeights';

interface Props {
  onComplete: (coefficients: GttCoefficients) => void;
  onClose: () => void;
}

const TMAX_OPTIONS = [
  { label: '제한없음', value: 0 },
  { label: '30분',    value: 30 },
  { label: '60분',    value: 60 },
  { label: '90분',    value: 90 },
];

export default function WeightSurvey({ onComplete, onClose }: Props) {
  const [draft, setDraft] = useState<GttCoefficients>(DEFAULT_COEFFICIENTS);

  const handleApply = () => {
    onComplete(draft);
  };

  const handleReset = () => {
    setDraft(DEFAULT_COEFFICIENTS);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)' }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 mx-4"
        style={{ background: 'var(--sidebar-bg)', border: '1px solid var(--sidebar-border)' }}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold" style={{ color: 'var(--sidebar-text)' }}>
            이동 조건 설정
          </h2>
          <button onClick={onClose} style={{ color: 'var(--sidebar-text-muted)' }}>✕</button>
        </div>

        <p className="text-[11px] mb-5" style={{ color: 'var(--sidebar-text-muted)' }}>
          나에게 맞는 이동 조건을 설정하세요. 값이 클수록 해당 요소가 점수에 더 많이 반영됩니다.
        </p>

        {/* 최대 이동시간 */}
        <div className="mb-5">
          <p className="text-[12px] font-semibold mb-2" style={{ color: 'var(--sidebar-text)' }}>
            최대 이동시간
          </p>
          <div className="flex gap-2">
            {TMAX_OPTIONS.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => setDraft((prev) => ({ ...prev, tMax: value }))}
                className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                style={{
                  background: draft.tMax === value ? 'var(--accent)' : 'var(--sidebar-surface)',
                  color: draft.tMax === value ? '#fff' : 'var(--sidebar-text-muted)',
                  border: `1px solid ${draft.tMax === value ? 'var(--accent)' : 'var(--sidebar-border)'}`,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* α 슬라이더 */}
        <div className="mb-5">
          <div className="flex justify-between items-center mb-1.5">
            <div>
              <span className="text-[12px] font-semibold" style={{ color: 'var(--sidebar-text)' }}>걷기 부담 (α)</span>
              <span className="ml-2 text-[10px]" style={{ color: 'var(--sidebar-text-muted)' }}>도보시간 가중치</span>
            </div>
            <span className="text-[13px] font-bold" style={{ color: '#22c55e' }}>{draft.alpha.toFixed(1)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px]" style={{ color: 'var(--sidebar-text-muted)' }}>편함</span>
            <input
              type="range"
              min={10}
              max={25}
              step={1}
              value={Math.round(draft.alpha * 10)}
              onChange={(e) => setDraft((prev) => ({ ...prev, alpha: Number(e.target.value) / 10 }))}
              className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: '#22c55e' }}
            />
            <span className="text-[10px]" style={{ color: 'var(--sidebar-text-muted)' }}>불편함</span>
          </div>
        </div>

        {/* β 슬라이더 */}
        <div className="mb-5">
          <div className="flex justify-between items-center mb-1.5">
            <div>
              <span className="text-[12px] font-semibold" style={{ color: 'var(--sidebar-text)' }}>기다림 부담 (β)</span>
              <span className="ml-2 text-[10px]" style={{ color: 'var(--sidebar-text-muted)' }}>대기시간 가중치</span>
            </div>
            <span className="text-[13px] font-bold" style={{ color: '#f59e0b' }}>{draft.beta.toFixed(1)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px]" style={{ color: 'var(--sidebar-text-muted)' }}>편함</span>
            <input
              type="range"
              min={10}
              max={35}
              step={1}
              value={Math.round(draft.beta * 10)}
              onChange={(e) => setDraft((prev) => ({ ...prev, beta: Number(e.target.value) / 10 }))}
              className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: '#f59e0b' }}
            />
            <span className="text-[10px]" style={{ color: 'var(--sidebar-text-muted)' }}>불편함</span>
          </div>
        </div>

        {/* γ 슬라이더 */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-1.5">
            <div>
              <span className="text-[12px] font-semibold" style={{ color: 'var(--sidebar-text)' }}>환승 부담 (γ)</span>
              <span className="ml-2 text-[10px]" style={{ color: 'var(--sidebar-text-muted)' }}>환승당 패널티(분)</span>
            </div>
            <span className="text-[13px] font-bold" style={{ color: '#8b5cf6' }}>{draft.gamma}분</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px]" style={{ color: 'var(--sidebar-text-muted)' }}>괜찮음</span>
            <input
              type="range"
              min={0}
              max={20}
              step={1}
              value={draft.gamma}
              onChange={(e) => setDraft((prev) => ({ ...prev, gamma: Number(e.target.value) }))}
              className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: '#8b5cf6' }}
            />
            <span className="text-[10px]" style={{ color: 'var(--sidebar-text-muted)' }}>매우싫음</span>
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="py-2.5 px-4 rounded-xl text-[12px] transition-all"
            style={{ background: 'var(--sidebar-surface)', color: 'var(--sidebar-text-muted)', border: '1px solid var(--sidebar-border)' }}
          >
            기본값으로
          </button>
          <button
            onClick={handleApply}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-all hover:brightness-110 active:scale-95"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            적용하기
          </button>
        </div>
      </div>
    </div>
  );
}
