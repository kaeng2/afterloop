/**
 * T047 단위 테스트 1/2: 화면 공용 뼈대의 순수 함수 (문구·금액·연결 표·보드 고르기·메뉴).
 *
 * 기대값 출처: `tasks/T047.md` "완료 기준", SPEC v2.6 2·9-4·10·12장, AC19 초안 1·12번.
 * DOM·브라우저 시험 도구가 저장소에 없으므로 그리지 않고 순수 함수만 부른다.
 */
import { describe, expect, it } from 'vitest';

import { BADGE_COPY_KEYS, RISK_LEVEL } from '@/app/_shared/badge-keys';
import { copyKeys, copyTables, t } from '@/app/_shared/copy';
import { demoLinks, isLiveSendAllowed, linkFor, parseDemoLinks, screenLinks, withoutDemoExcluded } from '@/app/_shared/demo-links';
import { hasDemoValues, pickBoard } from '@/app/_shared/dispute-view';
import { NAV_ITEMS, isActive } from '@/app/_shared/nav-items';
import { toDollarsCents, toDollarsRounded } from '@/app/_shared/money';
import type { BoardState } from '@/types';

// ───────────────────────────── 문구 (`t`) ─────────────────────────────

describe('T047 문구 읽기', () => {
  it('있는 키는 그 값을 돌려준다', () => {
    expect(t('nav.today')).toBe('Today');
    expect(t('badge.demo')).toBe('Demo data');
    expect(t('common.llmUnavailable')).toBe('AI unavailable — showing rules only');
  });

  it('자리표시자를 채운다', () => {
    expect(t('board.expectedLoss', { amount: '$37' })).toBe('Expected loss $37');
    expect(t('common.demoFields', { fields: 'tracking on file' })).toBe('Demo values: tracking on file');
  });

  it('없는 키는 예외다 (빈 글자를 내지 않는다)', () => {
    expect(() => t('nav.nothingHere')).toThrow(/화면 문구가 없다/);
    expect(() => t('')).toThrow(/화면 문구가 없다/);
  });

  it('`version`·`note`는 문구가 아니다', () => {
    expect(() => t('version')).toThrow(/화면 문구가 없다/);
    expect(() => t('note')).toThrow(/화면 문구가 없다/);
  });

  it('채우지 못한 자리표시자와 쓰이지 않은 값은 예외다', () => {
    expect(() => t('board.expectedLoss')).toThrow(/자리표시자/);
    expect(() => t('board.expectedLoss', { wrongName: '$37' })).toThrow(/자리표시자/);
    expect(() => t('nav.today', { amount: '$1' })).toThrow(/없는 자리표시자/);
  });

  it('영어·한국어 문구 파일의 키가 같다 (AC19 초안 12번)', () => {
    expect(copyKeys(copyTables.ko)).toEqual(copyKeys(copyTables.en));
  });

  it('이 작업이 쓰는 키 앞머리가 두 파일에 모두 있다', () => {
    const mine = copyKeys().filter((key) => /^(nav|badge|common)\./.test(key));
    expect(mine.length).toBeGreaterThan(0);
    for (const key of [...mine, ...BADGE_COPY_KEYS, ...NAV_ITEMS.map((item) => item.copyKey)]) {
      expect(typeof copyTables.en[key], key).toBe('string');
      expect(typeof copyTables.ko[key], key).toBe('string');
    }
  });

  it('금지 문구가 없고 금액을 문구에 적어 두지 않았다 (SPEC 10·12장)', () => {
    const forbidden = [/guarantee/i, /guaranteed/i, /보장/, /예측 정확도/, /prediction accuracy/i];
    for (const table of [copyTables.en, copyTables.ko]) {
      for (const [key, value] of Object.entries(table)) {
        for (const pattern of forbidden) expect(pattern.test(value), `${key}: ${pattern}`).toBe(false);
        expect(/\$\s*\d/.test(value), key).toBe(false); // 숫자는 자리표시자로만
      }
    }
  });
});

// ───────────────────────────── 금액 표시 ─────────────────────────────

