'use client';
/**
 * /intro 화면 (T078 → T108: 시안 docs/design/mockup-v4/scene1/Scene1.dc.html의 CSS·인라인 style 그대로).
 *
 * - 클래스(tab, card, btn, b-black, b-line, ico, al-icon, pulse, rise, row, chip, rlink)는 시안 이름 그대로이고
 *   규칙은 `scene1.css`(시안 <style> 복사)에 있다. 시안 인라인 style은 같은 값을 `style`로 둔다 (`// L숫자` = 시안 줄).
 * - 동작하는 것: DisputeLess 아이콘, 말풍선 버튼, "Handle all N with DisputeLess", "Respond →" (모두 Today 서연으로 이동),
 *   그리고 언어 선택(EN/KO, 브라우저 상태).
 * - 껍데기 (T115, 사람 결정 11/12 11:20 — 시안 그대로): 탭·"See all"은 `<a href="#">`(누르면 preventDefault라 주소에 `#`가 안 붙는다),
 *   벨·도움말·Transfer money·Request payment는 일반 `<button type="button">`. 누르면 아무 일 없음. aria-disabled 없음, cursor는 시안 값.
 * - 서버·fetch·엔진·AI를 부르지 않는다. 사건 줄·건수·대목까지 남은 날은 page가 넘긴 `data`(Desk와 같은 출처)를 옮기기만 한다.
 * - 열리면 서연 화면을 미리 불러 둔다 (`router.prefetch`, T115).
 * - 시안과 다른 곳 (예외): 맨 위 Demo mock 띠, 로고 자리 "Seller dashboard", 언어 선택, 좁은 폭 규칙(intro.css).
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { CSSProperties, MouseEvent } from 'react';

import type { IntroCase, IntroData } from '../../_server/intro-data';
import type { Locale } from '../../_shared/copy';
import { writeLocaleCookie } from '../../_shared/language-switch';
import { useLocale } from '../../_shared/locale-context';

import introEn from '../../../../config/intro.en.json';
import introKo from '../../../../config/intro.ko.json';
import './scene1.css';
import './intro.css';

type IntroCopy = typeof introEn;

const COPY: Record<Locale, IntroCopy> = { en: introEn, ko: introKo as IntroCopy };

/** Today(서연)로 가는 길. */
const TODAY_HREF = '/?item=' + introEn.targetDisputeId;

/** `{{n}}` 같은 자리를 채운다 (표기만). */
const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{\{(\w+)\}\}/g, (all, key: string) => (key in values ? String(values[key]) : all));

/** 껍데기 링크: 시안처럼 `href="#"`이지만 주소를 바꾸지 않는다. */
const stay = (event: MouseEvent<HTMLAnchorElement>) => event.preventDefault();

function caseLines(k: IntroCase, c: IntroCopy, lang: Locale) {
  const reasons = c.reasons as Record<string, string>;
  const reason = reasons[k.reason] ?? reasons.other;
  const type = k.repeat ? `${reason} · ${c.caseRepeat}` : reason;
  const due = k.due === null ? c.caseNoDue : fill(c.caseDue, { date: k.due[lang] }) + (k.mentionsChargeback ? c.caseChargeback : '');
  return {
    title: fill(c.caseTitle, { type, amount: k.amount }),
    sub: fill(c.caseSub, { buyer: k.buyer[lang], product: k.product, id: k.id }),
    due,
    urgent: k.mentionsChargeback,
  };
}

function salesLine(c: IntroCopy, days: number): string {
  if (days < 0) return c.salesSubPast;
  return days === 1 ? c.salesSubOne : fill(c.salesSub, { days });
}

const S = {
  muted: { color: '#3F4144' } as CSSProperties,
  small: { fontSize: 13, color: '#3F4144' } as CSSProperties, // L55 등
  col: { display: 'flex', flexDirection: 'column', gap: 22, minWidth: 0 } as CSSProperties, // L88, L107
  rowText: { display: 'flex', flexDirection: 'column', minWidth: 0 } as CSSProperties, // L98
  avatarRow: {
    width: 40, height: 40, borderRadius: '50%', background: '#F1EFEA', display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 14,
  } as CSSProperties, // L97
};

