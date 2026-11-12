/**
 * T121 단위 테스트: 시안 v6 표시용 시드 (seed/demo-display.json). 기준 SPEC v2.16, 결정 2026-11-12 20:35 ③.
 * 기대값 출처: docs/design/mockup-v6/Desk.dc.html (histT 8줄·pname·who·cats·other). 값은 시안에서 따로 옮겨 적었다.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { seedBuyers, seedDemoDisplay as d, seedDisputes, seedInquiries, seedOrders } from '../../seed/index';
import { demoDisplayProblems } from '../../seed/demo-schema';
import { demoDisplay } from '../../seed/demo-display';

const ROOT = path.resolve(__dirname, '../..');

describe('T121 서연 사건 기록 = 시안 histT 8줄', () => {
  const rows = d.seoyeonHistory;
  it('8줄, 날짜·문장이 시안과 같다', () => {
    expect(rows.map((r) => [r.date.slice(5), r.text])).toEqual([
      ['10-19', 'Order paid · $72'],
      ['10-21', 'Shipped. Tracking not added to PayPal.'],
      ['10-28', 'She asked: “Where is my order?”'],
      ['10-31', 'You replied 3 days later, in English: “Please wait, it’s coming.”'],
      ['11-02', 'She asked again: tracking hasn’t moved in a week.'],
      ['11-03', 'You promised: “It will arrive by Nov 5.”'],
      ['11-05', 'Nov 5 passed. Parcel still held at customs.'],
      ['11-09', 'She threatened a chargeback. No reply since.'],
    ]);
  });
  it('"Before DisputeLess" 칩은 판매자 실수 줄(10/21·10/31·11/03)에만', () => {
    expect(rows.filter((r) => r.merchantMistake).map((r) => r.date.slice(5))).toEqual(['10-21', '10-31', '11-03']);
    for (const r of rows) expect(r.merchantMistake).toBe(r.actor === 'bad');
  });
  it('11/09 줄은 실제 PayPal 값이 대신하고, 분쟁 접수 줄은 시드에 없다', () => {
    expect(rows.filter((r) => r.source === 'paypal').map((r) => r.date)).toEqual(['2026-11-09']);
    expect(rows.some((r) => /dispute (filed|opened)|분쟁 접수/i.test(r.text + r.textKo))).toBe(false);
  });
  it('한국어 문장도 시안과 같다 (첫·끝 줄)', () => {
    expect(rows[0]?.textKo).toBe('결제 완료 · $72');
    expect(rows[7]?.textKo).toBe('차지백 예고. 이후 무응답.');
  });
});

describe('T121 표시용 주문 번호', () => {
  it('서연 #1042 · 지호 #1038 · 마이크 #1047, PP-R 번호는 보조 값으로 같이 있다', () => {
    const by = Object.fromEntries(d.orderLabels.map((l) => [l.key, l]));
    expect(by.seoyeon).toMatchObject({ displayNo: '#1042', paypalRef: 'PP-R-GMS-10197661', seedDisputeId: 'D2', orderId: 'O01' });
    expect(by.mike).toMatchObject({ displayNo: '#1047', paypalRef: 'PP-R-FYT-10197651', seedDisputeId: 'D3', orderId: 'O08' });
    // 지호는 새 사건 — T119 뒤 연결. 지금은 연결 없음
    expect(by.jiho).toMatchObject({ displayNo: '#1038', paypalRef: null, seedDisputeId: null, orderId: null });
  });
  it('PP-R 번호는 config/demo-links.json의 실제 번호와 같다', () => {
    const links = JSON.parse(readFileSync(path.join(ROOT, 'config/demo-links.json'), 'utf8')).links as {
      paypalDisputeId: string;
      seedDisputeId: string | null;
    }[];
    for (const l of d.orderLabels.filter((x) => x.paypalRef !== null)) {
      expect(links.find((k) => k.seedDisputeId === l.seedDisputeId)?.paypalDisputeId, l.key).toBe(l.paypalRef);
    }
  });
  it('지호 구매일 = 시연일 5주 전, 반품 기간 30일 (시드)', () => {
    expect(d.jihoPurchase).toEqual({ orderDate: '2026-10-06', returnWindowDays: 30, weeksAgo: 5 });
  });
});

describe('T121 상품·손님 표기 (시안 pname·who)', () => {
  it('상품 이름', () => {
    expect(Object.fromEntries(d.productNames.map((p) => [p.key, p.name]))).toEqual({
      cardigan: 'Knit Cardigan',
      sweater: 'Wool Sweater',
      coat: 'Cashmere Coat',
      beanie: 'Beanie + Scarf',
    });
    expect(d.productNames.find((p) => p.key === 'sweater')?.nameKo).toBe('울 스웨터');
  });
  it('손님 이름 · 국가', () => {
    expect(Object.fromEntries(d.guestLabels.map((g) => [g.buyerId, g.label]))).toEqual({
      B01: 'Seo-yeon Kim · KR',
      B02: 'Ji-ho Park · KR',
      B05: 'Lena K. · DE',
      B03: 'Yuki T. · JP',
      B04: 'buyer_m · US',
    });
  });
});

describe('T121 예방 줄·데모 항목', () => {
  it('예방 줄 표시 문구와 건수', () => {
    expect(d.preventRows.map((r) => [r.count, r.line])).toEqual([
      [5, '5 orders · Missing tracking'],
      [3, '3 orders · Customs ID missing'],
    ]);
  });
  it('실제 추적 등록 대상은 O05·O07만이고 둘 다 시드에서 추적 미등록이다', () => {
    const targets = d.preventRows.flatMap((r) => r.realTrackingTargets);
    expect(targets).toEqual(['O05', 'O07']);
    for (const id of targets) expect(seedOrders.find((o) => o.id === id)?.tracked).toBe(false);
  });
  it('Lena #1029: Refund promised · $24 · 11/6 약속 · DE, PayPal 사건 아님', () => {
    const lena = d.demoItems.find((i) => i.key === 'lena');
    expect(lena).toMatchObject({
      displayNo: '#1029',
      category: 'Refund promised',
      refundCents: 2400,
      promisedDate: '2026-11-06',
      country: 'DE',
      paypalRef: null,
      action: 'Refund $24',
    });
  });
  it('Yuki #1051: Question · Size · JP · AI 답 size M is 64 cm long', () => {
    const yuki = d.demoItems.find((i) => i.key === 'yuki');
    expect(yuki).toMatchObject({ displayNo: '#1051', category: 'Question · Size', country: 'JP', paypalRef: null });
    expect(yuki?.aiAnswer).toBe('AI answered: size M is 64 cm long');
  });
});

describe('T121 시드와 맞물림', () => {
  it('어긋난 줄이 없다', () => {
    expect(demoDisplayProblems(d, seedOrders, seedBuyers, seedDisputes)).toEqual([]);
  });
  it('JSON이 소스(demo-display.ts)와 같다 — npm run seed 뒤 커밋 누락 방지', () => {
    expect(JSON.parse(readFileSync(path.join(ROOT, 'seed/demo-display.json'), 'utf8'))).toEqual(JSON.parse(JSON.stringify(demoDisplay)));
  });
  it('전부 Demo data 표시가 있고 이메일·통관번호 값이 없다', () => {
    const raw = readFileSync(path.join(ROOT, 'seed/demo-display.json'), 'utf8');
    expect(d.isDemo).toBe(true);
    expect(raw).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    expect(raw).not.toMatch(/P\d{12}/);
  });
  it('Nov 2 서연 첫 메시지가 시안 문장이다', () => {
    const q = seedInquiries.find((x) => x.buyerId === 'B01' && x.date === '2026-11-02');
    expect(q?.english).toBe("Tracking hasn't moved in a week. Could you check?");
  });
});
