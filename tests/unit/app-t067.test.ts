/**
 * T067 단위 테스트: 공용 틀 디자인(시안 v3 값) + 추적 표 등록 버튼.
 *
 * 기대값 출처: `tasks/T067.md` "시안에서 따르는 값"·"고칠 것"·"완료 기준", 안전 규칙은 `tasks/T063.md`.
 * **실호출 0회** — PayPal은 가짜 호출기(`get`·`call`을 세기만 한다), 스위치는 테스트 안의 가짜 env뿐이다.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { t } from '@/app/_shared/copy';
import type { TrackingSummary } from '@/app/today/model';
import { TrackingDetail } from '@/app/today/tracking-detail';
import { TrackingRegister } from '@/app/today/tracking-register';
import { addButtonLabel, trackingOutcome, type TrackingOutcome } from '@/app/today/tracking-result';
import { trackingNumberFor } from '@/paypal/track';
import type { ApiRequest, PayPalClient } from '@/types';

import manifestJson from '../sandbox/manifest.json';

vi.mock('server-only', () => ({}));
(globalThis as { React?: typeof React }).React = React;

const { registerTrackingFromScreen, registerTargets } = await import('@/app/_server/tracking-register');

const ROOT = path.resolve(__dirname, '../..');
const APP = path.join(ROOT, 'src/app');
const strip = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const html = (element: React.ReactElement) => renderToStaticMarkup(element);

type ManifestOrder = { key: string; orderId: string; tracked: boolean; captureId?: string };
const ORDERS = (manifestJson as { orders: ManifestOrder[] }).orders;
const orderIdOf = (key: string) => ORDERS.find((o) => o.key === key)?.orderId as string;

// ── 가짜 호출기 ────────────────────────────────────────────────────────────

type Fake = PayPalClient & { gets: string[]; posts: ApiRequest[] };

/** 주문 상세 GET은 manifest의 `tracked`대로 답한다. POST는 세고 `postStatus`(기본 201)로 답한다. */
function fakeClient(options: { postStatus?: (key: string) => number } = {}): Fake {
  const client = {
    gets: [] as string[],
    posts: [] as ApiRequest[],
    get: async (p: string) => {
      client.gets.push(p);
      const id = decodeURIComponent(p.split('/').pop() ?? '');
      const order = ORDERS.find((o) => o.orderId === id);
      const trackers = order?.tracked ? [{ id: 'T', status: 'SHIPPED' }] : [];
      return {
        status: 200,
        body: { id, purchase_units: [{ shipping: { trackers }, payments: { captures: [{ id: `CAP-${order?.key ?? 'X'}` }] } }] },
      };
    },
    call: async (request: ApiRequest) => {
      client.posts.push(request);
      const id = decodeURIComponent(request.path.split('/')[4] ?? '');
      const key = ORDERS.find((o) => o.orderId === id)?.key ?? '';
      const status = options.postStatus?.(key) ?? 201;
      return status < 300
        ? { status, body: { id } }
        : { status, body: { name: 'UNPROCESSABLE_ENTITY', details: [{ issue: 'INVALID_PARAMETER' }], debug_id: 'dbg' } };
    },
  };
  return client as unknown as Fake;
}

const OFF: Record<string, string | undefined> = {};
const ON: Record<string, string | undefined> = {
  DEMO_MODE: 'recording',
  AFTERLOOP_TRACK_LIVE: '1',
  AFTERLOOP_TRACK_LIVE_ORDERS: 'O05,O07',
  AFTERLOOP_TRACK_RECORDING: '1',
};
const DISPUTED = ['O01', 'O02', 'O04', 'O08', 'O13'];
const postKeys = (client: Fake) =>
  client.posts.map((r) => ORDERS.find((o) => r.path.includes(encodeURIComponent(o.orderId)))?.key);

// ───────────────────────────── 추적 등록 버튼 ─────────────────────────────

