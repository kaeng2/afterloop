/**
 * T087 단위 테스트: /listing 새 상품 등록 전 점검 (Scene 3). 기대값 출처: `tasks/T087.md` "만들 것"·"완료 기준",
 * SPEC v2.12 8-3장, DECISIONS "Scene 3 정직성". 숫자 기대값은 엔진(`checkListing`·`createListingSim`)을 따로 불러 얻는다.
 *
 * DOM 도구가 없어서 흐름은 화면과 같은 부품으로 돈다: reducer(`model.ts`) + 진행(`progress.ts`, 가짜 프레임) +
 * 그림(`listing-view.tsx`, 정적 렌더). 실제 AI·PayPal 호출 0회 (가짜 호출기·가짜 모듈).
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { checkListing, createListingSim, listingFixGains } from '@/engine/listing';
import type { ListingCheckInput, ListingFixKey, LlmCaller } from '@/types';

import listingEn from '../../config/listing.en.json';
import listingKo from '../../config/listing.ko.json';

vi.mock('server-only', () => ({}));
const todaySpy = vi.fn();
const paypalSpy = vi.fn();
vi.mock('@/app/_server/today', () => ({
  loadTodayForRequest: (...a: unknown[]) => todaySpy(...a),
  loadTrackingForRequest: (...a: unknown[]) => todaySpy(...a),
  loadTodayScreen: (...a: unknown[]) => todaySpy(...a),
}));
vi.mock('@/app/_server/paypal', () => ({
  getPayPalClient: (...a: unknown[]) => paypalSpy(...a),
  getPayPalReadClient: (...a: unknown[]) => paypalSpy(...a),
}));
const llmSpy = vi.fn();
vi.mock('@/app/_server/llm', () => ({ getLlm: () => ({ ok: true, llm: (req: unknown) => llmSpy(req) }) }));

(globalThis as { React?: typeof React }).React = React;
const { ListingScreenView } = await import('@/app/listing/listing-view');
const { buildView, initialState, makeReducer, toCheckInput } = await import('@/app/listing/model');
const { runListingCheck, paceFor } = await import('@/app/listing/progress');
const { default: MOTION } = await import('../../config/motion.json');
const { pct1, pts1 } = await import('@/app/listing/format');
const { listingFixesFor } = await import('@/app/listing/fixes');
const { POST } = await import('@/app/api/listing-check/route');
type ListingState = ReturnType<typeof initialState>;
type ListingAction = Parameters<ReturnType<typeof makeReducer>>[1];

const ROOT = path.resolve(__dirname, '../..');
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');
const strip = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*(\/\/|\*).*$/gm, '');

/** AC34의 기본 입력과 같은 값 (시안 기본, 영어) */
const BASE: ListingCheckInput = {
  fields: {
    desc: 'Chunky ribbed knit in a soft wool blend. Relaxed drop-shoulder fit. Also in Oatmeal and Charcoal.',
    size: 'S / M / L',
    ship: 'Ships worldwide.',
    ret: '',
  },
  priceCents: 8900,
  units: 200,
  saleFrom: '2026-11-20',
  saleTo: '2026-12-02',
};

/** AI 가짜 응답: 5칸은 통과, ret은 "free returns" 약속이라 코드가 막는다 → ok:false → 넣기 버튼 없음 */
const AI_JSON: Record<ListingFixKey, string> = {
  size: 'Size S / M / L: chest [__] cm, length [__] cm, sleeve [__] cm.',
  color: 'Color note: Ivory is a warm off-white, not pure white. It can look different under indoor light.',
  ship: 'We ship within [__] business days. Every order ships with tracking.',
  customs: 'For international orders we ask for your customs ID (or tax ID) at checkout.',
  bf: 'During Black Friday and the holiday peak season, delivery may take longer than usual.',
  ret: 'Free returns within [__] days.',
};

function fakeLlm(): { calls: unknown[]; llm: LlmCaller } {
  const calls: unknown[] = [];
  return {
    calls,
    llm: async (req) => {
      calls.push(req);
      return AI_JSON;
    },
  };
}

