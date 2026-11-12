/**
 * T122c: 시안 v6 한 장 카드 (지호 #1038 · Lena #1029 · Yuki #1051 · 추적 · Mike).
 * 카드 구조 · "On approval" 호출 이름 · Lena/Yuki 쓰기 0·Simulated · 지호 두 갈래 데이터.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { copyTables, t } from '@/app/_shared/copy';
import { planMove } from '@/engine/plan';
import { recommend } from '@/engine/recommend';

import { seedDemoDisplay } from '../../seed/index';
import { D1_JIHO, P, R, withSubtype } from '../acceptance/boards';

(globalThis as { React?: typeof React }).React = React;
vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ prefetch: () => undefined }) }));

const { OneCard } = await import('@/app/today/one-card');
const { DemoItemCard } = await import('@/app/today/demo-item-card');
const { OfferWork } = await import('@/app/today/offer-work');
const { TrackingDetail } = await import('@/app/today/tracking-detail');
const { approvalApiKey, jihoBranch, lossOf, tPick, buyerMessage, languageName, langCode } = await import(
  '@/app/today/one-card-data'
);

const ROOT = path.resolve(__dirname, '../..');
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');
const strip = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const html = (node: React.ReactElement) => renderToStaticMarkup(node);
const order = (markup: string, needles: string[]) => needles.map((needle) => markup.indexOf(needle));

describe('T122c-1 한 장 카드 구조 (시안 v6 L443–L478)', () => {
  const markup = html(
    createElement(OneCard, {
      titleId: 'x-title',
      title: 'Title',
      body: 'Body',
      keep: t('card.keep', { amount: '$34' }),
      message: { languageName: 'Korean', code: 'ko', original: '원문', translated: 'Original', tags: [{ text: 'Upset', bad: true }, { text: 'Calm' }] },
      steps: ['one', 'two', 'three', 'four'],
      rows: { head: ['Order', 'Buyer'], columns: '90px 1fr', rows: [{ cells: ['O05', 'Yuki'] }, { cells: ['O02', 'Ji-ho'], muted: true }] },
      draft: { title: t('card.draftT', { language: 'Korean' }), code: 'ko', original: '보낼 글', translated: 'To send', sent: false },
      approval: { label: t('card.apiT'), api: t('card.api.sendMessage') },
      action: createElement('button', { type: 'button', className: 'btn b-black' }, 'Send'),
    }),
  );

  it('순서: 구매자 대화 → 윗줄(AI·제목·설명 | Keeps) → 단계 → 표 → 보낼 글 → On approval 줄', () => {
    const at = order(markup, [
      'class="zone-buyer oc-buyer"',
      'class="oc-top"',
      'class="ai-pill"',
      'id="x-title"',
      'class="oc-body"',
      'class="oc-keep num">Keeps ≈$34</span>',
      'class="oc-steps"',
      'class="oc-ag" role="grid"',
      'class="oc-draft"',
      'class="oc-approve"',
    ]);
    for (const index of at) expect(index).toBeGreaterThanOrEqual(0);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    // 구매자 대화는 카드(zone-work) 밖, 앞
    expect(markup.indexOf('class="zone-buyer oc-buyer"')).toBeLessThan(markup.indexOf('class="zone-work oc"'));
  });

  it('구매자 대화: 언어 이름 · 원문(lang) · "Translated · …" · AI read 칩 (첫 칩 bad = c-bad)', () => {
    expect(markup).toContain(`<b class="oc-buyer-title">${t('card.convT')}</b><span class="oc-sub">Korean</span>`);
    expect(markup).toContain('<div class="oc-bub-orig" lang="ko">원문</div>');
    expect(markup).toContain(`<b class="oc-tr-lab">${t('card.tr')}</b> · Original`);
    expect(markup).toContain(`<span class="oc-airead">${t('card.aiRead')}</span><span class="chip c-bad">Upset</span><span class="chip c-n">Calm</span>`);
  });

  it('"How AI handled this" + 번호 원 1..4 + 보조 글', () => {
    expect(markup).toContain(`<b class="oc-steps-title">${t('card.aiT')}</b><span class="oc-sub">${t('card.aiS')}</span>`);
    for (const n of [1, 2, 3, 4]) expect(markup).toContain(`<span class="oc-step-n" aria-hidden="true">${n}</span>`);
    expect(markup).toContain('<span class="oc-step-t">four</span>');
  });

  it('표: 머리·줄 같은 열 격자, 회색 줄', () => {
    expect(markup.match(/style="grid-template-columns:90px 1fr"/g)?.length).toBe(3);
    expect(markup).toContain('class="oc-ag-r oc-ag-r-dn"');
  });

  it('보낼 글 상자: 보내기 전 옅은 파랑, 보낸 뒤 짙은 남색 + "Sent to the buyer (…)"', () => {
    expect(markup).toContain(`<b class="oc-draft-title">${t('card.draftT', { language: 'Korean' })}</b><div class="oc-draft-box">`);
    const sent = html(
      createElement(OneCard, {
        titleId: 's',
        title: 'T',
        steps: [],
        draft: { title: t('card.draftSentT', { language: 'Korean' }), code: 'ko', original: '보낸 글', translated: null, sent: true },
      }),
    );
    expect(sent).toContain('class="oc-draft-box oc-draft-box-sent"');
    expect(sent).toContain('Sent to the buyer (Korean)');
    expect(sent).not.toContain('oc-draft-tr');
  });

  it('On approval 줄: 라벨 + code 호출 이름 + 버튼. 없으면 줄 전체가 없다 (실행할 것이 없는 카드)', () => {
    expect(markup).toContain(`<span class="oc-approve-lab"><b>On approval</b><code class="oc-api">POST /v1/customer/disputes/{id}/send-message</code></span>`);
    expect(markup).toMatch(/<span class="oc-approve-act"><button type="button" class="btn b-black">Send<\/button><\/span>/);
    const none = html(createElement(OneCard, { titleId: 'n', title: 'T', steps: [] }));
    expect(none).not.toContain('oc-approve');
    expect(none).not.toContain('oc-steps');
    expect(none).not.toContain('zone-buyer');
  });

  it('CSS: 시안 인라인 값 그대로 (Keeps 알약 · 번호 원 · 보낼 글 상자 · code)', () => {
    const css = read('src/app/(app)/desk.css');
    expect(css).toContain('.dk .oc-keep{flex-shrink:0;padding:6px 12px;border-radius:1000px;background:#E3F3FF;color:#002991;font-size:13px;font-weight:900}');
    expect(css).toContain('.dk .oc-step-n{flex-shrink:0;width:24px;height:24px;border-radius:50%;background:#0A1B3D;color:#FFFFFF;font-size:12px;font-weight:900;');
    expect(css).toContain('.dk .oc-draft-box{border-radius:18px;padding:14px 16px;background:#F3F7FF;border:1px solid #CFE0FA}');
    expect(css).toContain('.dk .oc-draft-box-sent{background:#002991;color:#FFFFFF');
    expect(css).toContain('.dk .oc-api{font-family:ui-monospace,Menlo,monospace;font-size:12px;padding:3px 8px;border-radius:8px;background:#F1F3F6;color:#0B0F14}');
    expect(css).toContain('.dk .oc-approve{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding-top:4px;border-top:1px solid #E4E6E9}');
  });
});

describe('T122c-2 지호 두 갈래 (데이터로 고른다) · On approval 호출 이름', () => {
  it('새 품질 사건(B3) → repair · send-message, Keeps = 엔진 refund − repair', () => {
    const board = withSubtype(D1_JIHO, 'B3');
    const rec = recommend(board, P, R);
    const plan = planMove(board, rec.best!, P, R);
    expect(jihoBranch(rec.best?.move ?? null, plan)).toBe('repair');
    expect(t(approvalApiKey('repair'))).toBe('POST /v1/customer/disputes/{id}/send-message');
    expect(lossOf(rec, 'repair')).toBe('$16');
    expect(lossOf(rec, 'refund')).toBe('$50');
  });

  it('기존 색상 사례(B1) → offer · make-offer (15% $7.20)', () => {
    const rec = recommend(D1_JIHO, P, R);
    const plan = planMove(D1_JIHO, rec.best!, P, R);
    expect(plan.apiMove).toBe('make_offer');
    expect(plan.amountCents).toBe(720);
    expect(jihoBranch(rec.best?.move ?? null, plan)).toBe('offer');
    expect(t(approvalApiKey('offer'))).toBe('POST /v1/customer/disputes/{id}/make-offer');
  });

  it('그 밖(계획 없음 · 메시지만인데 repair 아님) → 한 장 카드 아님', () => {
    expect(jihoBranch('repair', null)).toBeNull();
    expect(jihoBranch('fight', { apiMove: 'send_message', amountCents: null })).toBeNull();
    expect(jihoBranch('offer', { apiMove: 'make_offer', amountCents: null })).toBeNull();
  });

  it('case-detail: 갈래는 jihoBranch, 호출 이름은 approvalApiKey, 반품 기간·주 수는 시드, 단계 금액은 엔진 lossOf', () => {
    const code = strip(read('src/app/cases/case-detail.tsx'));
    expect(code).toMatch(/const branch = jihoBranch\(rec\.best\?\.move \?\? null, plan\)/);
    expect(code.match(/api=\{t\(approvalApiKey\(branch\)\)\}/g)?.length).toBe(2);
    expect(code).toMatch(/kind="message"[\s\S]*kind="offer"/);
    expect(code).toMatch(/seedDemoDisplay\.jihoPurchase\.returnWindowDays/);
    expect(code).toMatch(/lossOf\(rec, 'repair'\)/);
    expect(code).toMatch(/lossOf\(rec, 'refund'\)/);
    // 초안이 없으면 "썼다"고 하지 않는다
    expect(code).toMatch(/hasDraft \? tPick\('card\.jiho\.repair\.s4', params\) : tPick\('card\.step\.noDraft', params\)/);
    expect(seedDemoDisplay.jihoPurchase.returnWindowDays).toBe(30);
  });

  it('repair 단계 글: 시안 문장 틀 + 엔진·시드 값 (en·ko 같은 자리표시자)', () => {
    const params = { name: 'Ji-ho', language: 'Korean', code: 'B3', label: 'Material or quality', refund: '$50', days: 30, weeks: 5, repair: '$16' };
    expect(tPick('card.jiho.repair.s2', params, 'en')).toBe('Classified it as B3 · Material or quality. The order is past the 30-day return window.');
    expect(tPick('card.jiho.repair.s3', params, 'en')).toContain('(≈$16 for you) vs. a full refund ($50)');
    expect(tPick('card.jiho.repair.b', params, 'en')).toBe(
      'Past the 30-day return window, so no return. A free repair keeps the sale and fixes her problem.',
    );
    expect(t('card.jiho.repair.t', undefined, 'en')).toBe('Offer a free repair, she covers shipping');
    expect(tPick('card.jiho.repair.s2', params, 'ko')).toContain('반품 기간(30일)');
  });

  it('지호 카드(메시지 갈래): 관문 canSend · 보내기 kind=message · 초안이 없으면 상자 대신 알림, 버튼 꺼짐 + Simulated', () => {
    const markup = html(
      createElement(OfferWork, {
        disputeId: 'PP-R-TEST-D1',
        base: {
          draft: { ok: false, reason: 'ai_unavailable', detail: 'test' },
          translation: null,
          facts: [],
          buyerLocale: 'ko',
          plan: { disputeId: 'PP-R-TEST-D1', move: 'send_message', apiMove: 'send_message', amountCents: null, refundType: null, messageTemplate: '' } as never,
          offerFirst: false,
          mode: 'simulated',
          draftSource: 'ai',
          riskAfterReply: null,
        },
        replyId: null,
        kind: 'message',
        title: t('card.jiho.repair.t'),
        body: 'b',
        amount: null,
        languageName: 'Korean',
        keep: t('card.keep', { amount: '$34' }),
        steps: ['a', 'b', 'c', 'd'],
        api: t(approvalApiKey('repair')),
      }),
    );
    expect(markup).toContain('>Offer a free repair, she covers shipping</h3>');
    expect(markup).toContain('Keeps ≈$34');
    expect(markup).toContain('<code class="oc-api">POST /v1/customer/disputes/{id}/send-message</code>');
    expect(markup).toMatch(/<button type="button" class="btn b-black" disabled=""[^>]*>Send<\/button>/);
    expect(markup).toContain(t('case.send.mode.simulated'));
    expect(markup).not.toContain('class="oc-draft"');
    const code = strip(read('src/app/today/offer-work.tsx'));
    expect(code).toMatch(/kind === 'offer'\s*\? canSendOffer\(view\)\s*: canSend\(view\)/);
  });
});

describe('T122c-3 Lena #1029 · Yuki #1051 = 데모 항목, 쓰기 0 · Simulated', () => {
  const lenaSeed = seedDemoDisplay.demoItems.find((item) => item.key === 'lena')!;
  const yukiSeed = seedDemoDisplay.demoItems.find((item) => item.key === 'yuki')!;

  it('Lena: 시드 제목·금액 · 독일어 원문+번역 · 4단계 · 환불 호출 이름 · [Refund $24] + "Simulated · no money moved" · Demo data', () => {
    const markup = html(createElement(DemoItemCard, { item: { ...lenaSeed, key: 'lena' } }));
    expect(markup).toContain(`>${lenaSeed.title}</h3>`);
    expect(markup).toContain('<div class="oc-bub-orig" lang="de">Hallo, Sie hatten mir am 6. November');
    expect(markup).toContain(t('card.lena.s1', { amount: '$24', date: 'Nov 6' }));
    expect(markup.match(/class="oc-step-n"/g)?.length).toBe(4);
    expect(markup).toContain('<code class="oc-api">POST /v2/payments/captures/{id}/refund · $24</code>');
    expect(markup).toMatch(/<button type="button" class="btn b-black">Refund \$24<\/button>/);
    expect(markup).toContain(t('card.simulatedNoMoney'));
    expect(markup).toContain(t('badge.demo'));
    expect(markup).toContain(t('card.draftT', { language: 'German' }));
  });

  it('Yuki: AI 답변 제목 · 일본어 · [Looks good] · "Simulated · not sent" · Auto 없음', () => {
    const markup = html(createElement(DemoItemCard, { item: { ...yukiSeed, key: 'yuki' } }));
    expect(markup).toContain(`>${yukiSeed.aiAnswer}</h3>`);
    expect(markup).toContain('lang="ja"');
    expect(markup).toMatch(/<button type="button" class="btn b-black">Looks good<\/button>/);
    expect(markup).toContain(`<code class="oc-api">${t('card.simulatedNotSent')}</code>`);
    expect(markup).not.toMatch(/Auto-sent|Already sent|automatically/i);
    for (const locale of ['en', 'ko'] as const) {
      for (const n of [1, 2, 3, 4]) expect(copyTables[locale][`card.yuki.s${n}`]).not.toMatch(/automatically|자동/);
    }
  });

  it('쓰기 0: 서버 액션·PayPal·AI·fetch를 import·호출하지 않는다 (누르면 화면 상태만)', () => {
    const code = strip(read('src/app/today/demo-item-card.tsx'));
    expect(code).not.toMatch(/actions['"]|sendReplyAction|addTrackingAction|fetch\(|@\/paypal|@\/exec|@\/ai|'use server'/);
    expect(code).toMatch(/function run\(\) \{[\s\S]*setDone\(true\);[\s\S]*markDone\(doneId, \{ simulated: true \}\)/);
    expect(code).toMatch(/disabled=\{done\}/);
  });

  it('KO: 시드 ko 글 · 버튼 "$24 환불"/"확인"', async () => {
    const { LocaleProvider } = await import('@/app/_shared/locale-context');
    const ko = html(createElement(LocaleProvider, { locale: 'ko' }, createElement(DemoItemCard, { item: { ...lenaSeed, key: 'lena' } })));
    expect(ko).toContain(`>${lenaSeed.titleKo}</h3>`);
    expect(ko).toContain('>$24 환불</button>');
    expect(ko).toContain('11월 6일');
    const yk = html(createElement(LocaleProvider, { locale: 'ko' }, createElement(DemoItemCard, { item: { ...yukiSeed, key: 'yuki' } })));
    expect(yk).toContain('>확인</button>');
    html(createElement(LocaleProvider, { locale: 'en' }, null));
  });
});

describe('T122c-4 추적 · 언어 도우미', () => {
  it('추적: 실제 호출 이름(주문마다 /track) · 단계 4 · Keeps = 엔진 trackingSavings 표기', () => {
    const markup = html(
      createElement(TrackingDetail, {
        tracking: { untracked: [{ key: 'O05', buyerName: 'Yuki T.', productName: 'Beanie' }, { key: 'O07', buyerName: 'Lena K.', productName: 'Cardigan' }], excluded: [] },
        savings: '$120',
        register: async () => ({ kind: 'nothing' as const, line: '', rows: [] }),
      }),
    );
    expect(markup).toContain('<code class="oc-api">POST /v2/checkout/orders/{id}/track · 2 orders</code>');
    expect(markup.match(/class="oc-step-n"/g)?.length).toBe(4);
    expect(markup).toContain('Keeps ≈$120');
    expect(markup).not.toMatch(/trackers-batch/);
  });

  it('언어 코드·이름, 구매자 글(실제 글 먼저, KO 화면은 번역 없음)', () => {
    expect(langCode('ko-KR')).toBe('ko');
    expect(langCode(null)).toBeNull();
    expect(languageName('de')).toBe('German');
    expect(languageName('xx')).toBeNull();
    const messages = [
      { source: 'demo' as const, badges: [], sourceKey: null, date: null, original: [{ text: 'old', mark: false }], english: null, englishBadges: [], originalIsEnglish: true },
      { source: 'paypal' as const, badges: [], sourceKey: null, date: null, original: [{ text: '올이 풀려요', mark: false }], english: [{ text: 'It unravels', mark: false }], englishBadges: [], originalIsEnglish: false },
    ];
    expect(buyerMessage(messages as never, 'ko-KR', 'en')).toMatchObject({ code: 'ko', original: '올이 풀려요', translated: 'It unravels', languageName: 'Korean' });
    expect(buyerMessage(messages as never, 'ko-KR', 'ko')?.translated).toBeNull();
    expect(buyerMessage([], 'ko-KR', 'en')).toBeNull();
  });
});
