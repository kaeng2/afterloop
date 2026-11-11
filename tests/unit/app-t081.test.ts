/**
 * T081: 화면 언어 바꾸기 (EN | 한국어) — 글자만.
 *
 * 실제 AI·PayPal 호출 0회, 개발 서버 없음 (`renderToStaticMarkup`).
 * 확인: ① 언어 고르기 규칙(ko만 ko, 나머지 en) ② 같은 분쟁을 en/ko로 그렸을 때 숫자·AI 글·구매자 원문·분쟁 번호가 같다
 * ③ 서버 데이터 함수·보내기 액션은 언어를 인자로 받지 않는다 (정적 검사) ④ en/ko 키 집합 같음·ko 값 점검.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as React from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { copyKeys, copyTables, parseLocale, setClientLocale, t } from '@/app/_shared/copy';
import { buildCaseDesk } from '@/app/cases/desk-model';
import { recommend } from '@/engine/recommend';
import type { BoardState } from '@/types';

import { P, R } from '../acceptance/boards';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
vi.mock('@/app/_server/disputes', () => ({ loadDemoDisputesForRequest: async () => ({ disputes: [], paypal: { ok: true }, llm: { ok: false } }) }));
// 서버 액션 파일이 `_server/locale`(요청 쿠키 읽기)을 끌어오지 못하게 막는다 — 여기서는 클라이언트 층 언어(`setClientLocale`)만 시험한다
vi.mock('@/app/_server/locale', () => ({ initLocale: async () => 'en', applyLangParam: async () => 'en' }));
vi.mock('@/app/_server/llm', () => ({ getLlm: () => ({ ok: false, reason: 'not_configured' }) }));
(globalThis as { React?: typeof React }).React = React;

const ROOT = path.resolve(__dirname, '../..');
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');

const { CaseView } = await import('@/app/cases/view/case-view');
const { buildCaseView, caseMessages } = await import('@/app/cases/model');
const { TopBar } = await import('@/app/_shared/top-bar');
const { LocaleProvider } = await import('@/app/_shared/locale-context');
// createElement 세 번째 인자로 자식을 넘기려고 children을 선택 값으로 본다 (lint: children를 props로 넘기지 않기)
const Provider = LocaleProvider as unknown as React.ComponentType<{ locale: 'en' | 'ko'; children?: React.ReactNode }>;

// ── 공용 입력 (app-case-view.test.ts와 같은 분쟁) ──────────────────────────

const BOARD: BoardState = {
  disputeId: 'PP-R-TEST-D2',
  reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
  stage: 'INQUIRY',
  channel: 'INTERNAL',
  dueDate: '2026-11-30T00:37:00Z',
  amountCents: 7200,
  currency: 'USD',
  allowedMoves: ['send_message', 'make_offer', 'provide_evidence', 'accept_claim'],
  buyerPriorInrDisputes: 0,
  isDemo: false,
  hasTracking: false,
  hasDeliveredTracking: false,
  cause: { subtype: 'A1', confidence: 1, evidence: [], needsReview: false, source: 'rule' },
};
const BUYER_TEXT = '이번 주 안에 연락 없으면 카드사에 이의제기할게요. 개인통관고유부호 P123456789012';

function renderCase(locale: 'en' | 'ko'): string {
  setClientLocale(locale);
  const view = buildCaseView(
    {
      disputeId: 'PP-R-TEST-D2',
      statusCode: 'WAITING_FOR_SELLER_RESPONSE',
      buyer: { name: 'Seo-yeon', language: 'KO' },
      product: { itemName: 'Sweater' },
      messages: caseMessages({ buyerMessages: [BUYER_TEXT], buyerMessageEn: null, buyerId: 'B01', inquiries: [], includeInquiries: false }),
      boardReal: BOARD,
      boardDemo: null,
      carrierEvents: [],
      signals: null,
      signalsAfterReply: null,
      demoFields: [],
    },
    P,
    R,
  );
  const desk = buildCaseDesk({
    view,
    board: BOARD,
    buyer: null,
    productName: 'Wool Sweater, Navy',
    openDays: null,
    recommendation: recommend(BOARD, P, R),
    moveForecasts: null,
    history: null,
    curvePoints: null,
    band: view.risk?.band ?? null,
  });
  try {
    return renderToStaticMarkup(
      createElement(Provider, { locale }, createElement(CaseView, { view, desk, llmOk: false })),
    );
  } finally {
    setClientLocale('en');
  }
}

/** 화면 글자만 거르고 남는 것: 숫자 묶음·영문 대문자 번호. */
const numbersOf = (html: string) => (html.replace(/<[^>]*>/g, ' ').match(/\$[\d,]+(\.\d+)?|\d+%|PP-[A-Z0-9-]+/g) ?? []).sort();