/** 가짜 타이머: tick()마다 켜진 타이머 콜백을 한 번 돌린다 (진짜 시간은 기다리지 않는다). 부른 간격(ms)도 기록한다 */
function fakeFrames() {
  const active = new Map<number, () => void>();
  const intervals: number[] = [];
  let handle = 0;
  return {
    api: {
      every: (cb: () => void, ms: number) => {
        intervals.push(ms);
        active.set(++handle, cb);
        return handle;
      },
      clear: (h: number) => void active.delete(h),
    },
    intervals,
    pending: () => active.size,
    tick: () => [...active.values()].forEach((cb) => cb()),
  };
}

/** 화면과 같은 짜임: reducer + 진행 + 그림 */
function harness(locale: 'en' | 'ko' = 'en', opts: { reduced?: boolean; pace?: (p: 'check' | 'recalc' | 'publish') => { intervalMs: number; step: number } } = {}) {
  const reducer = makeReducer(locale);
  let state: ListingState = initialState(locale);
  const frames = fakeFrames();
  const progress: number[] = [];
  let startedRun: number | null = null;
  let frameCount = 0;
  const dispatch = (a: ListingAction) => {
    state = reducer(state, a);
    const run = state.run;
    if (run && run.id !== startedRun) {
      startedRun = run.id;
      const id = run.id;
      runListingCheck(
        run.input,
        {
          onProgress: (done, total) => {
            progress.push(done);
            dispatch({ type: 'progress', id, done, total });
          },
          onDone: (calc) => dispatch({ type: 'finished', id, calc }),
        },
        frames.api,
        (opts.pace ?? paceFor)(run.purpose),
        opts.reduced ?? false,
      );
    }
  };
  const drain = () => {
    progress.length = 0;
    frameCount = 0;
    while (frames.pending() > 0) {
      frames.tick();
      frameCount += 1;
    }
    return { progress: [...progress], frames: frameCount };
  };
  const html = () => renderToStaticMarkup(React.createElement(ListingScreenView, { view: buildView(state, locale) }));
  return { dispatch, drain, html, get state() {
    return state;
  }, frames };
}

const valueOf = (html: string, name: string) => {
  const m = new RegExp(`data-value="${name}"[^>]*>([^<]*)<`).exec(html);
  return m?.[1].trim() ?? null;
};

