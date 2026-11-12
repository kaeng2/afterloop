/**
 * T113: 한국어(ko)로 바꾸면 Desk가 죽던 버그 — 재발 방지.
 *
 *  1. en·ko 두 문구 파일에서 **모든 키**의 자리표시자 집합이 같다 (`case.reply.editSub`·`case.reaction.moodNext`가 달랐다).
 *  2. 화면 코드의 `t('키', { … })` 호출이 넘기는 이름 = 두 언어 문구의 자리표시자 (정적 검사, 모든 화면).
 *  3. ko로 정적 렌더할 때 예외가 없다: Desk 답장 칸(서연 · 이름 있음/없음) · 예상 반응 상자 · 위쪽 막대 · /listing · /intro.
 *  4. `(app)` 화면(로딩 경계 Suspense 안)의 `?lang=`은 서버 `redirect()`가 아니라 전체 페이지 이동(`LangRedirect`)이다
 *     (React #310). 경계가 없는 `/listing`·`/intro`만 `applyLangParam`(HTTP 307)을 쓴다.
 *
 * 실제 AI·PayPal 호출 0회, 개발 서버 없음 (`renderToStaticMarkup`, 가짜 LLM).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { draftReply, translateReply } from '@/ai/reply';
import { copyKeys, copyTables, setClientLocale, t } from '@/app/_shared/copy';
import { langRedirectTarget } from '@/app/_shared/lang-param';
import { caseReplyFacts } from '@/app/cases/reply-facts';
import type { BoardState, Cause, FactToken, LlmCaller } from '@/types';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }),
  redirect: () => undefined,
}));
vi.mock('@/app/_server/disputes', () => ({
  loadDemoDisputes: async () => ({ disputes: [], paypal: { ok: false }, llm: { ok: false } }),
  loadDemoDisputesForRequest: async () => ({ disputes: [], paypal: { ok: false }, llm: { ok: false } }),
}));
vi.mock('@/app/_server/today', () => ({
  loadTodayForRequest: vi.fn(),
  loadTrackingForRequest: vi.fn(),
  loadTodayScreen: vi.fn(),
}));
vi.mock('@/app/_server/paypal', () => ({ getPayPalClient: vi.fn(), getPayPalReadClient: vi.fn() }));
vi.mock('@/app/_server/llm', () => ({ getLlm: () => ({ ok: false, reason: 'not_configured' }) }));
(globalThis as { React?: typeof React }).React = React;

const { ReplyPanel, ReactionBox } = await import('@/app/cases/reply/reply-panel');
const { TopBar } = await import('@/app/_shared/top-bar');
const { LocaleProvider } = await import('@/app/_shared/locale-context');
const { ListingScreen } = await import('@/app/demo/store/new-product/listing-screen');
const { IntroScreen } = await import('@/app/demo/seller-dashboard/intro-screen');
const { LangRedirect } = await import('@/app/_shared/lang-redirect');
// createElement 세 번째 인자로 자식을 넘기려고 children을 선택 값으로 본다
const Provider = LocaleProvider as unknown as React.ComponentType<{ locale: 'en' | 'ko'; children?: React.ReactNode }>;

const ROOT = path.resolve(__dirname, '../..');
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');

const PLACEHOLDER = /\{\{\s*([A-Za-z0-9.]+)\s*\}\}/g;
const placeholders = (template: string) => [...new Set([...template.matchAll(PLACEHOLDER)].map((m) => m[1]))].sort();

afterEach(() => setClientLocale('en'));

/** ko 화면으로 그린다 (서버 렌더의 클라이언트 층처럼 `LocaleProvider`가 맨 앞). */
function renderKo(node: React.ReactElement): string {
  return renderToStaticMarkup(createElement(Provider, { locale: 'ko' }, node));
}

// ── 1. 자리표시자 집합 ─────────────────────────────────────────────────

describe('T113-1 en·ko 자리표시자 집합이 모든 키에서 같다', () => {
  it('키 집합이 같고, 키마다 {{이름}} 집합이 같다', () => {
    expect(copyKeys(copyTables.ko)).toEqual(copyKeys(copyTables.en));
    const diff: string[] = [];
    for (const key of copyKeys(copyTables.en)) {
      const en = placeholders(copyTables.en[key]);
      const ko = placeholders(copyTables.ko[key]);
      if (en.join(',') !== ko.join(',')) diff.push(`${key}: en [${en}] ko [${ko}]`);
    }
    expect(diff).toEqual([]);
  });

  it('이름 규칙 키(T107): 이름 있는 꼴은 {{name}}, 이름 없는 꼴(…Unknown)은 자리표시자 없음 (두 언어 모두)', () => {
    for (const key of ['case.reply.editSub', 'case.reaction.moodNext', 'case.reaction.title']) {
      for (const locale of ['en', 'ko'] as const) {
        expect(placeholders(copyTables[locale][key]), `${locale} ${key}`).toEqual(['name']);
        expect(placeholders(copyTables[locale][`${key}Unknown`]), `${locale} ${key}Unknown`).toEqual([]);
      }
    }
    expect(t('case.reply.editSub', { name: '서연' }, 'ko')).toContain('서연 님');
    expect(t('case.reaction.moodNext', { name: '서연' }, 'ko')).toContain('서연 님');
  });
});

