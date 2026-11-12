import { describe, expect, it } from 'vitest';
import { J1038_REQUEST_ID, j1038Spec, renderLinks } from '../../scripts/create-sandbox-order-j1038';
import { buildOrderBody } from '../../scripts/create-sandbox-orders';

describe('T119 지호 주문 J1038', () => {
  it('상품명·가격은 시드에서 읽고 추적 없음', () => {
    const spec = j1038Spec();
    expect(spec).toMatchObject({ key: 'O20', buyer: 'jiho', sku: 'FK-CD-OAT', amount: '48.00', tracked: false });
    expect(spec.itemName).toMatch(/Knit Cardigan/);
  });
  it('요청 ID 고정, CAPTURE·USD', () => {
    expect(J1038_REQUEST_ID).toBe('afterloop-order-J1038');
    const body = buildOrderBody(j1038Spec()) as { intent: string; purchase_units: { amount: { currency_code: string } }[] };
    expect(body.intent).toBe('CAPTURE');
    expect(body.purchase_units[0]?.amount.currency_code).toBe('USD');
  });
  it('링크 파일에 샌드박스 주소만', () => {
    const text = renderLinks('ABC123', 'https://www.sandbox.paypal.com/checkoutnow?token=ABC123', j1038Spec());
    expect(text).toContain('www.sandbox.paypal.com');
    expect(text).not.toMatch(/https:\/\/www\.paypal\.com/);
  });
});
