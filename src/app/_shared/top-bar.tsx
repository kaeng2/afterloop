'use client';

/**
 * 위쪽 막대 (T060, 모든 화면 공통). 왼쪽부터 로고 · 탭 두 개(Today (N) / Products) ·
 * PayPal activity 버튼 · 판매자 칩. (Autopilot 토글은 T061부터 그리지 않는다 — 아래 `SHOW_AUTOPILOT`)
 *
 * - N은 Today 목록에 실제로 보이는 항목 수다 — 서버(`layout.tsx`)가 `buildToday(...).count`를 넘긴다.
 * - 판매자 칩 글자는 `config/rules.json`의 서명에서 온다 (`layout.tsx`가 `sellerChip`으로 갈라 넘긴다).
 * - 지금 보고 있는 탭을 표시하려고 주소를 읽으므로 클라이언트 컴포넌트다. 서버 전용 코드를 import하지 않는다.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ActivityDrawer, type ActivityRecord } from './activity-drawer';
import { AutopilotToggle } from './autopilot-toggle';
import { t } from './copy';
import { NAV_ITEMS, isActive } from './nav-items';

import './shell.css';

/**
 * Autopilot 토글은 그리지 않는다 (T061, 1.5차 리뷰 ② 사람 승인: 영상에서 뺀다). 코드는 남겨 둔다 —
 * 다시 보이려면 이 값만 바꾼다.
 */
const SHOW_AUTOPILOT = false;

/** 기록은 T064가 채운다. 지금은 빈 목록 (건수 = 길이 = 0). */
const NO_RECORDS: readonly ActivityRecord[] = [];

/**
 * 로고 마크 (T067): 28px 원 + 고리 모양(돌아오는 화살표) 아이콘. 색은 css 변수(강조색 + 카드 바탕)만 쓴다 —
 * 시안의 파랑 계열 색은 쓰지 않는다. 장식이라 읽히지 않는다 (이름은 옆 글자).
 */
function LogoMark() {
  return (
    <svg className="shell-logo-mark" width="28" height="28" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <circle className="shell-logo-disc" cx="16" cy="16" r="14" />
      <path className="shell-logo-ring" d="M10 16a6 6 0 1 0 6-6" strokeWidth="3" />
      <path className="shell-logo-ring" d="M16 6.5l3 3.5-3.6 2.6" strokeWidth="2.5" />
    </svg>
  );
}

export function TopBar({
  todayCount,
  seller,
  modeNote,
}: {
  todayCount: number;
  seller: { initial: string; shop: string };
  /** 공개 모드 한 줄 (public일 때만). PayPal activity 버튼 왼쪽에 작은 글씨로 */
  modeNote?: string;
}) {
  const pathname = usePathname() ?? '/';
  return (
    <header className="shell-bar">
      <div className="shell-bar-inner">
        <Link href="/" className="shell-logo">
          <LogoMark />
          {t('nav.appName')}
        </Link>

        <nav className="shell-tabs nav" aria-label={t('shell.tabs')}>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shell-tab"
              aria-current={isActive(pathname, item.href) ? 'page' : undefined}
            >
              {item.href === '/' ? t('shell.todayTab', { count: todayCount }) : t(item.copyKey)}
            </Link>
          ))}
        </nav>

        <div className="shell-actions">
          {modeNote ? (
            <span className="shell-mode-note muted small" role="note">
              {modeNote}
            </span>
          ) : null}
          {SHOW_AUTOPILOT ? <AutopilotToggle /> : null}
          <ActivityDrawer records={NO_RECORDS} />
          <span className="shell-seller" title={t('shell.seller', { shop: seller.shop })}>
            <span className="shell-avatar" aria-hidden="true">
              {seller.initial}
            </span>
            <span className="shell-seller-name">{seller.shop}</span>
          </span>
        </div>
      </div>
    </header>
  );
}