// ── 2. 화면 코드의 t() 호출 ─────────────────────────────────────────────

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(path.join(ROOT, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(path.join(ROOT, rel)).isDirectory()) out.push(...sourceFiles(rel));
    else if (/\.tsx?$/.test(name)) out.push(rel);
  }
  return out;
}

/** `{ a, b: x, c: y(z) }` 의 맨 위 이름들 (중첩 괄호는 건너뛴다). */
function objectKeys(body: string): string[] {
  const keys: string[] = [];
  let depth = 0;
  let part = '';
  const flush = () => {
    const name = part.trim().match(/^([A-Za-z_$][\w$]*)\s*(?::|$)/)?.[1];
    if (name !== undefined) keys.push(name);
    part = '';
  };
  for (const ch of body) {
    if ('([{'.includes(ch)) depth += 1;
    if (')]}'.includes(ch)) depth -= 1;
    if (ch === ',' && depth === 0) flush();
    else part += ch;
  }
  flush();
  return keys.sort();
}

describe('T113-2 t(\'키\', { … }) 호출이 넘기는 이름 = en·ko 자리표시자', () => {
  it('src/app 전체: 글자로 적은 키에 객체로 넘긴 이름이 두 언어 문구와 같다', () => {
    const CALL = /\bt\(\s*'([^']+)'\s*,\s*\{/g;
    const bad: string[] = [];
    let checked = 0;
    for (const file of sourceFiles('src/app')) {
      const code = read(file);
      for (const match of code.matchAll(CALL)) {
        const key = match[1];
        if (!(key in copyTables.en)) continue; // 키 없음은 다른 시험이 본다
        // 여는 { 부터 짝이 맞는 } 까지
        const start = (match.index ?? 0) + match[0].length;
        let depth = 1;
        let end = start;
        while (end < code.length && depth > 0) {
          if (code[end] === '{') depth += 1;
          if (code[end] === '}') depth -= 1;
          end += 1;
        }
        const passed = objectKeys(code.slice(start, end - 1));
        if (passed.length === 0) continue; // 펼침(...)·변수만 넘긴 꼴은 건너뛴다
        checked += 1;
        for (const locale of ['en', 'ko'] as const) {
          const want = placeholders(copyTables[locale][key]);
          if (want.join(',') !== passed.join(',')) bad.push(`${file} ${key} (${locale}): 넘김 [${passed}] 문구 [${want}]`);
        }
      }
    }
    expect(checked).toBeGreaterThan(50);
    expect(bad).toEqual([]);
  });
});

// ── 3. ko 정적 렌더 ───────────────────────────────────────────────────

const NOW = '2026-11-10T03:00:00Z';
const D2: BoardState = {
  disputeId: 'PP-R-GMS-10197661',
  reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
  stage: 'INQUIRY',
  channel: 'INTERNAL',
  dueDate: '2026-11-30T00:37:00Z',
  amountCents: 7200,
  currency: 'USD',
  allowedMoves: ['send_message', 'make_offer', 'provide_evidence', 'accept_claim'],
  buyerPriorInrDisputes: 0,
  isDemo: true,
  hasTracking: true,
  hasDeliveredTracking: false,
  cause: { subtype: 'A2', confidence: 1, evidence: [], needsReview: false, source: 'rule', causeNote: 'Customs hold – recipient customs ID missing' },
};
const FACTS: FactToken[] = caseReplyFacts({ now: NOW, dueDate: D2.dueDate, buyerId: null, buyerLocale: 'ko' }).outgoing;
// app-t061.test.ts와 같은 초안·번역 (가짜 LLM 답)
const DRAFT_EN =
  "Sorry for the wait. Your sweater is at Korean customs, waiting for your personal customs code. Reply with it and I'll pass it to the carrier. I'll check with the carrier and get back to you by ⟦DATE_1⟧.";
const OUTGOING =
  '기다리게 해서 죄송해요. 스웨터는 현재 한국 세관에서 개인통관고유부호를 기다리고 있어요. 번호를 답장으로 알려주시면 운송사에 바로 전달할게요. ⟦DATE_1⟧까지 운송사 상황을 확인해서 다시 연락드릴게요.';
const COACHING = ['Say sorry first.', 'Explain the hold.', 'Ask for the code.', 'Pass it on.', 'Give a date.'];

function fakeLlm(...answers: unknown[]): LlmCaller {
  let n = 0;
  return async () => answers[Math.min(n++, answers.length - 1)];
}