describe('T087 흐름 (Publish → 진행 → 결과 → 고치기 → Recalculate → Publish → 완료)', () => {
  it('처음 화면: 시안 기본값, 가게 이름 Fernwood Knits, Demo mock 띠, 모달 없음', () => {
    const h = harness();
    const html = h.html();
    expect(toCheckInput(h.state.form)).toEqual(BASE);
    expect(html).toContain('Fernwood Knits');
    expect(html).toContain(listingEn.mockBand);
    expect(html).toContain('Ribbed Wool Crewneck, Ivory');
    expect(html).toContain('value="$89"');
    expect(html).toContain('value="200"');
    expect(html).toContain('Includes Black Friday week');
    expect(html).not.toContain('role="dialog"');
    expect(html).toContain('data-action="publish"');
  });

  it('진행 n은 step 결과 그대로 (config/motion.json: 70ms마다 +5), 500에서 결과, 결과 숫자 = checkListing(기본 입력)', () => {
    const CHUNK = MOTION.scene3.check.step;
    const h = harness();
    h.dispatch({ type: 'publish' });
    expect(h.state.screen).toBe('sheet');
    let html = h.html();
    expect(html).toContain('role="dialog"');
    expect(html).toContain('data-progress="0/500"');
    expect(html).toContain('Applying assumed dispute rates by type');
    expect(html).not.toContain('Comparing with your PayPal dispute history');

    // 타이머 간격은 설정값 (시안 70ms)
    expect(h.frames.intervals).toEqual([70]);
    expect(MOTION.scene3.check).toEqual({ intervalMs: 70, step: 5 });
    expect(MOTION.scene3.recalc).toEqual({ intervalMs: 70, step: 25 });

    // 한 번 울리면 5 / 500
    h.frames.tick();
    expect(h.state.run?.done).toBe(CHUNK);
    html = h.html();
    expect(html).toContain(`data-progress="${CHUNK}/500"`);
    expect(html).toContain(`Simulated ${CHUNK} / 500 sale periods`);

    // 같은 입력으로 따로 step한 값과 같다
    const ref = createListingSim(BASE);
    const expected: number[] = [];
    while (!ref.done()) expected.push(ref.step(CHUNK));
    const { progress, frames } = h.drain();
    expect([CHUNK, ...progress]).toEqual(expected);
    expect(frames).toBe(expected.length - 1);
    expect(expected.at(-1)).toBe(500);
    expect(expected).toHaveLength(100);

    const want = checkListing(BASE);
    expect(h.state.base?.result).toEqual(want);
    expect(h.state.base?.gains).toEqual(listingFixGains(BASE));
    html = h.html();
    expect(valueOf(html, 'prob')).toBe(pct1(want.pPerOrder));
    expect(pct1(want.pPerOrder)).toBe('4.5%'); // AC34 기본 입력 주문당 4.497%
    expect(html).toContain('$770'); // 평균 손실 $770.30
    expect(html).toContain('$472–$1,140'); // P10–P90
    expect(html).toContain('About 9.0 disputes if you sell 200');
    expect(html).toContain('Assumed rates (planning draft) · 500 simulations');
    expect(html).toContain('≈'); // Assumption 배지
    expect(html).toContain('Black Friday shipping');
    expect(html).toContain('See details and fix');
    expect(html).toContain('Publish anyway');
    // 점 그림 200개
    expect((html.match(/class="ls-dot[ "]/g) ?? []).length).toBe(200);
    // 유형 상위 3개
    expect((html.match(/class="ls-top-card"/g) ?? []).length).toBe(3);
    // 고칠 점 상위 4개, chance −x pts = listingFixGains 표기
    const gains = listingFixGains(BASE);
    const top4 = (Object.keys(gains) as ListingFixKey[])
      .filter((k) => (gains[k] ?? 0) > 0)
      .sort((a, b) => (gains[b] ?? 0) - (gains[a] ?? 0))
      .slice(0, 4);
    const shown = [...html.matchAll(/data-fix="(\w+)"/g)].map((m) => m[1]);
    expect(shown).toEqual(top4);
    for (const k of top4) expect(html).toContain(`chance −${pts1(gains[k] ?? 0)} pts`);
    // 계산 방법: params 값 ($15 수수료, 환불 50%)
    expect(html).toContain('$15 PayPal dispute fee');
    expect(html).toContain('refund 50% of the time');
    expect(html).not.toMatch(/\$8(?!\d)/); // 시안의 $8 수수료가 아님 ($89 가격은 제외)
  });

  it('상세 → Missing 표시 + AI 넣기(ok인 칸만) → Changed → Recalculate → 확률 내려감 → Publish → 완료 카드', async () => {
    const h = harness();
    // Publish 때 AI를 한 번 (가짜 호출기)
    const { calls, llm } = fakeLlm();
    h.dispatch({ type: 'draftsLoading', key: 'k' });
    h.dispatch({ type: 'publish' });
    h.drain();
    const drafts = await listingFixesFor({ productTitle: h.state.form.title, productDescription: h.state.form.desc }, llm);
    expect(calls).toHaveLength(1);
    expect(drafts?.ret.ok).toBe(false);
    h.dispatch({ type: 'drafts', key: 'k', drafts });

    h.dispatch({ type: 'toDetail' });
    expect(h.state.screen).toBe('detail');
    let html = h.html();
    const base = checkListing(BASE);
    expect(valueOf(html, 'prob')).toBe(pct1(base.pPerOrder));
    expect(html).toContain('Up to date');
    // 입력칸마다 Missing
    expect(html).toMatch(/data-missing="color"/);
    expect(html).toMatch(/data-missing="size"/);
    expect(html).toMatch(/data-missing="ship customs bf"/);
    expect(html).toMatch(/data-missing="ret"/);
    // ok인 칸만 넣기 버튼 (ret은 숨김)
    const inserts = [...html.matchAll(/data-insert="(\w+)"/g)].map((m) => m[1]);
    expect(inserts.sort()).toEqual(['bf', 'color', 'customs', 'ship', 'size']);

    // 넣기: 그 입력칸 끝에 붙고, 판정은 엔진 detectListingFeatures
    h.dispatch({ type: 'insert', fix: 'size' });
    expect(h.state.form.size).toBe(`S / M / L\n\n${AI_JSON.size}`);
    h.dispatch({ type: 'insert', fix: 'ship' });
    h.dispatch({ type: 'insert', fix: 'color' });
    html = h.html();
    expect(html).not.toMatch(/data-missing="size"/);
    expect(html).toMatch(/data-missing="customs bf"/);
    expect(html).toContain('<mark class="ls-blank">[__]</mark>');
    // T090: AI 문구 표시는 "AI" 알약 (출처 표시 3종)
    expect(html).toContain('class="ai-pill"');
    expect(html).toContain('Changed — recalculate');

    // Recalculate: 같은 진행 규칙
    h.dispatch({ type: 'recalc' });
    expect(h.state.run?.purpose).toBe('recalc');
    h.frames.tick();
    expect(h.frames.intervals.at(-1)).toBe(70);
    expect(h.html()).toContain(`Recalculating… ${MOTION.scene3.recalc.step} / 500`);
    h.drain();
    const after = checkListing(toCheckInput(h.state.form));
    expect(h.state.current?.result).toEqual(after);
    expect(after.pPerOrder).toBeLessThan(base.pPerOrder);
    html = h.html();
    expect(valueOf(html, 'prob')).toBe(pct1(after.pPerOrder));
    expect(html).toContain(`Before ${pct1(base.pPerOrder)}`);
    expect(html).toContain('Up to date');

    // Publish → 완료 카드 (이전 → 이후)
    h.dispatch({ type: 'publishFinal' });
    expect(h.state.screen).toBe('done');
    html = h.html();
    expect(valueOf(html, 'doneProb')).toBe(`Chance of a dispute ${pct1(base.pPerOrder)} → ${pct1(after.pPerOrder)}`);
    expect(html).toContain('Replay this scene');
    expect(html).toContain('Ribbed Wool Crewneck, Ivory is live.');

    // Replay → 처음 화면
    h.dispatch({ type: 'restart' });
    expect(h.state.screen).toBe('edit');
    expect(toCheckInput(h.state.form)).toEqual(BASE);
  });

  it('상세에서 글을 바꾸고 바로 Publish하면 다시 계산한 뒤 완료한다 (계산 안 한 숫자를 보이지 않는다)', () => {
    const h = harness();
    h.dispatch({ type: 'publish' });
    h.drain();
    h.dispatch({ type: 'toDetail' });
    h.dispatch({ type: 'edit', key: 'ret', value: 'Returns accepted.' });
    h.dispatch({ type: 'publishFinal' });
    expect(h.state.screen).toBe('detail');
    expect(h.state.run?.purpose).toBe('publish');
    h.drain();
    expect(h.state.screen).toBe('done');
    expect(h.state.published?.result).toEqual(checkListing(toCheckInput(h.state.form)));
  });

  it('Publish anyway → 완료 카드 (이전 = 이후)', () => {
    const h = harness();
    h.dispatch({ type: 'publish' });
    h.drain();
    h.dispatch({ type: 'publishAnyway' });
    const p = pct1(checkListing(BASE).pPerOrder);
    expect(valueOf(h.html(), 'doneProb')).toBe(`Chance of a dispute ${p} → ${p}`);
  });

  it('AI를 쓸 수 없으면 넣기 버튼이 없다 (기본 문구 없음)', async () => {
    expect(await listingFixesFor({ productTitle: 'x', productDescription: 'y' }, null)).toBeNull();
    const h = harness();
    h.dispatch({ type: 'publish' });
    h.drain();
    h.dispatch({ type: 'toDetail' });
    expect(h.html()).not.toContain('data-insert=');
  });

  it('ko: 문구는 listing.ko, 숫자는 en과 같다 (AI 문구는 영어 그대로)', () => {
    const en = harness('en');
    const ko = harness('ko');
    for (const h of [en, ko]) {
      h.dispatch({ type: 'publish' });
      h.drain();
    }
    const a = en.html();
    const b = ko.html();
    expect(b).toContain(listingKo.resT);
    expect(b).toContain('가정 확률(기획 초안) · 시뮬레이션 500회');
    expect(valueOf(b, 'prob')).toBe(valueOf(a, 'prob'));
    expect(ko.state.base?.result).toEqual(en.state.base?.result);
  });
});