/** 시안 L51·L104 DisputeLess 표시 (path·circle 값 그대로). */
function Mark({ size, stroke }: { size: number; stroke: string }) {
  return (
    <svg width={size} height={size} viewBox="30 70 200 110" aria-hidden="true">
      <path d="M92 112H146C176 112 192 126 206 158" fill="none" stroke={stroke} strokeWidth="30" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="56" cy="112" r="16" fill="#FFFFFF" />
    </svg>
  );
}

export function IntroScreen({ data }: { data: IntroData }) {
  // 언어는 다른 화면과 같은 쿠키·`?lang=` 값 (T081). 고르면 쿠키를 쓰고 바로 바꾼 뒤 서버도 다시 읽는다.
  const serverLang = useLocale();
  const [picked, setPicked] = useState<Locale | null>(null);
  const lang: Locale = picked ?? serverLang;
  const c = COPY[lang];
  const n = data.cases.length;
  const router = useRouter();
  useEffect(() => {
    router.prefetch(TODAY_HREF); // T115: 클릭 전에 서연 화면을 미리 불러 둔다
  }, [router]);
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

      {/* L47 header */}
      <header className="intro-header" style={{ display: 'flex', alignItems: 'center', gap: 28, padding: '0 32px', background: '#FFFFFF', borderBottom: '1px solid #E4E6E9', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 72 }}>
          <span className="intro-logo" style={{ fontSize: 22, fontWeight: 900, color: '#002991', letterSpacing: '-0.4px' }}>{c.brand}</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#3F4144' }}>{c.biz}</span>
          <span className="chip" style={{ background: '#ECEEF0', color: '#3F4144' }}>{c.mock}</span>
        </div>
        <nav aria-label={c.nav.label} className="intro-nav" style={{ display: 'flex', gap: 22, alignSelf: 'stretch', alignItems: 'flex-end' }}>
          <a className="tab on" href="#" onClick={stay}>{c.nav.home}</a>
          <a className="tab" href="#" onClick={stay}>{c.nav.activity}</a>
          <a className="tab" href="#" onClick={stay}>{c.nav.reports}</a>
          <a className="tab" href="#" onClick={stay}>{c.nav.money}</a>
          <a className="tab" href="#" onClick={stay}>
            {c.nav.rc} <span className="chip" style={{ background: '#C4321F', color: '#FFFFFF' }}>{n}</span>
          </a>
        </nav>
        <div className="intro-tools" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
          <div className="intro-lang" role="group" aria-label={c.langLabel}>
            <button type="button" aria-pressed={lang === 'en'} onClick={() => choose('en')}>
              EN
            </button>
            <button type="button" aria-pressed={lang === 'ko'} onClick={() => choose('ko')}>
              한국어
            </button>
          </div>
          <Link className="al-icon pulse" href={TODAY_HREF} aria-label={c.alOpen} title="DisputeLess">
            <Mark size={28} stroke="#00A8EA" />
            <span style={{ position: 'absolute', right: -5, top: -5, minWidth: 20, height: 20, padding: '0 5px', borderRadius: 1000, background: '#C4321F', color: '#FFFFFF', fontSize: 11, fontWeight: 900, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #FFFFFF' }}>{n}</span>
          </Link>
          <button type="button" className="ico" aria-label={c.bell}>
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            </svg>
          </button>
          <button type="button" className="ico" aria-label={c.help}>
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5V14M12 17h.01" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
          <span className="intro-seller" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700 }}>
            <span style={{ width: 36, height: 36, borderRadius: '50%', background: '#F1EFEA', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>{c.sellerInitial}</span>
            {c.seller}
          </span>

          {/* L62 말풍선 */}
          <div className="rise intro-coach" role="note" style={{ position: 'absolute', top: 60, right: 150, width: 330, zIndex: 5, borderRadius: 20, background: '#000000', color: '#FFFFFF', padding: '16px 18px', boxShadow: 'rgba(0,0,0,0.25) 0 12px 32px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span className="intro-coach-arrow" aria-hidden="true" style={{ position: 'absolute', top: -7, right: 92, width: 14, height: 14, background: '#000000', transform: 'rotate(45deg)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 900, padding: '2px 8px', borderRadius: 1000, background: 'linear-gradient(120deg,#0066F5,#60CDFF)' }}>{c.newTag}</span>
              <b>DisputeLess</b>
            </div>
            <span style={{ fontSize: 14, lineHeight: 1.45 }}>{fill(c.coach, { n })}</span>
            <Link className="btn" href={TODAY_HREF} style={{ background: '#FFFFFF', color: '#000000', minHeight: 38, padding: '6px 16px', fontSize: 14, alignSelf: 'flex-start' }}>
              <span>{c.alOpen}</span> →
            </Link>
          </div>
        </div>
      </header>

      {/* L70 main */}
      <main className="intro-main" style={{ maxWidth: 1280, margin: '0 auto', padding: 32, display: 'flex', flexDirection: 'column', gap: 22 }}>
        <h1 className="intro-h1" style={{ margin: 0, fontSize: 32, fontWeight: 900, letterSpacing: '-0.6px', color: 'inherit' }}>{c.hello}</h1>
        <div className="intro-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 7fr) minmax(0, 5fr)', gap: 22, alignItems: 'start' }}>
          <div style={S.col}>
            <section className="card">
              <span style={{ fontSize: 14, fontWeight: 700, color: '#3F4144' }}>{c.balanceTitle}</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span className="intro-balance-amount" style={{ fontSize: 44, fontWeight: 900, letterSpacing: '-1.2px', lineHeight: 1 }}>{c.balanceAmount}</span>
                <span style={{ fontSize: 15, color: '#3F4144' }}>{c.balanceCurrency}</span>
              </div>
              <span style={S.small}>{c.balanceSub}</span>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" className="btn b-black">{c.transfer}</button>
                <button type="button" className="btn b-line">{c.request}</button>
              </div>
            </section>

            <section className="card" style={{ gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 8 }}>
                <b style={{ fontSize: 18 }}>{c.activityTitle}</b>
                <a className="rlink" href="#" onClick={stay}>{c.seeAll}</a>
              </div>
              {c.activities.map((a) => (
                <div className="row" key={a.who}>
                  <span style={S.avatarRow}>{a.initial}</span>
                  <div style={S.rowText}>
                    <b style={{ fontSize: 14 }}>{a.who}</b>
                    <span style={S.small}>{a.what}</span>
                  </div>
                  <b style={{ fontSize: 15, color: a.hold ? '#9E2414' : '#000000' }}>{a.amount}</b>
                </div>
              ))}
            </section>
          </div>

          <div style={S.col}>
            <section className="card" style={{ border: '2px solid #F2B8AF' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <b style={{ fontSize: 18 }}>{c.nav.rc}</b>
                <span className="chip" style={{ background: '#FBE7E4', color: '#9E2414' }}>{fill(c.rcOpen, { n })}</span>
              </div>
              <span style={S.small}>{c.rcSub}</span>
              {data.cases.map((k) => {
                const line = caseLines(k, c, lang);
                return (
                  <div className="row" key={k.id} style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
                    <div style={S.rowText}>
                      <b style={{ fontSize: 14 }}>{line.title}</b>
                      <span style={S.small}>{line.sub}</span>
                      <span style={line.urgent ? { fontSize: 12, fontWeight: 700, color: '#9E2414' } : { fontSize: 12, color: '#3F4144' }}>{line.due}</span>
                    </div>
                    <Link className="rlink" href={TODAY_HREF}>
                      {c.respond} →
                    </Link>
                  </div>
                );
              })}
              <Link className="btn" href={TODAY_HREF} style={{ background: 'linear-gradient(120deg,#002991,#0066F5 60%,#60CDFF)', color: '#FFFFFF', gap: 10 }}>
                <Mark size={22} stroke="#FFFFFF" />
                {fill(c.rcCta, { n })}
              </Link>
            </section>

            <section className="card">
              <b style={{ fontSize: 18 }}>{c.salesTitle}</b>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 90 }} aria-hidden="true">
                {c.bars.map((h, i) => (
                  <span key={i} style={{ flex: 1, borderRadius: '6px 6px 2px 2px', height: h + 'px', background: i === c.bars.length - 1 ? '#0066F5' : '#C9D3E0' }} />
                ))}
              </div>
              <span style={S.small}>{salesLine(c, data.peakDays)}</span>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
