// 공통 SVG 아이콘 모음 — currentColor 기반, 24x24 viewBox
// 이모지 대신 일관된 라인 아이콘으로 통일하기 위한 컴포넌트

import type { CSSProperties } from 'react';

interface IconProps {
  size?: number;
  className?: string;
  style?: CSSProperties;
  strokeWidth?: number;
}

function Svg({
  size = 16,
  className,
  style,
  strokeWidth = 2,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function IconMap(props: IconProps) {
  return (
    <Svg {...props}>
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
      <line x1="9" y1="3" x2="9" y2="18" />
      <line x1="15" y1="6" x2="15" y2="21" />
    </Svg>
  );
}

export function IconRoute(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="6" cy="19" r="2.5" />
      <circle cx="18" cy="5" r="2.5" />
      <path d="M8.5 19H16a3.5 3.5 0 0 0 0-7H8a3.5 3.5 0 0 1 0-7h7.5" />
    </Svg>
  );
}

export function IconUser(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </Svg>
  );
}

export function IconSettings(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Svg>
  );
}

export function IconPin(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </Svg>
  );
}

export function IconPencil(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </Svg>
  );
}

export function IconSparkle(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3 L13.5 10.5 L21 12 L13.5 13.5 L12 21 L10.5 13.5 L3 12 L10.5 10.5 Z" />
    </Svg>
  );
}

export function IconBulb(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M15.09 14a5 5 0 1 0-6.18 0c.55.43 1.09 1.18 1.09 2v1h4v-1c0-.82.54-1.57 1.09-2z" />
    </Svg>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </Svg>
  );
}

export function IconWalk(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="4" r="2" />
      <line x1="12" y1="6" x2="12" y2="13" />
      <line x1="12" y1="13" x2="9" y2="22" />
      <line x1="12" y1="13" x2="15" y2="22" />
      <line x1="12" y1="9" x2="9" y2="13" />
      <line x1="12" y1="9" x2="16" y2="11" />
    </Svg>
  );
}

// 가로형 직사각형 + 채워진 바퀴 — "버스" 시각 단서
export function IconBus(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9H4z" />
      <line x1="4" y1="11" x2="20" y2="11" />
      <line x1="9" y1="6" x2="9" y2="11" />
      <line x1="15" y1="6" x2="15" y2="11" />
      <circle cx="8" cy="19" r="2" fill="currentColor" stroke="none" />
      <circle cx="16" cy="19" r="2" fill="currentColor" stroke="none" />
    </Svg>
  );
}

// 세로형 알약 모양 + 하단 트랙선 — "지하철" 시각 단서 (버스와 가로/세로 비율로 구별)
export function IconSubway(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="8" y="3" width="8" height="17" rx="4" />
      <line x1="8" y1="11" x2="16" y2="11" />
      <line x1="12" y1="4" x2="12" y2="11" />
      <line x1="6" y1="22" x2="18" y2="22" />
      <circle cx="10" cy="16" r="1" fill="currentColor" stroke="none" />
      <circle cx="14" cy="16" r="1" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconWarning(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </Svg>
  );
}

export function IconHourglass(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 2h12M6 22h12" />
      <path d="M6 2c0 4 6 6 6 10s-6 6-6 10" />
      <path d="M18 2c0 4-6 6-6 10s6 6 6 10" />
    </Svg>
  );
}

export function IconChevronLeft(props: IconProps) {
  return (
    <Svg {...props}>
      <polyline points="15 18 9 12 15 6" />
    </Svg>
  );
}

export function IconChevronRight(props: IconProps) {
  return (
    <Svg {...props}>
      <polyline points="9 18 15 12 9 6" />
    </Svg>
  );
}

export function IconTransfer(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M16 3l4 4-4 4" />
      <path d="M4 11V9a4 4 0 0 1 4-4h12" />
      <path d="M8 21l-4-4 4-4" />
      <path d="M20 13v2a4 4 0 0 1-4 4H4" />
    </Svg>
  );
}