describe('T047 금액 표시', () => {
  it('달러로 반올림한다 (사사오입)', () => {
    expect(toDollarsRounded(7400)).toBe('$74');
    expect(toDollarsRounded(3680)).toBe('$37');
    expect(toDollarsRounded(3650)).toBe('$37');
    expect(toDollarsRounded(3649)).toBe('$36');
    expect(toDollarsRounded(0)).toBe('$0');
    expect(toDollarsRounded(21619)).toBe('$216');
    expect(toDollarsRounded(1953)).toBe('$20');
    expect(toDollarsRounded(1200)).toBe('$12');
  });

  it('49센트는 내리고 50센트는 올린다 (경계)', () => {
    expect(toDollarsRounded(49)).toBe('$0');
    expect(toDollarsRounded(50)).toBe('$1');
    expect(toDollarsRounded(99)).toBe('$1');
    expect(toDollarsRounded(100)).toBe('$1');
  });

  it('천 단위를 끊고 음수는 0에서 먼 쪽으로 올린다', () => {
    expect(toDollarsRounded(123456789)).toBe('$1,234,568');
    expect(toDollarsRounded(-3650)).toBe('-$37');
    expect(toDollarsRounded(-3649)).toBe('-$36');
  });

  it('부동소수에서 어긋나는 값도 센트 자리로 정확히 가른다', () => {
    // 0.1 + 0.2 꼴의 어긋남이 끼어들면 아래 값들이 1달러 밀린다
    expect(toDollarsRounded(7_00000000050)).toBe('$7,000,000,001');
    expect(toDollarsRounded(149)).toBe('$1');
    expect(toDollarsRounded(150)).toBe('$2');
  });

  it('센트 정수가 아니면 예외다', () => {
    expect(() => toDollarsRounded(36.8)).toThrow(/센트 정수/);
    expect(() => toDollarsRounded(Number.NaN)).toThrow(/센트 정수/);
  });

  it('정확한 금액은 센트까지 적는다', () => {
    expect(toDollarsCents(7200)).toBe('$72.00');
    expect(toDollarsCents(3680)).toBe('$36.80');
    expect(toDollarsCents(0)).toBe('$0.00');
    expect(toDollarsCents(123456)).toBe('$1,234.56');
  });
});

// ───────────────────────────── 연결 표 ─────────────────────────────

/** 시험용 분쟁 목록 항목 (목록 걸러 내기는 `dispute_id`만 본다). */
const summary = (dispute_id: string) => ({ dispute_id });

const D1 = 'PP-R-MBJ-10197650';
const D2 = 'PP-R-GMS-10197661';
const D3 = 'PP-R-FYT-10197651';
const OLD_SEOYEON = 'PP-R-GAH-10197649';
const PRACTICE = 'PP-R-HEY-10197767';

