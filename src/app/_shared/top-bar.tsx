'use client';

/**
 * 위쪽 막대 (T060, 모든 화면 공통). 왼쪽 로고·꼬리표·날짜, 오른쪽 공개 데모 표시·PayPal activity·EN/KO·판매자 칩.
 * T096: 탭 없음 — 화면 사이 링크는 막대에 두지 않는다. (Autopilot 토글은 T061부터 그리지 않는다 — 아래 `SHOW_AUTOPILOT`)
 *
 * - 판매자 칩 글자는 `config/rules.json`의 서명에서 온다 (`layout.tsx`가 `sellerChip`으로 갈라 넘긴다).
 * - 서버 전용 코드를 import하지 않는다.
 */
import Link from 'next/link';

import { ActivityDrawer } from './activity-drawer';
import { AutopilotToggle } from './autopilot-toggle';
import { LanguageSwitch } from './language-switch';
import { useT } from './locale-context';

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
            {/* T107: 시안 L101 그라데이션 (Desk에서만 `body:has(.dk)`로 칠한다. 다른 화면은 강조색 단색 그대로) */}
            <defs>
              <linearGradient id="dlg-desk" x1="0" y1="0" x2="100" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0" className="dlg-s0" />
                <stop offset=".55" className="dlg-s1" />
                <stop offset="1" className="dlg-s2" />
              </linearGradient>
            </defs>
            <path d="M2 3H80C89 3 94 5 98 9" />
          </svg>
        </span>
      ) : null}
    </span>
  );
}

export function TopBar({
  seller,
  modeNote,
  dateLine,
}: {
  seller: { initial: string; shop: string };
  /** 공개 모드 한 줄 (public일 때만). PayPal activity 버튼 왼쪽에 작은 글씨로 */
  modeNote?: string;
  /** "Wed, Nov 11 · Black Friday in 16 days" (`buildToday`의 `dateLine`). 없으면 숨김. */
  dateLine?: string;
}) {
  const t = useT();
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

        {/* T090 시안 v4: 로고·꼬리표·날짜는 왼쪽, 탭·서랍·언어·판매자는 오른쪽에 작게 */}
        <div className="shell-actions">
          {modeNote ? (
            <span className="shell-mode-note" role="note">
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
