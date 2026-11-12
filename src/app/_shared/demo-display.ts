/**
 * 시안 v6 표시용 시드 읽기 (T122e, SPEC v2.16, 결정 2026-11-12 20:35 ③). **전부 Demo data**다.
 *
 * 값은 `seed/demo-display.json`(`seedDemoDisplay`, T121)에서만 온다 — 화면이 번호·이름·문장을 만들지 않는다.
 * 이 파일은 언어(`en`·`ko`)에 맞는 글을 고르고, 실제 분쟁 번호(`PP-R-…`)로 표시 줄을 찾기만 한다. 계산 없음.
 *
 * 실제 값과의 경계 (시드 머리말 그대로):
 * - 표시용 주문 번호(#1042 …)는 화면용이다. 실제 PayPal 분쟁 번호는 `paypalRef`로 보조 줄에 남긴다.
 * - 서연 기록의 Nov 9 줄(`source: 'paypal'`)과 분쟁 접수 줄은 실제 PayPal 값이 쓴다 (`seoyeonHistoryEvents`).
 * - 예방 줄 건수("5 orders")는 표시용이다. 실제 추적 등록 대상은 `realTrackingTargets`(O05·O07)다.
 */
import type { CaseEvent } from '@/types';

import { seedDemoDisplay } from '../../../seed/index';
import type { DemoDisplay } from '../../../seed/demo-schema';
import { currentLocale, type Locale } from './copy';

export type DemoOrderLabel = DemoDisplay['orderLabels'][number];
export type DemoHistoryLine = DemoDisplay['seoyeonHistory'][number];
export type DemoPreventRow = DemoDisplay['preventRows'][number];

/** 화면에 쓰는 표시 줄 하나 (언어를 고른 값). */
export type DisplayLabel = {
  key: DemoOrderLabel['key'];
  /** 표시용 주문 번호 ("#1042"). Demo data. */
  displayNo: string;
  /** 실제 PayPal 분쟁 번호 (보조 줄). 연결이 없으면 `null`. */
  paypalRef: string | null;
  /** "Seo-yeon Kim · KR" (시안 who). Demo data. */
  who: string;
  /** "Wool Sweater" (시안 pname). Demo data. */
  product: string;
  /** 영어 상품 이름 (아이콘 고르기용 — 언어와 상관없이 같은 그림). */
  productEn: string;
  /** 표시 상품의 SKU (상품 거르개). */
  displaySku: string;
  /** "Not received · Customs hold" (시안 cats). Demo data. */
  category: string;
};

const pick = (locale: Locale, en: string, ko: string): string => (locale === 'ko' ? ko : en);

/**
 * 실제 분쟁 번호(`PP-R-…`) → 표시 줄. 시드 `paypalRef`가 같은 줄만 (번호를 코드에 쓰지 않는다).
 * 연결이 없으면 `null` → 화면은 지금처럼 실제 값을 쓴다.
 */
export function displayLabelFor(
  disputeId: string,
  locale: Locale = currentLocale(),
  display: DemoDisplay = seedDemoDisplay,
): DisplayLabel | null {
  const label = display.orderLabels.find((row) => row.paypalRef !== null && row.paypalRef === disputeId);
  if (label === undefined) return null;
  return {
    key: label.key,
    displayNo: label.displayNo,
    paypalRef: label.paypalRef,
    who: pick(locale, label.buyerLabel, label.buyerLabelKo),
    product: pick(locale, label.productName, label.productNameKo),
    productEn: label.productName,
    displaySku: label.displaySku,
    category: pick(locale, label.category, label.categoryKo),
  };
}

/** 예방 줄 하나 (언어를 고른 값). */
export type PreventRowLabel = {
  key: DemoPreventRow['key'];
  /** 표시 건수 (Demo data). 실제 등록 대상 수와 다를 수 있다. */
  count: number;
  /** "5 orders · Missing tracking". */
  line: string;
  /** "Shipped 3+ days ago · 4 countries". */
  who: string;
  /** 실제 추적 등록 대상 주문 (O05·O07). 표시 건수와 다르다. */
  realTargets: string[];
};