describe('T067 추적 등록 (가짜 호출기)', () => {
  it('대상은 분쟁 없는 미등록 주문 O05·O07뿐이다 (분쟁 걸린 주문은 조회도 하지 않는다)', async () => {
    const client = fakeClient();
    expect(await registerTargets(client)).toEqual(['O05', 'O07']);
    for (const key of DISPUTED) expect(client.gets.some((p) => p.endsWith(orderIdOf(key))), key).toBe(false);
    expect(client.posts).toHaveLength(0);
  });

  it('스위치 꺼짐 → POST 0회, "Simulated · nothing was sent to PayPal" (추적번호를 보이지 않는다)', async () => {
    const client = fakeClient();
    const outcome = await registerTrackingFromScreen({ paypal: { ok: true, client }, env: OFF });
    expect(client.posts).toHaveLength(0);
    expect(outcome.kind).toBe('simulated');
    expect(outcome.line).toBe('Simulated · nothing was sent to PayPal');
    expect(outcome.rows.map((r) => r.key)).toEqual(['O05', 'O07']);
    expect(outcome.rows.every((r) => !r.ok && r.text === t('today.tracking.row.simulated'))).toBe(true);
    expect(JSON.stringify(outcome)).not.toContain(trackingNumberFor('O05'));
  });

  it('스위치 일부만 (녹화 확인 없음) → POST 0회', async () => {
    const client = fakeClient();
    const outcome = await registerTrackingFromScreen({
      paypal: { ok: true, client },
      env: { DEMO_MODE: 'recording', AFTERLOOP_TRACK_LIVE: '1', AFTERLOOP_TRACK_LIVE_ORDERS: 'O05,O07' },
    });
    expect(client.posts).toHaveLength(0);
    expect(outcome.kind).toBe('failed');
    expect(outcome.rows.map((r) => r.text)).toEqual([t('today.tracking.reason.notAllowed'), t('today.tracking.reason.notAllowed')]);
  });

  it('스위치 켜짐 (테스트 안 가짜 env) → O05·O07만 POST, "✓ 2 trackers added · Orders tracking API · 201" + 행마다 추적번호', async () => {
    const client = fakeClient();
    const outcome = await registerTrackingFromScreen({ paypal: { ok: true, client }, env: ON });
    expect(postKeys(client)).toEqual(['O05', 'O07']);
    for (const request of client.posts) {
      expect(request.method).toBe('POST');
      expect(request.path).toMatch(/^\/v2\/checkout\/orders\/[^/]+\/track$/);
    }
    expect(outcome.kind).toBe('added');
    expect(outcome.line).toBe('✓ 2 trackers added · Orders tracking API · 201');
    expect(outcome.rows).toEqual([
      { key: 'O05', text: `Tracking ${trackingNumberFor('O05')}`, ok: true },
      { key: 'O07', text: `Tracking ${trackingNumberFor('O07')}`, ok: true },
    ]);
  });

  it('허용 목록에 분쟁 주문을 넣어도 분쟁 걸린 주문은 POST 0회', async () => {
    const client = fakeClient();
    await registerTrackingFromScreen({
      paypal: { ok: true, client },
      env: { ...ON, AFTERLOOP_TRACK_LIVE_ORDERS: 'O05,O07,O02,O04,O13,O01,O08' },
    });
    expect(postKeys(client)).toEqual(['O05', 'O07']);
    for (const key of DISPUTED) expect(client.posts.some((r) => r.path.includes(orderIdOf(key))), key).toBe(false);
  });

  it('실패 → 행마다 이유 (문구 키. PayPal 응답 문장·debug_id는 싣지 않는다)', async () => {
    const client = fakeClient({ postStatus: (key) => (key === 'O07' ? 422 : 201) });
    const outcome = await registerTrackingFromScreen({ paypal: { ok: true, client }, env: ON });
    expect(outcome.kind).toBe('failed');
    expect(outcome.line).toBe('1 of 2 not added · see each order below');
    expect(outcome.rows).toEqual([
      { key: 'O05', text: `Tracking ${trackingNumberFor('O05')}`, ok: true },
      { key: 'O07', text: 'PayPal did not accept it (422)', ok: false },
    ]);
    expect(JSON.stringify(outcome)).not.toMatch(/UNPROCESSABLE|INVALID_PARAMETER|dbg/);
  });

  it('결과 줄 세 가지가 서로 다르다 (실제 / 가짜 / 실패)', async () => {
    const lines = await Promise.all([
      registerTrackingFromScreen({ paypal: { ok: true, client: fakeClient() }, env: ON }),
      registerTrackingFromScreen({ paypal: { ok: true, client: fakeClient() }, env: OFF }),
      registerTrackingFromScreen({ paypal: { ok: true, client: fakeClient({ postStatus: () => 500 }) }, env: ON }),
    ]);
    expect(lines.map((o) => o.kind)).toEqual(['added', 'simulated', 'failed']);
    expect(new Set(lines.map((o) => o.line)).size).toBe(3);
  });

  it('PayPal을 쓸 수 없으면 아무것도 부르지 않는다', async () => {
    const outcome = await registerTrackingFromScreen({ paypal: { ok: false }, env: ON });
    expect(outcome.kind).toBe('unavailable');
  });

  it('결과 옮기기: 대상이 없으면 "No orders to add right now."', () => {
    const empty = trackingOutcome({
      results: [],
      mode: 'dry_run',
      dryRun: true,
      counts: { added: 0, failed: 0, skipped: 0, excluded: 0, notAllowed: 0, dryRun: 0 },
      statusCodes: [],
    });
    expect(empty).toEqual({ kind: 'nothing', line: 'No orders to add right now.', rows: [] });
  });

  it('서버 액션은 브라우저 값 없이 process.env 게이트로 부른다 (보내기 관문은 그대로)', () => {
    const action = strip(readFileSync(path.join(APP, 'today/actions.ts'), 'utf8'));
    expect(action.startsWith("'use server'")).toBe(true);
    expect(action).toMatch(/export async function addTrackingAction\(\)/);
    expect(action).toMatch(/env:\s*process\.env/);
    const server = strip(readFileSync(path.join(APP, '_server/tracking-register.ts'), 'utf8'));
    expect(server).toMatch(/liveGateFromEnv\(\s*deps\.env/);
    expect(server).toMatch(/registerTrackers\(client/);
    expect(server).toMatch(/import 'server-only'/);
    const page = readFileSync(path.join(APP, 'page.tsx'), 'utf8');
    expect(page).toMatch(/<TrackingDetail tracking=\{view\.tracking\} register=\{addTrackingAction\} \/>/);
  });
});

describe('T067 추적 상세 화면', () => {
  const TRACKING: TrackingSummary = {
    untracked: [
      { key: 'O05', buyerName: 'Yuki T.', productName: 'Beanie + Scarf Set' },
      { key: 'O07', buyerName: 'Lena K.', productName: 'Knit Cardigan, Oat' },
    ],
    excluded: [
      { key: 'O02', buyerName: 'Ji-ho', productName: 'Knit Cardigan, Oat' },
      { key: 'O13', buyerName: 'Seo-yeon', productName: 'Navy Sweater' },
    ],
  };
  const register = async (): Promise<TrackingOutcome> => ({ kind: 'nothing', line: '', rows: [] });

  it('[Add both to PayPal] 버튼 (2건), 1건이면 "Add to PayPal"', () => {
    const markup = html(createElement(TrackingDetail, { tracking: TRACKING, register }));
    expect(markup).toMatch(/<button type="button" class="tracking-button">Add both to PayPal<\/button>/);
    expect(addButtonLabel(1)).toBe('Add to PayPal');
    expect(addButtonLabel(2)).toBe('Add both to PayPal');
    expect(addButtonLabel(3)).toBe('Add all 3 to PayPal');
    const one = html(createElement(TrackingDetail, { tracking: { ...TRACKING, untracked: TRACKING.untracked.slice(0, 1) }, register }));
    expect(one).toContain('>Add to PayPal</button>');
  });

  it('회색 줄(O02·O13 "In dispute — excluded")도 같은 4열 격자를 쓴다', () => {
    const markup = html(createElement(TrackingDetail, { tracking: TRACKING, register }));
    const rows = [...markup.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => m[1]);
    expect(rows).toHaveLength(5); // 머리 1 + 보통 2 + 회색 2
    for (const row of rows) expect(row.match(/<t[hd][ >]/g)?.length).toBe(4);
    expect(markup.match(/tracking-row tracking-row-excluded/g)?.length).toBe(2);
    expect(markup.match(/In dispute — excluded/g)?.length).toBe(2);
  });

  it('결과 줄 마크업: 상태 알림(role=status) + 주문별 줄', () => {
    const markup = html(
      createElement(TrackingRegister, {
        label: addButtonLabel(2),
        action: register,
        initial: { kind: 'simulated', line: t('today.tracking.result.simulated'), rows: [{ key: 'O05', text: t('today.tracking.row.simulated'), ok: false }] },
      }),
    );
    expect(markup).toContain('class="tracking-result tracking-result-simulated" role="status"');
    expect(markup).toContain('Simulated · nothing was sent to PayPal');
    expect(markup).toContain('O05');
  });
});

// ───────────────────────────── 디자인 값 (시안 v3) ─────────────────────────────

function filesUnder(dir: string, ext: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? filesUnder(full, ext) : full.endsWith(ext) ? [full] : [];
  });
}