describe('T087 진행 표시: setInterval·가짜 카운터 없음 (정적 검사)', () => {
  const files = readdirSync(path.join(ROOT, 'src/app/listing')).map((f) => `src/app/listing/${f}`);
  it('타이머는 progress.ts에서만, 진행은 sim.step(설정 step)이 돌려준 값, 속도는 config/motion.json에서 읽는다', () => {
    for (const file of files) {
      if (file.endsWith('progress.ts')) continue;
      const text = strip(read(file));
      expect(/setInterval|setTimeout/.test(text), file).toBe(false);
    }
    const progress = strip(read('src/app/listing/progress.ts'));
    expect(progress).toMatch(/setInterval/);
    expect(progress).toMatch(/sim\.step\(pace\.step\)/);
    expect(progress).toMatch(/config\/motion\.json/);
  });

  it('설정값을 바꾸면 속도가 바뀐다 (+25 / 25ms → 20번)', () => {
    const h = harness('en', { pace: () => ({ intervalMs: 25, step: 25 }) });
    h.dispatch({ type: 'publish' });
    expect(h.frames.intervals).toEqual([25]);
    const { progress } = h.drain();
    expect(progress).toHaveLength(20);
    expect(progress.at(-1)).toBe(500);
    expect(h.state.base?.result).toEqual(checkListing(BASE));
  });

  it('움직임 줄이기면 기다리지 않고 바로 결과 (결과 = checkListing)', () => {
    const h = harness('en', { reduced: true });
    h.dispatch({ type: 'publish' });
    expect(h.frames.pending()).toBe(0);
    expect(h.frames.intervals).toEqual([]);
    expect(h.state.run).toBeNull();
    expect(h.state.base?.result).toEqual(checkListing(BASE));
  });

  it('시안 모션 값: 진행 막대 width .07s linear, pulse = opacity .5↔1 + scale .92↔1.06 (1.2s), reduced-motion이면 끔', () => {
    const css = read('src/app/listing/listing.css');
    const fill = css.match(/\.ls-prog-fill\s*\{[^}]*\}/)?.[0] ?? '';
    expect(fill).toMatch(/transition:\s*width\s+0?\.07s\s+linear/);
    const kf = css.match(/@keyframes ls-pulse\s*\{[\s\S]*?\n\}/)?.[0].replace(/\s+/g, ' ') ?? '';
    expect(kf).toMatch(/0%, 100% \{ opacity: 0?\.5; transform: scale\(0?\.92\); \}/);
    expect(kf).toMatch(/50% \{ opacity: 1; transform: scale\(1\.06\); \}/);
    expect(css).toMatch(/\.ls-livedot\s*\{[^}]*animation:\s*ls-pulse 1\.2s/);
    expect(css).toMatch(/prefers-reduced-motion: reduce\)[\s\S]*animation: none !important[\s\S]*transition: none !important/);
  });

  it('진행 숫자는 progress 액션(= step 반환값)으로만 바뀐다', () => {
    const model = strip(read('src/app/listing/model.ts'));
    expect(model.match(/done: action\.done/g)).toHaveLength(1);
    expect(model).not.toMatch(/done\s*\+\s*\d|done\s*\+=|done\+\+/);
  });
});