export function preventRowLabel(
  key: DemoPreventRow['key'],
  locale: Locale = currentLocale(),
  display: DemoDisplay = seedDemoDisplay,
): PreventRowLabel | null {
  const row = display.preventRows.find((r) => r.key === key);
  if (row === undefined) return null;
  return {
    key: row.key,
    count: row.count,
    line: pick(locale, row.line, row.lineKo),
    who: pick(locale, row.who, row.whoKo),
    realTargets: [...row.realTrackingTargets],
  };
}

/** 서연 기록 한 줄 (화면용). `flag`는 판매자 실수 줄(`actor: 'bad'`)에만 있다. */
export type DemoHistoryRow = {
  /** `YYYY-MM-DD` 또는 ISO 시각 (실제 줄). */
  at: string;
  tone: DemoHistoryLine['actor'];
  text: string;
  /** "Before DisputeLess · <flag>" 칩 글. `bad` 줄이 아니면 `null`. */
  flag: string | null;
  /** 시드 줄이면 참 → Demo data. 실제 PayPal 값이면 거짓. */
  demo: boolean;
  /** 실제 PayPal 값 줄 (Nov 9 구매자 글·분쟁 접수). */
  paypal: boolean;
};

const ymd = (at: string): string => at.slice(0, 10);

/**
 * 서연 사건 기록 = 시드 8줄 (시안 histT) + 실제 PayPal 값.
 *
 * - `source: 'seed'` 줄: 시드 글 그대로, Demo data.
 * - `source: 'paypal'` 줄(Nov 9): **실제** 샌드박스 분쟁의 마지막 구매자 글이 있으면 그 글과 실제 게시 날짜(Demo data 없음).
 *   실제 글이 없으면 시드 문장을 쓰되 Demo data로 표시한다 (실제인 척하지 않는다).
 * - 분쟁 접수: 실제 기록에 `dispute_opened`(source `sandbox`)가 있으면 그 줄을 날짜 순서에 더한다.
 * - "Before DisputeLess" 칩은 `actor: 'bad'` 줄에만 (시드의 `flag`). 다른 줄의 `flag`(예: "Promise missed")는 칩이 아니다.
 */
export function seoyeonHistoryRows(
  realEvents: readonly CaseEvent[],
  locale: Locale = currentLocale(),
  display: DemoDisplay = seedDemoDisplay,
): DemoHistoryRow[] {
  // 실제 샌드박스 분쟁의 마지막 구매자 글 (기록은 시각 순이다). 게시 날짜는 실제 값 그대로 쓴다
  const realBuyer = [...realEvents].reverse().find((event) => event.source === 'sandbox' && event.kind === 'buyer_message');
  const rows: DemoHistoryRow[] = display.seoyeonHistory.map((line) => {
    const flagText = line.flag === undefined ? null : pick(locale, line.flag, line.flagKo ?? line.flag);
    const base: DemoHistoryRow = {
      at: line.date,
      tone: line.actor,
      text: pick(locale, line.text, line.textKo),
      flag: line.actor === 'bad' ? flagText : null,
      demo: true,
      paypal: false,
    };
    if (line.source !== 'paypal') return base;
    return realBuyer === undefined ? base : { ...base, at: realBuyer.at, text: realBuyer.text, demo: false, paypal: true };
  });

  const opened = realEvents.filter((event) => event.source === 'sandbox' && event.kind === 'dispute_opened');
  for (const event of opened) {
    rows.push({ at: event.at, tone: 'sys', text: event.text, flag: null, demo: false, paypal: true });
  }
  // 날짜 순 (같은 날이면 넣은 순서 — 시드 줄 먼저). 정렬은 안정 정렬이다
  return rows.sort((a, b) => ymd(a.at).localeCompare(ymd(b.at)));
}