const GLOBALS = strip(readFileSync(path.join(APP, 'globals.css'), 'utf8'));
const TODAY_CSS = strip(readFileSync(path.join(APP, 'today/today.css'), 'utf8'));
const SHELL_CSS = strip(readFileSync(path.join(APP, '_shared/shell.css'), 'utf8'));
const rule = (css: string, selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(css)?.[2] ?? '';

function lightVars(): Record<string, string> {
  const block = /^:root\s*\{([\s\S]*?)\n\}/m.exec(GLOBALS)?.[1] ?? '';
  return Object.fromEntries([...block.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

describe('T067 배치: 전체 폭', () => {
  it('가운데 고정 폭 상자가 없다 (본문 최대 폭 변수 = none)', () => {
    expect(lightVars()['--content-max']).toBe('none');
    expect(rule(GLOBALS, '.main')).toMatch(/max-width:\s*var\(--content-max\)/);
  });

  it('위쪽 막대는 화면 폭 전체 + 흰 바탕 + 아래 1px 구분선', () => {
    const bar = rule(SHELL_CSS, '.shell-bar');
    expect(bar).toMatch(/width:\s*100%/);
    expect(bar).toMatch(/background:\s*var\(--color-surface\)/);
    expect(bar).toMatch(/border-bottom:\s*1px solid var\(--color-divider\)/);
    expect(rule(SHELL_CSS, '.shell-bar-inner')).not.toMatch(/max-width|margin:\s*0 auto/);
  });

  it('T076 시안 v4: 상품 거르개 줄(옅은 회색) 아래 왼쪽 칸 약 400px(카드들) + 오른쪽 상세(흰 바탕)', () => {
    expect(rule(TODAY_CSS, '.main:has(> .today-page)')).toMatch(/padding:\s*0/);
    const columns = /grid-template-columns:\s*minmax\(0,\s*([0-9.]+)rem\)\s*minmax\(0,\s*1fr\)/.exec(TODAY_CSS);
    expect(Number(columns?.[1]) * 16).toBe(400);
    expect(rule(TODAY_CSS, '.product-filter')).toMatch(/background:\s*var\(--color-panel\)/);
    expect(rule(TODAY_CSS, '.product-filter')).toMatch(/overflow-x:\s*auto/);
    expect(rule(TODAY_CSS, '.today-group')).toMatch(/border-radius:\s*20px/);
    expect(rule(TODAY_CSS, '.weekly')).toMatch(/border-radius:\s*24px/);
    expect(rule(TODAY_CSS, '.today-detail')).toMatch(/background:\s*var\(--color-surface\)/);
    expect(TODAY_CSS).toMatch(/\.today-detail > \*\s*\{[^}]*max-width:\s*80rem/); // T061 값 유지
  });
});

describe('T067 색·글꼴·카드·알약·그림자 값', () => {
  it('시안 값: 목록 #F1EFEA · 상세 #FFFFFF · 구분선 #E4E6E9 · 본문 #3F4144 · 제목 #000000', () => {
    const v = lightVars();
    expect(v['--color-list-bg']).toBe('#f1efea');
    expect(v['--color-surface']).toBe('#ffffff');
    expect(v['--color-divider']).toBe('#e4e6e9');
    expect(v['--color-text-body']).toBe('#3f4144');
    expect(v['--color-heading']).toBe('#000000');
    expect(rule(GLOBALS, 'body')).toMatch(/color:\s*var\(--color-text-body\)/);
  });

  it('상태 알약 색: High 연분홍/진한 빨강 · Watch #FFF3D6/#6B4700 · 중립 #ECEEF0/#3F4144, 완전히 둥글게', () => {
    const v = lightVars();
    expect(v['--color-pill-high-bg']).toBe('#fbe7e4');
    expect(v['--color-pill-high-text']).toBe('#9e2414');
    expect(v['--color-pill-watch-bg']).toBe('#fff3d6');
    expect(v['--color-pill-watch-text']).toBe('#6b4700');
    expect(v['--color-pill-neutral-bg']).toBe('#eceef0');
    expect(v['--color-pill-neutral-text']).toBe('#3f4144');
    expect(rule(TODAY_CSS, '.today-pill')).toMatch(/border-radius:\s*var\(--radius-pill\)/);
    for (const tone of ['high', 'watch', 'neutral']) {
      expect(rule(TODAY_CSS, `.today-pill-${tone}`)).toMatch(new RegExp(`background:\\s*var\\(--color-pill-${tone}-bg\\)`));
    }
    // 탭·버튼도 알약
    expect(rule(SHELL_CSS, '.shell-tab')).toMatch(/border-radius:\s*var\(--radius-pill\)/);
    expect(rule(TODAY_CSS, '.tracking-button')).toMatch(/border-radius:\s*var\(--radius-pill\)/);
  });

  it('T076: 고른 항목 = 옅은 강조색 바탕 + 왼쪽 4px 강조색 띠 (시안 v4 모양, 파랑 대신 강조색)', () => {
    const selected = rule(TODAY_CSS, ".today-item[aria-current='true']");
    expect(selected).toMatch(/background:\s*var\(--color-accent-soft\)/);
    const band = rule(TODAY_CSS, ".today-item[aria-current='true']::before");
    expect(band).toMatch(/width:\s*4px/);
    expect(band).toMatch(/background:\s*var\(--color-accent\)/);
  });

  it('T076: 로고 = 글자 로고 "Dispute" + 강조색 "Less" + 밑줄 곡선(강조색) + "for PayPal sellers" 알약', () => {
    const bar = readFileSync(path.join(APP, '_shared/top-bar.tsx'), 'utf8');
    expect(bar).toMatch(/className="shell-wordmark" role="img" aria-label=\{name\}/);
    expect(bar).toMatch(/<svg className="shell-wordmark-curve"/);
    expect(rule(SHELL_CSS, '.shell-wordmark-accent')).toMatch(/color:\s*var\(--color-accent\)/);
    expect(rule(SHELL_CSS, '.shell-wordmark-curve path')).toMatch(/stroke:\s*var\(--color-accent\)/);
    expect(rule(SHELL_CSS, '.shell-wordmark')).toMatch(/font-weight:\s*900/);
    expect(t('nav.appName').endsWith(t('nav.appNameAccent'))).toBe(true);
    expect(t('nav.forSellers')).toBe('for PayPal sellers');
  });

  it('#0066F5·#0070E0·#003087 계열 파랑이 css 어디에도 없다 (RGB 거리 60 미만 금지)', () => {
    const rgb = (hex: string) => {
      const h = hex.replace('#', '');
      const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h.slice(0, 6);
      return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
    };
    const distance = (a: string, b: string) => Math.hypot(...rgb(a).map((x, i) => x - rgb(b)[i]));
    // T076 강화: 시안 v4의 파랑(그라데이션 끝 #60CDFF·#0B48C4·#001C64, 포커스 #097FF5, 로고 #00A8EA)도 금지
    const BLUES = [
      '#0066F5',
      '#0070E0',
      '#003087',
      '#0070BA',
      '#002991',
      '#60CDFF',
      '#001C64',
      '#0B48C4',
      '#097FF5',
      '#00A8EA',
      '#009CDE',
    ];
    // css만이 아니라 화면 코드(tsx·ts)도 본다 (인라인 색·SVG 속성)
    for (const file of [...filesUnder(APP, '.css'), ...filesUnder(APP, '.tsx'), ...filesUnder(APP, '.ts')]) {
      // 주석(금지 색 이름을 적어 둔 설명)은 빼고 본다
      for (const [hex] of strip(readFileSync(file, 'utf8')).matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)) {
        for (const blue of BLUES) {
          expect(distance(hex, blue), `${path.relative(ROOT, file)} ${hex} vs ${blue}`).toBeGreaterThanOrEqual(60);
        }
      }
    }
  });
});