describe('T081: 언어 고르기', () => {
  it('ko만 ko, 없거나 모르는 값은 en', () => {
    expect(parseLocale('ko')).toBe('ko');
    expect(parseLocale('en')).toBe('en');
    for (const value of [undefined, null, '', 'KO', 'ja', 'xx', 3]) expect(parseLocale(value)).toBe('en');
  });

  it('t: 기본(언어 안 줌)은 영어, 세 번째 인자로 ko', () => {
    expect(t('shell.tabs')).toBe(copyTables.en['shell.tabs']);
    expect(t('shell.tabs', undefined, 'en')).toBe('Main sections');
    expect(t('shell.tabs', undefined, 'ko')).toBe(copyTables.ko['shell.tabs']);
    expect(t('shell.todayTab', { count: 2 }, 'ko')).toContain('2');
  });

  it('없는 키·남은 자리표시자는 두 언어 모두 예외', () => {
    for (const locale of ['en', 'ko'] as const) {
      expect(() => t('no.such.key', undefined, locale)).toThrow();
      expect(() => t('shell.todayTab', undefined, locale)).toThrow();
      expect(() => t('shell.todayTab', { count: 1, extra: 2 }, locale)).toThrow();
    }
  });

  it('위쪽 막대: EN | 한국어 버튼, 고른 쪽 aria-pressed (기본 en, ko 제공자 아래서는 ko)', () => {
    const bar = (locale: 'en' | 'ko') => {
      setClientLocale(locale);
      try {
        return renderToStaticMarkup(
          createElement(
            Provider,
            { locale },
            createElement(TopBar, { todayCount: 2, seller: { initial: 'F', shop: 'Fernwood Knits' } }),
          ),
        );
      } finally {
        setClientLocale('en');
      }
    };
    const en = bar('en');
    expect(en).toMatch(/<button[^>]*aria-pressed="true"[^>]*>EN<\/button>/);
    expect(en).toMatch(/<button[^>]*aria-pressed="false"[^>]*>한국어<\/button>/);
    expect(en).toContain('Today (2)');
    const ko = bar('ko');
    expect(ko).toMatch(/<button[^>]*aria-pressed="true"[^>]*>한국어<\/button>/);
    expect(ko).toMatch(/<button[^>]*aria-pressed="false"[^>]*>EN<\/button>/);
    expect(ko).toContain(t('shell.todayTab', { count: 2 }, 'ko'));
    expect(ko).not.toContain('Today (2)');
  });
});

describe('T081: 같은 분쟁을 en/ko로 그리면 글자만 다르다', () => {
  const en = renderCase('en');
  const ko = renderCase('ko');

  it('화면 글자는 다르다 (ko에는 한글 문구)', () => {
    expect(ko).not.toBe(en);
    expect(ko).toContain(copyTables.ko['case.view.conversation']);
    expect(en).toContain(copyTables.en['case.view.conversation']);
  });

  it('금액·%·분쟁 번호가 같다', () => {
    expect(numbersOf(ko)).toEqual(numbersOf(en));
    expect(numbersOf(en).length).toBeGreaterThan(0);
    expect(en).toContain('PP-R-TEST-D2');
    expect(ko).toContain('PP-R-TEST-D2');
  });

  it('구매자 원문(한국어)이 두 언어에서 같다', () => {
    expect(en).toContain('이번 주 안에 연락 없으면 카드사에 이의제기할게요');
    expect(ko).toContain('이번 주 안에 연락 없으면 카드사에 이의제기할게요');
    expect(ko).toContain('⟦PCCC⟧'); // 통관번호는 화면 전에 자리표시자로 가려진다 (두 언어 같음)
    expect(en).toContain('⟦PCCC⟧');
  });
});

