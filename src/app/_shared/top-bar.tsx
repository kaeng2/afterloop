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

import { ActivityDrawer } from './activity-drawer';
import { AutopilotToggle } from './autopilot-toggle';
import { LanguageSwitch } from './language-switch';
import { useT } from './locale-context';
import { NAV_ITEMS, isActive } from './nav-items';

import './shell.css';

/**
 * Autopilot 토글은 그리지 않는다 (T061, 1.5차 리뷰 ② 사람 승인: 영상에서 뺀다). 코드는 남겨 둔다 —
 * 다시 보이려면 이 값만 바꾼다.
 */
const SHOW_AUTOPILOT = false;

/**
 * 글자 로고 (T076, 시안 v4): "Dispute" + 강조색 "Less" + 그 아래 밑줄 곡선. 색은 css 변수(강조색)만 쓴다 —
 * 시안의 파랑 그라데이션은 쓰지 않는다. 읽히는 이름은 `nav.appName` 하나 (`aria-label`).
 */
function Wordmark() {
  const t = useT();
  const name = t('nav.appName');
  const accent = t('nav.appNameAccent');
  const head = name.endsWith(accent) ? name.slice(0, name.length - accent.length) : name;
  return (
    <span className="shell-wordmark" role="img" aria-label={name}>
      <span aria-hidden="true">{head}</span>
      {name.endsWith(accent) ? (
        <span className="shell-wordmark-accent" aria-hidden="true">
          {accent}
          <svg className="shell-wordmark-curve" viewBox="0 0 100 10" preserveAspectRatio="none" focusable="false">
            <path d="M2 3H80C89 3 94 5 98 9" />
          </svg>
        </span>
      ) : null}
    </span>
  );
}

export function TopBar({
  todayCount,
  seller,
  modeNote,
  dateLine,
}: {
  /** 없으면(읽는 중, T084 Suspense 자리) 숫자 없이 "Today"만 */
  todayCount?: number;
  seller: { initial: string; shop: string };
  /** 공개 모드 한 줄 (public일 때만). PayPal activity 버튼 왼쪽에 작은 글씨로 */
  modeNote?: string;
  /** "Wed, Nov 11 · Black Friday in 16 days" (`buildToday`의 `dateLine`). 없으면 숨김. */
  dateLine?: string;
}) {
  const t = useT();
  const pathname = usePathname() ?? '/';
  return (
    <header className="shell-bar">
      <div className="shell-bar-inner">
        <div className="shell-brand">
          <Link href="/" className="shell-logo">
            <Wordmark />
          </Link>
          <span className="shell-divider" aria-hidden="true" />
          <span className="shell-for">{t('nav.forSellers')}</span>
        </div>
        {dateLine === undefined ? null : <span className="shell-date">{dateLine}</span>}

        <nav className="shell-tabs nav" aria-label={t('shell.tabs')}>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shell-tab"
              aria-current={isActive(pathname, item.href) ? 'page' : undefined}
            >
              {item.href === '/' && todayCount !== undefined ? t('shell.todayTab', { count: todayCount }) : t(item.copyKey)}
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
          {/* 기록은 서랍이 서버에서 읽는다 (T064) */}
          <ActivityDrawer />
          <LanguageSwitch />
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