async function replyBase() {
  const draft = await draftReply(
    { buyerMessages: ['배송이 안 와요'], buyerLocale: 'ko', cause: D2.cause as Cause, move: 'fight', facts: FACTS },
    { llm: fakeLlm({ buyer_message_en: 'It has not arrived.', coaching: COACHING, draft_en: DRAFT_EN }) },
  );
  const translation = await translateReply(
    { draftEn: DRAFT_EN, buyerLocale: 'ko', facts: FACTS, move: 'fight' },
    { llm: fakeLlm({ outgoing: OUTGOING }, { back_translation_en: 'Back translation.' }) },
  );
  return {
    draft,
    translation,
    facts: FACTS,
    board: D2,
    statusCode: 'WAITING_FOR_SELLER_RESPONSE',
    buyerLocale: 'ko' as const,
    plan: null,
    offerFirst: false,
    mode: 'simulated' as const,
    draftSource: 'ai' as const,
    riskAfterReply: null,
  };
}

describe('T113-3 ko 정적 렌더에 예외가 없다', () => {
  it('Desk 답장 칸 (서연, 이름 있음): editSub에 이름이 들어간다', async () => {
    const base = await replyBase();
    const markup = renderKo(
      createElement(ReplyPanel, { disputeId: D2.disputeId, base, replyId: null, languageKey: 'case.view.lang.KO', buyerShort: 'Seo-yeon' }),
    );
    expect(markup).toContain(t('case.reply.editSub', { name: 'Seo-yeon' }, 'ko'));
  });

  it('Desk 답장 칸 (이름 없음): …Unknown 문구', async () => {
    const base = await replyBase();
    const markup = renderKo(createElement(ReplyPanel, { disputeId: D2.disputeId, base, replyId: null, languageKey: 'case.view.lang.KO' }));
    expect(markup).toContain(t('case.reply.editSubUnknown', undefined, 'ko'));
  });

  it('예상 반응 상자: 이름 있음/없음 둘 다', () => {
    const reaction = {
      cost: '$12',
      parts: [{ key: 'wait', p: 0.5, labelKey: 'case.reaction.wait', display: '50%' }],
      chargebackHigh: false,
      moodKey: 'case.reaction.wait',
      moodBad: false,
      nowMoodKey: null,
    } as unknown as Parameters<typeof ReactionBox>[0]['reaction'];
    const named = renderKo(createElement(ReactionBox, { reaction, name: 'Ji-ho' }));
    expect(named).toContain(t('case.reaction.moodNext', { name: 'Ji-ho' }, 'ko'));
    const unnamed = renderKo(createElement(ReactionBox, { reaction, name: null }));
    expect(unnamed).toContain(t('case.reaction.moodNextUnknown', undefined, 'ko'));
  });

  it('위쪽 막대 · /listing · /intro', () => {
    expect(() => renderKo(createElement(TopBar, { seller: { initial: 'F', shop: 'Shop' }, dateLine: 'x' }))).not.toThrow();
    expect(() => renderKo(createElement(ListingScreen))).not.toThrow();
    expect(() => renderKo(createElement(IntroScreen))).not.toThrow();
  });
});

// ── 4. (app) 화면의 ?lang= ─────────────────────────────────────────────

describe('T113-4 (app) 화면의 ?lang=은 전체 페이지 이동', () => {
  const APP_PAGES = [
    'src/app/(app)/page.tsx',
    'src/app/(app)/cases/[disputeId]/page.tsx',
    'src/app/(app)/preview/styleguide/page.tsx',
  ];

  it('(app) 화면은 applyLangParam(서버 redirect)을 쓰지 않고 LangRedirect를 쓴다', () => {
    expect(read('src/app/(app)/loading.tsx')).toBeTruthy(); // 로딩 경계가 있어서다
    for (const file of APP_PAGES) {
      const code = read(file);
      expect(code, file).not.toContain('applyLangParam');
      expect(code, file).toMatch(/langRedirectTarget\(/);
      expect(code, file).toMatch(/<LangRedirect href=\{langTarget\} \/>/);
    }
    for (const file of ['src/app/listing/page.tsx', 'src/app/intro/page.tsx']) expect(read(file)).toContain('applyLangParam');
  });

  it('주소: 나머지 검색 값은 next에 싣고, 모르는 값은 null', () => {
    expect(langRedirectTarget('/', { item: 'PP-R-GMS-10197661', lang: 'ko' })).toBe(
      `/lang?set=ko&next=${encodeURIComponent('/?item=PP-R-GMS-10197661')}`,
    );
    expect(langRedirectTarget('/products', { lang: ['en', 'ko'] })).toBe(`/lang?set=en&next=${encodeURIComponent('/products')}`);
    expect(langRedirectTarget('/products', { lang: 'fr' })).toBeNull();
    expect(langRedirectTarget('/products', undefined)).toBeNull();
  });

  it('LangRedirect: location.replace로 이동 (router 아님), 기다리는 동안 로딩 문구', () => {
    const code = read('src/app/_shared/lang-redirect.tsx');
    expect(code).toContain('window.location.replace(href)');
    expect(code).not.toMatch(/useRouter|router\./);
    expect(renderKo(createElement(LangRedirect, { href: '/lang?set=ko&next=%2F' }))).toContain(t('common.loading', undefined, 'ko'));
  });
});