describe('T081: 언어는 계산·전송에 영향이 없다 (정적 검사)', () => {
  const strip = (text: string) => text.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');

  it('서버 데이터 함수·엔진·보내기 관문 파일은 언어를 읽지도 받지도 않는다', () => {
    for (const file of [
      'src/app/_server/send.ts',
      'src/app/_server/today.ts',
      'src/app/_server/disputes.ts',
      'src/app/_server/mode.ts',
      'src/app/_server/activity.ts',
      'src/app/cases/forecast-source.ts',
      'src/app/cases/history-summary-source.ts',
    ]) {
      // (문구를 읽는 `t`는 쓸 수 있다 — 오류 문구를 만든다. 언어를 고르는 부분만 없어야 한다)
      expect(/afterloop_lang|LOCALE_COOKIE|initLocale|_server\/locale|cookies\(/.test(strip(read(file))), file).toBe(false);
    }
  });

  it('서버 액션 인자에 언어가 없다 (sendReplyAction은 form 하나, 나머지는 인자 없음·sku)', () => {
    expect(read('src/app/cases/actions.ts')).toMatch(/export async function sendReplyAction\(form: unknown\)/);
    expect(read('src/app/today/actions.ts')).toMatch(/export async function addTrackingAction\(\)/);
    expect(read('src/app/_shared/activity-actions.ts')).toMatch(/export async function loadActivityView\(\)/);
    expect(read('src/app/products/actions.ts')).toMatch(/export async function writeColorNoteAction\(sku: string\)/);
    expect(strip(read('src/app/cases/actions.ts'))).not.toMatch(/SendFormSchema[\s\S]{0,400}lang/i);
  });

  it('엔진·AI·PayPal·실행 폴더는 화면 언어·문구를 모른다', () => {
    const walk = (dir: string): string[] =>
      readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.ts') ? [path.join(dir, e.name)] : [],
      );
    for (const dir of ['src/engine', 'src/paypal', 'src/exec']) {
      for (const file of walk(dir)) {
        expect(/afterloop_lang|LOCALE_COOKIE|_server\/locale|_shared\/copy|next\/headers/.test(read(file)), file).toBe(false);
      }
    }
  });
});

describe('T081: 문구 파일', () => {
  it('en/ko 키 집합이 같다', () => {
    expect(copyKeys(copyTables.ko)).toEqual(copyKeys(copyTables.en));
  });

  it('ko 값이 영어 그대로인 키는 설정·기호·이름 성격만이다', () => {
    const allowed = new Set([
      'nav.appName',
      'nav.appNameAccent',
      'shell.lang.en',
      'shell.lang.ko',
      'today.peakDate',
      'today.sellerTimeZone',
      'today.dateOnly',
      'common.noValue',
      'case.view.sideCaption',
      'case.view.points',
      'case.view.causeSide',
      'case.view.causeCodes',
      'product.row.values',
      'today.row.who',
      'case.head.title',
      'case.curve.fromTo',
      'case.work.ai',
      'badge.aiSuggests', // T090: "AI" 알약 (두 언어 모두 기호처럼 "AI")
      'case.curve.tick100', // T090: 곡선 눈금 "100%"
      'case.curve.tick50', // T090: 곡선 눈금 "50%"
      'case.reply.rushedExample', // 구매자에게 나가는 영어 답장 예시 (영어 그대로가 맞다)
      'case.reply.refundDraft', // T091: 환불 카드의 영어 입력칸 글 (입력칸은 영어 — 예측 규칙이 영어 글을 본다)
      'case.reply.refundDraftNoName', // T091: 같은 글, 이름을 모를 때
    ]);
    const same = copyKeys(copyTables.en).filter((key) => copyTables.en[key] === copyTables.ko[key]);
    expect(same.filter((key) => !allowed.has(key))).toEqual([]);
  });

  it('언어 버튼 이름·안내 문구가 두 파일에 있다', () => {
    for (const key of ['shell.lang.label', 'shell.lang.en', 'shell.lang.ko']) {
      expect(copyTables.en[key]).toBeTruthy();
      expect(copyTables.ko[key]).toBeTruthy();
    }
    expect(copyTables.en['shell.lang.ko']).toBe('한국어');
  });
});
