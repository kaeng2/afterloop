'use client';
/**
 * /intro 화면 (T078, 시안 docs/design/mockup-v4/scene1/Scene1.dc.html의 배치·간격·카드 모양).
 *
 * - 동작하는 것: DisputeLess 아이콘, "Handle all N with DisputeLess", "Respond →" (모두 Today 서연으로 이동),
 *   그리고 언어 선택(EN/KO, 브라우저 상태). 나머지 버튼은 핸들러 없이 `aria-disabled`만 가진다.
 * - 서버·fetch·엔진·AI를 부르지 않는다. 숫자는 `config/intro.*.json`의 고정 데모 값이다.
 * - 루트 layout의 위쪽 막대 위를 덮는 전체 화면 껍데기다 (layout은 고치지 않는다).
 */
import Link from 'next/link';
import { useState } from 'react';

import type { Locale } from '../_shared/copy';
import { writeLocaleCookie } from '../_shared/language-switch';
import { useLocale } from '../_shared/locale-context';

import introEn from '../../../config/intro.en.json';
import introKo from '../../../config/intro.ko.json';
import './intro.css';

type IntroCopy = typeof introEn;

const COPY: Record<Locale, IntroCopy> = { en: introEn, ko: introKo as IntroCopy };

/** Today(서연)로 가는 길 — 서연 PayPal 분쟁 번호는 문구 파일의 첫 건. */
const TODAY_HREF = '/?item=' + introEn.cases[0].id;

/** 눌러도 아무 일 없는 버튼 (핸들러 없음). */
function Inert({ className, label, children }: { className: string; label?: string; children: React.ReactNode }) {
  return (
    <button type="button" className={className} aria-disabled="true" aria-label={label}>
      {children}
    </button>
  );
}

function Mark({ size, mode }: { size: number; mode: 'accent' | 'white' }) {
  return (
    <svg width={size} height={size} viewBox="30 70 200 110" aria-hidden="true">
      <path
        d="M92 112H146C176 112 192 126 206 158"
        fill="none"
        className={mode === 'accent' ? 'intro-mark-accent' : 'intro-mark-white'}
        strokeWidth="30"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="56" cy="112" r="16" className="intro-mark-dot" />
    </svg>
  );
}