describe('T087 POST /api/listing-check', () => {
  const post = (body: unknown) =>
    POST(new Request('http://localhost/api/listing-check', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }));

  it('결과 = checkListing = 화면 모달 결과', async () => {
    const res = await post(BASE);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { result: unknown };
    expect(json.result).toEqual(checkListing(BASE));
    const h = harness();
    h.dispatch({ type: 'publish' });
    h.drain();
    expect(json.result).toEqual(h.state.base?.result);
  });

  it('잘못된 입력은 400', async () => {
    const bads: unknown[] = [
      'not json',
      {},
      { ...BASE, units: 0 },
      { ...BASE, units: 1.5 },
      { ...BASE, units: 999999 },
      { ...BASE, priceCents: -1 },
      { ...BASE, saleFrom: '11/20/2026' },
      { ...BASE, saleFrom: '2026-12-10', saleTo: '2026-12-01' },
      { ...BASE, fields: { ...BASE.fields, ret: 5 } },
      { ...BASE, extra: true },
    ];
    for (const body of bads) {
      const res = await post(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(await res.json()).toEqual({ error: 'invalid_input' });
    }
  });

  it('PayPal·AI를 부르지 않는다 (정적 검사)', () => {
    const text = strip(read('src/app/api/listing-check/route.ts'));
    expect(text).not.toMatch(/paypal|_server|@\/ai|fetch\(/i);
  });
});

describe('T087 /listing: Today 읽기·PayPal 조회 0회', () => {
  it('page를 그려도 Today·PayPal 가짜 모듈이 불리지 않는다', async () => {
    todaySpy.mockClear();
    paypalSpy.mockClear();
    const { default: ListingPage } = await import('@/app/listing/page');
    const el = await ListingPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(el);
    expect(html).toContain('Fernwood Knits');
    expect(todaySpy).not.toHaveBeenCalled();
    expect(paypalSpy).not.toHaveBeenCalled();
    expect(llmSpy).not.toHaveBeenCalled(); // AI는 Publish 때만
  });

  it('route group (app) 밖이고, 화면 파일이 Today·PayPal을 import하지 않는다', () => {
    expect(readdirSync(path.join(ROOT, 'src/app')).includes('listing')).toBe(true);
    for (const f of readdirSync(path.join(ROOT, 'src/app/listing'))) {
      const text = strip(read(`src/app/listing/${f}`));
      expect(/_server\/(today|paypal|disputes)|@\/paypal|\(app\)/.test(text), f).toBe(false);
    }
  });

  it('서버 액션은 draftListingFixes를 한 번 부른다 (getLlm 호출기, 캐시·횟수 제한 그대로)', async () => {
    llmSpy.mockReset();
    llmSpy.mockResolvedValue(AI_JSON);
    const { draftListingFixesAction } = await import('@/app/listing/actions');
    const out = await draftListingFixesAction({ productTitle: 'Ribbed Wool Crewneck, Ivory', productDescription: BASE.fields.desc });
    expect(llmSpy).toHaveBeenCalledTimes(1);
    expect(out?.size.ok).toBe(true);
    expect(out?.ret.ok).toBe(false);
    expect(await draftListingFixesAction({ productTitle: '', productDescription: '' })).toBeNull();
    expect(llmSpy).toHaveBeenCalledTimes(1);
  });
});

describe('T087 색·문구 정직성', () => {
  const screenFiles = [
    ...readdirSync(path.join(ROOT, 'src/app/listing')).map((f) => `src/app/listing/${f}`),
    'src/app/api/listing-check/route.ts',
  ];
  it('화면 코드·css에 남보라(T089 이전 강조색)가 없고, 색은 시안 scene3 파랑을 쓴다', () => {
    for (const file of screenFiles) {
      const text = read(file).toLowerCase();
      for (const violet of ['#5b3cc4', '#a996f0', '#4a2499', '#6a46d6', '#f1edfc', '#cbbff3', '#e6e0fa', '#ece9f6', '#ddd7f0']) {
        expect(text, file).not.toContain(violet);
      }
    }
    const css = read('src/app/listing/listing.css').toLowerCase();
    for (const v of ['#0066f5', '#002991', '#60cdff']) expect(css).toContain(v);
  });

  it('"Knot & Co."·"PayPal disputes & sales"·"Comparing with your PayPal dispute history"가 없다', () => {
    const all = [...screenFiles, 'config/listing.en.json', 'config/listing.ko.json'].map(read).join('\n');
    for (const bad of ['Knot & Co.', 'PayPal disputes & sales', 'Comparing with your PayPal dispute history', 'PayPal 분쟁 이력과 비교', 'PayPal 분쟁·판매 이력']) {
      expect(all).not.toContain(bad);
    }
  });

  it('Black Friday 배송 안내에 숫자가 없고, 계산 설명은 수수료를 문구에 박지 않는다', () => {
    for (const c of [listingEn, listingKo]) {
      expect(/\d/.test(c.bfT + c.bfB), c.lang).toBe(false);
      expect(c.lossTip).toContain('{{fee}}');
      expect(c.lossTip).toContain('{{refundShare}}');
      expect(/\$\s*\d/.test(c.lossTip)).toBe(false);
      expect(c.anSteps[2]).not.toMatch(/PayPal/);
    }
    expect(listingEn.anSteps[2]).toBe('Applying assumed dispute rates by type');
    expect(listingEn.dataV).toBe('Assumed rates (planning draft) · {{runs}} simulations');
  });

  it('왼쪽 메뉴 "PayPal payments"는 아이콘 없이 글자만, 가게는 Fernwood Knits', () => {
    const html = harness().html();
    expect(html).toMatch(/<button type="button" class="ls-snav" aria-disabled="true">PayPal payments<\/button>/);
    expect(listingEn.store).toBe('Fernwood Knits');
    expect(listingKo.store).toBe('Fernwood Knits');
  });

  it('listing.en/ko 키 집합이 같다 (중첩 포함)', () => {
    const keys = (o: unknown, pre = ''): string[] =>
      o !== null && typeof o === 'object' && !Array.isArray(o)
        ? Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => [pre + k, ...keys(v, `${pre}${k}.`)])
        : [];
    expect(keys(listingKo).sort()).toEqual(keys(listingEn).sort());
    expect(listingKo.anSteps).toHaveLength(listingEn.anSteps.length);
    expect(listingKo.photoItems.map((p) => p.src)).toEqual(listingEn.photoItems.map((p) => p.src));
    expect(listingKo.demo).toEqual(listingEn.demo);
  });

  it('사진 4장이 public/listing에 있다', () => {
    const have = readdirSync(path.join(ROOT, 'public/listing'));
    for (const p of listingEn.photoItems) expect(have).toContain(path.basename(p.src));
  });
});

