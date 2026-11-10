/**
 * 인수 테스트 AC29: 실제 샌드박스 분쟁 ↔ 시드 연결 표 (잠금 파일, 실행만 하고 수정하지 않는다)
 * 기대값 출처: SPEC v2.5 9-4장 "연결 표" / 사람 승인 2026-11-10
 * 데이터만 본다 (코드 없음): config/demo-links.json, seed/, tests/sandbox/manifest.json
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { DemoLink, DemoLinksConfig, SeedDispute, SeedOrder } from '@/types';

const ROOT = path.resolve(__dirname, '../..');
const read = <T>(file: string): T => JSON.parse(readFileSync(path.join(ROOT, file), 'utf8')) as T;

type Manifest = {
  orders: { key: string; buyer: string }[];
  disputes: { key: string; disputeId: string; orderKey: string; demoExcluded?: boolean }[];
};

const config = read<DemoLinksConfig>('config/demo-links.json');
const seedDisputes = read<SeedDispute[]>('seed/disputes.json');
const seedOrders = read<SeedOrder[]>('seed/orders.json');
const manifest = read<Manifest>('tests/sandbox/manifest.json');

const links = config.links;
const byPaypalId = (id: string): DemoLink | undefined => links.find((l) => l.paypalDisputeId === id);
const linkForKey = (key: string): DemoLink | undefined => {
  const m = manifest.disputes.find((d) => d.key === key);
  return m ? byPaypalId(m.disputeId) : undefined;
};

/** manifest 키 규칙: D1~D3 = 시연 분쟁, P… = 연습용 분쟁, 그 밖(D2-old 등) = 시연 제외 */
const isPractice = (key: string) => /^P\d+$/.test(key);

describe('AC29 연결 표의 모양', () => {
  it('모든 줄이 계약(DemoLink) 모양이고 분쟁 ID가 겹치지 않는다', () => {
    expect(typeof config.version).toBe('string');
    expect(links.length).toBeGreaterThanOrEqual(4);
    for (const l of links) {
      expect(l.paypalDisputeId, l.paypalDisputeId).toMatch(/^PP-[A-Z]-[A-Z0-9]{3}-\d+$/);
      expect(typeof l.showOnScreen, l.paypalDisputeId).toBe('boolean');
      expect(typeof l.liveSendAllowed, l.paypalDisputeId).toBe('boolean');
      expect(l.seedDisputeId === null || typeof l.seedDisputeId === 'string', l.paypalDisputeId).toBe(true);
      expect(l.carrierOrderId === null || typeof l.carrierOrderId === 'string', l.paypalDisputeId).toBe(true);
    }
    expect(new Set(links.map((l) => l.paypalDisputeId)).size).toBe(links.length);
  });

  it('표의 분쟁은 모두 manifest에 있고, manifest의 분쟁은 모두 표에 있다', () => {
    const manifestIds = manifest.disputes.map((d) => d.disputeId).sort();
    expect(links.map((l) => l.paypalDisputeId).sort()).toEqual(manifestIds);
  });

  it('시드 분쟁을 가리키는 줄: 그 시드 분쟁이 있고, 배송사 주문은 그 분쟁의 주문이다. 시드 분쟁 하나에 줄 하나', () => {
    const withSeed = links.filter((l) => l.seedDisputeId !== null);
    for (const l of withSeed) {
      const seed = seedDisputes.find((d) => d.id === l.seedDisputeId);
      expect(seed, l.paypalDisputeId).toBeDefined();
      expect(seed!.source, l.paypalDisputeId).toBe('sandbox');
      expect(l.carrierOrderId, l.paypalDisputeId).toBe(seed!.orderId);
      expect(seedOrders.some((o) => o.id === l.carrierOrderId), l.paypalDisputeId).toBe(true);
    }
    expect(new Set(withSeed.map((l) => l.seedDisputeId)).size).toBe(withSeed.length);
    for (const l of links.filter((x) => x.seedDisputeId === null)) expect(l.carrierOrderId, l.paypalDisputeId).toBeNull();
  });
});

// 사람 승인 2026-11-10: 네 경우
describe('AC29 화면에 보임 · 실제 전송 허용 (네 경우)', () => {
  it('지호 D1·서연 D2: 화면 O, 전송 O', () => {
    for (const key of ['D1', 'D2']) {
      const l = linkForKey(key);
      expect(l, key).toBeDefined();
      expect(l!.seedDisputeId, key).toBe(key);
      expect(l!.showOnScreen, key).toBe(true);
      expect(l!.liveSendAllowed, key).toBe(true);
    }
    expect(linkForKey('D2')!.paypalDisputeId).toBe('PP-R-GMS-10197661');
    expect(linkForKey('D2')!.carrierOrderId).toBe('O01'); // 배송사 정보는 시드 주문 O01 (실제 분쟁은 샌드박스 주문 O13)
  });

  it('buyer_m D3 (PayPal 심사 단계): 화면 O, 전송 X', () => {
    const l = linkForKey('D3');
    expect(l).toBeDefined();
    expect(l!.seedDisputeId).toBe('D3');
    expect(l!.showOnScreen).toBe(true);
    expect(l!.liveSendAllowed).toBe(false);
  });

  it('옛 서연 분쟁 PP-R-GAH-10197649: 화면 X, 전송 X', () => {
    const l = byPaypalId('PP-R-GAH-10197649');
    expect(l).toBeDefined();
    expect(l!.seedDisputeId).toBeNull();
    expect(l!.showOnScreen).toBe(false);
    expect(l!.liveSendAllowed).toBe(false);
  });

  it('연습용 분쟁 (manifest 키 P…, 걸리면 추가): 화면 X, 전송 O이고 manifest에 시연 제외로 적혀 있다', () => {
    // 아직 걸리지 않았으면 대상이 없다. 걸려서 manifest에 들어오면 이 검사가 연결 표에도 넣으라고 요구한다.
    for (const m of manifest.disputes.filter((d) => isPractice(d.key))) {
      expect(m.demoExcluded, m.key).toBe(true);
      const l = byPaypalId(m.disputeId);
      expect(l, m.key).toBeDefined();
      expect(l!.seedDisputeId, m.key).toBeNull();
      expect(l!.showOnScreen, m.key).toBe(false);
      expect(l!.liveSendAllowed, m.key).toBe(true);
    }
  });

  it('그 밖의 조합은 없다: 화면에 보이는 것은 시연 분쟁 D1~D3뿐이고, 화면에 안 보이는데 전송되는 것은 연습용뿐이다', () => {
    const keyOf = (l: DemoLink) => manifest.disputes.find((d) => d.disputeId === l.paypalDisputeId)!.key;
    expect(links.filter((l) => l.showOnScreen).map(keyOf).sort()).toEqual(['D1', 'D2', 'D3']);
    for (const l of links.filter((x) => !x.showOnScreen && x.liveSendAllowed)) expect(isPractice(keyOf(l)), keyOf(l)).toBe(true);
    // manifest에서 시연 제외인 분쟁은 화면에 나오지 않는다
    for (const m of manifest.disputes.filter((d) => d.demoExcluded === true)) {
      expect(byPaypalId(m.disputeId)!.showOnScreen, m.key).toBe(false);
    }
    // 시드 분쟁이 없는 줄은 화면에 나오지 않는다
    for (const l of links.filter((x) => x.seedDisputeId === null)) expect(l.showOnScreen, l.paypalDisputeId).toBe(false);
  });
});