export function IntroScreen() {
  // 언어는 다른 화면과 같은 쿠키·`?lang=` 값 (T081). 고르면 쿠키를 쓰고 바로 바꾼 뒤 서버도 다시 읽는다.
  const serverLang = useLocale();
  const [picked, setPicked] = useState<Locale | null>(null);
  const lang: Locale = picked ?? serverLang;
  const c = COPY[lang];
  const choose = (next: Locale) => {
    setPicked(next);
    writeLocaleCookie(next);
    window.location.reload();
  };

  return (
    <div className="intro" lang={lang}>
      <div className="intro-band" role="note">
        {c.mockBand}
      </div>

      <header className="intro-header">
        <div className="intro-brand">
          <span className="intro-logo">{c.brand}</span>
          <span className="intro-biz">{c.biz}</span>
        </div>
        <nav aria-label={c.nav.label} className="intro-nav">
          <Inert className="intro-tab on">{c.nav.home}</Inert>
          <Inert className="intro-tab">{c.nav.activity}</Inert>
          <Inert className="intro-tab">{c.nav.reports}</Inert>
          <Inert className="intro-tab">{c.nav.money}</Inert>
          <Inert className="intro-tab">
            {c.nav.rc} <span className="intro-chip intro-chip-count">{c.openCount}</span>
          </Inert>
        </nav>
        <div className="intro-tools">
          <div className="intro-lang" role="group" aria-label={c.langLabel}>
            <button type="button" aria-pressed={lang === 'en'} onClick={() => choose('en')}>
              EN
            </button>
            <button type="button" aria-pressed={lang === 'ko'} onClick={() => choose('ko')}>
              한국어
            </button>
          </div>
          <Link className="intro-al-icon" href={TODAY_HREF} aria-label={c.alOpen} title="DisputeLess">
            <Mark size={28} mode="accent" />
            <span className="intro-al-badge">{c.openCount}</span>
          </Link>
          <Inert className="intro-ico" label={c.bell}>
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            </svg>
          </Inert>
          <Inert className="intro-ico" label={c.help}>
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5V14M12 17h.01" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </Inert>
          <span className="intro-seller">
            <span className="intro-avatar">{c.sellerInitial}</span>
            {c.seller}
          </span>

          <div className="intro-coach" role="note">
            <span className="intro-coach-arrow" aria-hidden="true" />
            <div className="intro-coach-head">
              <span className="intro-new">{c.newTag}</span>
              <b>DisputeLess</b>
            </div>
            <span className="intro-coach-text">{c.coach}</span>
            <Link className="intro-btn intro-btn-white" href={TODAY_HREF}>
              {c.alOpen} →
            </Link>
          </div>
        </div>
      </header>

      <main className="intro-main">
        <h1 className="intro-h1">{c.hello}</h1>
        <div className="intro-grid">
          <div className="intro-col">
            <section className="intro-card">
              <span className="intro-label">{c.balanceTitle}</span>
              <div className="intro-balance">
                <span className="intro-balance-amount">{c.balanceAmount}</span>
                <span className="intro-label-plain">{c.balanceCurrency}</span>
              </div>
              <span className="intro-small">{c.balanceSub}</span>
              <div className="intro-btn-row">
                <Inert className="intro-btn intro-btn-black">{c.transfer}</Inert>
                <Inert className="intro-btn intro-btn-line">{c.request}</Inert>
              </div>
            </section>

            <section className="intro-card intro-card-tight">
              <div className="intro-card-head">
                <b className="intro-card-title">{c.activityTitle}</b>
                <Inert className="intro-rlink">{c.seeAll}</Inert>
              </div>
              {c.activities.map((a) => (
                <div className="intro-row" key={a.who}>
                  <span className="intro-avatar intro-avatar-row">{a.initial}</span>
                  <div className="intro-row-text">
                    <b className="intro-row-who">{a.who}</b>
                    <span className="intro-small">{a.what}</span>
                  </div>
                  <b className={a.hold ? 'intro-amount intro-amount-hold' : 'intro-amount'}>{a.amount}</b>
                </div>
              ))}
            </section>
          </div>

          <div className="intro-col">
            <section className="intro-card intro-card-rc">
              <div className="intro-card-head">
                <b className="intro-card-title">{c.nav.rc}</b>
                <span className="intro-chip intro-chip-risk">{c.rcOpen}</span>
              </div>
              <span className="intro-small">{c.rcSub}</span>
              {c.cases.map((k) => (
                <div className="intro-row intro-row-case" key={k.id}>
                  <div className="intro-row-text">
                    <b className="intro-row-who">{k.title}</b>
                    <span className="intro-small">{k.sub}</span>
                    <span className={k.urgent ? 'intro-due intro-due-urgent' : 'intro-due'}>{k.due}</span>
                  </div>
                  <Link className="intro-rlink" href={TODAY_HREF}>
                    {c.respond} →
                  </Link>
                </div>
              ))}
              <Link className="intro-btn intro-btn-accent" href={TODAY_HREF}>
                <Mark size={22} mode="white" />
                {c.rcCta}
              </Link>
            </section>

            <section className="intro-card">
              <b className="intro-card-title">{c.salesTitle}</b>
              <div className="intro-bars" aria-hidden="true">
                {c.bars.map((h, i) => (
                  <span key={i} className={i === c.bars.length - 1 ? 'intro-bar intro-bar-last' : 'intro-bar'} style={{ height: h + 'px' }} />
                ))}
              </div>
              <span className="intro-small">{c.salesSub}</span>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