describe('T087 .next/static에 서버 전용 값 없음 (빌드 뒤에만)', () => {
  const STATIC = path.join(ROOT, '.next/static');
  let exists = true;
  try {
    readdirSync(STATIC);
  } catch {
    exists = false;
  }
  it.skipIf(!exists)('키 이름·AI 프롬프트·샌드박스 주소·남보라가 묶음에 없다', () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(path.join(dir, e.name)) : /\.(js|css)$/.test(e.name) ? [path.join(dir, e.name)] : [],
      );
    const banned = [/LLM_API_KEY/, /CLIENT_SECRET/, /api-m\.sandbox\.paypal\.com/, /You help a small online clothing seller/, /AI_LIVE_LIMIT/, /#5b3cc4|#a996f0/i];
    for (const file of walk(STATIC)) {
      const text = readFileSync(file, 'utf8');
      for (const re of banned) expect(re.test(text), `${path.relative(ROOT, file)} ${re}`).toBe(false);
    }
  });
});

describe('T087 메뉴', () => {
  it('위쪽 막대: Today · Black Friday rehearsal → /listing · Products → /products', async () => {
    const { TOP_TABS } = await import('@/app/_shared/top-bar');
    const { t } = await import('@/app/_shared/copy');
    expect(TOP_TABS.map((x) => x.href)).toEqual(['/', '/listing', '/products']);
    expect(TOP_TABS.map((x) => t(x.copyKey))).toEqual(['Today', 'Black Friday rehearsal', 'Products']);
    expect(TOP_TABS.map((x) => t(x.copyKey, undefined, 'ko'))).toEqual(['오늘', '블랙프라이데이 리허설', '상품']);
  });
});