describe('T047 연결 표 읽기', () => {
  it('라이브 설정이 계약 모양을 지킨다', () => {
    expect(demoLinks.length).toBeGreaterThanOrEqual(4);
    expect(screenLinks().map((link) => link.paypalDisputeId)).toEqual([D1, D2, D3]);
  });

  it('모양이 틀린 설정은 예외다 (화면을 반쯤 띄우지 않는다)', () => {
    expect(() => parseDemoLinks({ links: [] })).toThrow(/모양이 계약과 다르다/);
    expect(() =>
      parseDemoLinks({ version: 'x', links: [{ paypalDisputeId: 'not-a-dispute', seedDisputeId: null, carrierOrderId: null, showOnScreen: true, liveSendAllowed: false }] }),
    ).toThrow(/paypalDisputeId/);
    expect(() =>
      parseDemoLinks({ version: 'x', links: [{ paypalDisputeId: D1, seedDisputeId: null, carrierOrderId: null, showOnScreen: true }] }),
    ).toThrow(/liveSendAllowed/);
  });

  it('같은 분쟁 번호가 두 줄에 있으면 예외다', () => {
    const line = { paypalDisputeId: D1, seedDisputeId: null, carrierOrderId: null, showOnScreen: true, liveSendAllowed: false };
    expect(() => parseDemoLinks({ version: 'x', links: [line, line] })).toThrow(/두 줄에 있다/);
  });

  it('화면에 낼 분쟁만 남긴다: 연습용·시연 제외·표에 없는 분쟁은 빠진다 (AC19 초안 1번)', () => {
    const given = [summary(D1), summary(OLD_SEOYEON), summary(D2), summary(PRACTICE), summary(D3), summary('PP-R-ZZZ-1')];
    expect(withoutDemoExcluded(given).map((s) => s.dispute_id)).toEqual([D1, D2, D3]);
  });

  it('받은 순서를 그대로 지킨다', () => {
    expect(withoutDemoExcluded([summary(D3), summary(D1), summary(D2)]).map((s) => s.dispute_id)).toEqual([D3, D1, D2]);
  });

  it('실제 전송 허용은 표가 정한다 (표에 없으면 거짓)', () => {
    expect(isLiveSendAllowed(D1)).toBe(true);
    expect(isLiveSendAllowed(D2)).toBe(true);
    expect(isLiveSendAllowed(D3)).toBe(false); // PayPal 심사 단계
    expect(isLiveSendAllowed(OLD_SEOYEON)).toBe(false);
    expect(isLiveSendAllowed(PRACTICE)).toBe(true); // 연습용 (화면에는 내지 않는다)
    expect(isLiveSendAllowed('PP-R-ZZZ-1')).toBe(false);
    expect(isLiveSendAllowed('')).toBe(false);
  });

  it('줄 하나를 번호로 찾는다', () => {
    expect(linkFor(D2)?.seedDisputeId).toBe('D2');
    expect(linkFor(D2)?.carrierOrderId).toBe('O01');
    expect(linkFor('PP-R-ZZZ-1')).toBeUndefined();
  });
});

// ───────────────────────────── 보드 고르기 ─────────────────────────────

const board = (disputeId: string, isDemo: boolean): BoardState => ({
  disputeId,
  reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
  stage: 'INQUIRY',
  channel: 'INTERNAL',
  dueDate: '',
  amountCents: 7400,
  currency: 'USD',
  allowedMoves: ['send_message'],
  hasTracking: isDemo,
  hasDeliveredTracking: false,
  buyerPriorInrDisputes: 0,
  isDemo,
});

describe('T047 보드 고르기', () => {
  it('시연용 보드가 있으면 그것, 없으면 실제 보드다', () => {
    const real = board(D2, false);
    const demo = board(D2, true);
    expect(pickBoard({ boardReal: real, boardDemo: demo })).toBe(demo);
    expect(pickBoard({ boardReal: real, boardDemo: null })).toBe(real);
  });

  it('보드를 고치지 않는다', () => {
    const real = board(D2, false);
    const copy = { ...real };
    pickBoard({ boardReal: real, boardDemo: null });
    expect(real).toEqual(copy);
  });

  it('시연용 값이 섞였는지 본다', () => {
    expect(hasDemoValues({ demoFields: [] })).toBe(false);
    expect(hasDemoValues({ demoFields: ['hasTracking'] })).toBe(true);
  });
});

// ───────────────────────────── 메뉴 ─────────────────────────────

describe('T047 → T060 탭', () => {
  it('탭은 Today / Products 두 개이고 Case는 탭에 없다 (Today 오른쪽 칸. 사람 결정 2026-11-10)', () => {
    expect(NAV_ITEMS.map((item) => item.href)).toEqual(['/']); // T099: /products 항목 정리
    expect(NAV_ITEMS.some((item) => item.href.startsWith('/cases'))).toBe(false);
  });

  it('위험 단계는 엔진의 세 구간을 그대로 옮긴다', () => {
    expect(Object.keys(RISK_LEVEL).sort()).toEqual(['High', 'Low', 'Watch']);
    expect(t(RISK_LEVEL.High.copyKey)).toBe('High');
  });

  it('지금 보고 있는 화면만 표시한다', () => {
    expect(isActive('/', '/')).toBe(true);
    expect(isActive('/inbox', '/')).toBe(false);
    expect(isActive('/inbox', '/inbox')).toBe(true);
    expect(isActive('/orders', '/inbox')).toBe(false);
    expect(isActive('/products/FK-SW-NV', '/products')).toBe(true);
    expect(isActive('/productsxyz', '/products')).toBe(false);
  });
});
