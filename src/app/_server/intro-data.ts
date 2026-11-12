/**
 * /demo/seller-dashboard 사건 줄 (T115, 사람 결정 2026-11-12 11:20 (2)-④). **서버에서만** 부른다.
 *
 * - 출처는 Desk와 같다: 연결 표(`config/demo-links.json`, 화면에 내는 건만) → 시드 분쟁·구매자·주문·상품,
 *   응답 기한은 Desk가 읽어 둔 **읽기 캐시**의 분쟁 상세(`seller_response_due_date`, 없으면 `buyer_response_due_date`).
 * - **PayPal을 부르지 않는다** (`peekCachedRead`는 담긴 값만 꺼낸다). 캐시가 비면 `fallbackDue`(연결 표 기준 고정값)를 쓴다.
 * - 대목까지 남은 날은 Desk 위쪽 막대와 같은 함수 (`peakDaysLeft`).
 * - `warmTodayReads`: 서연 화면이 바로 뜨게 Today가 읽을 분쟁 목록·상세를 뒤에서 읽어 캐시를 데운다 (응답을 기다리지 않는다).
 */
import 'server-only';

import { after } from 'next/server';

import { CARD_COMPANY_TERMS } from '@/engine/signals';
import { DISPUTES_PATH, disputeDetailSchema, getDispute, listDisputes } from '@/paypal/disputes';
import { INR_REASON } from '@/paypal/mapper';

import { seedBuyers, seedDisputes, seedInquiries, seedOrders, seedProducts } from '../../../seed/index';
import { screenLinks } from '../_shared/demo-links';
import { toDollarsCents } from '../_shared/money';
import { shortDate } from '../_shared/short-date';
import { peakDaysLeft } from '../today/model';
import introEn from '../../../config/intro.en.json';
import { getPayPalReadClient, peekCachedRead } from './paypal';

/** 화면에 그대로 옮기는 사건 줄 하나 (글자는 화면이 언어별 문구로 만든다). */
export type IntroCase = {
  id: string;
  /** 시드 구매자 이름 ("김서연 Seo-yeon Kim") → en "Seo-yeon Kim", ko "김서연". 한글이 없으면 둘 다 그대로. */
  buyer: { en: string; ko: string };
  product: string;
  /** 시드 주문 금액 표기 ("$72.00", `toDollarsCents`). */
  amount: string;
  /** PayPal 분쟁 사유 (`MERCHANDISE_OR_SERVICE_NOT_RECEIVED` …). */
  reason: string;
  /** 같은 구매자의 다른 미수령 분쟁이 시드에 있다 (Desk `seedPriorInrDisputes`와 같은 셈). */
  repeat: boolean;
  /** 응답 기한 표기 (UTC 날짜: en "Nov 30", ko "11/30"). 없으면 null — 심사 중. */
  due: { en: string; ko: string } | null;
  /** 구매자 글에 카드사·차지백 낱말 (엔진 `CARD_COMPANY_TERMS`). */
  mentionsChargeback: boolean;
};

const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;

function buyerNames(seedName: string): { en: string; ko: string } {
  const words = seedName.trim().split(/\s+/).filter((w) => w !== '');
  const ko = words.filter((w) => HANGUL.test(w)).join(' ');
  const en = words.filter((w) => !HANGUL.test(w)).join(' ');
  return { en: en || ko, ko: ko || en };
}

/** ISO → 표기만 (계산 없음). */
function dueLabels(iso: string): { en: string; ko: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return { en: shortDate(iso), ko: m === null ? iso : `${Number(m[2])}/${Number(m[3])}` };
}

export type IntroData = { cases: IntroCase[]; peakDays: number };

/** 시험·캐시 비었을 때: 연결 표 기준 고정 기한 (DECISIONS v2.2 판매자 응답 기한). */
const FALLBACK_DUE: Record<string, string> = introEn.fallbackDue;

function cachedDue(disputeId: string): string | null | undefined {
  const parsed = disputeDetailSchema.safeParse(peekCachedRead(`${DISPUTES_PATH}/${disputeId}`));
  if (!parsed.success) return undefined; // 캐시 없음
  const due = parsed.data.seller_response_due_date?.trim() || parsed.data.buyer_response_due_date?.trim() || '';
  return due === '' ? null : due;
}

export function loadIntroData(now: Date = new Date()): IntroData {
  const links = screenLinks();
  // 서연(첫 장면 목적지)을 맨 위에, 나머지는 연결 표 순서
  const target = introEn.targetDisputeId;
  const ordered = [...links.filter((l) => l.paypalDisputeId === target), ...links.filter((l) => l.paypalDisputeId !== target)];
  const cases: IntroCase[] = [];
  for (const link of ordered) {
    const seed = seedDisputes.find((d) => d.id === link.seedDisputeId);
    if (seed === undefined) continue;
    const buyer = seedBuyers.find((b) => b.id === seed.buyerId);
    const order = seedOrders.find((o) => o.id === seed.orderId);
    const product = seedProducts.find((p) => p.sku === seed.sku);
    const words = seedInquiries.filter((q) => q.buyerId === seed.buyerId).map((q) => q.english.toLowerCase());
    const fromCache = cachedDue(link.paypalDisputeId);
    const due = fromCache === undefined ? (FALLBACK_DUE[link.paypalDisputeId] ?? null) : fromCache;
    cases.push({
      id: link.paypalDisputeId,
      buyer: buyerNames(buyer?.name ?? ''),
      product: product?.itemName ?? seed.sku,
      amount: toDollarsCents(order?.amountCents ?? 0),
      reason: seed.reason,
      repeat: seedDisputes.some((d) => d.buyerId === seed.buyerId && d.reason === INR_REASON && d.id !== seed.id),
      due: due === null ? null : dueLabels(due),
      mentionsChargeback: words.some((text) => CARD_COMPANY_TERMS.some((term) => text.includes(term.toLowerCase()))),
    });
  }
  return { cases, peakDays: peakDaysLeft(now) };
}

/** Today가 읽을 분쟁 목록·상세를 응답 뒤에 읽어 둔다 (읽기 캐시 데우기). 요청 밖(시험)이면 아무것도 하지 않는다. */
export function warmTodayReads(): void {
  try {
    after(async () => {
      const resolved = getPayPalReadClient();
      if (!resolved.ok) return;
      const client = resolved.client;
      await Promise.allSettled([listDisputes(client), ...screenLinks().map((l) => getDispute(client, l.paypalDisputeId))]);
    });
  } catch {
    // 요청 밖 — 데우지 않는다
  }
}
