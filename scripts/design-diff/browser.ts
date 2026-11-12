// Playwright(playwright-core)로 한 상태를 한쪽(시안 또는 앱)에서 재현하고 캡처한다.
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CAPTURE, FIND_TARGET, HOOKS } from './page-scripts';
import type { ClickStep, ElementSnap, MotionSnap, SideCapture } from './types';

// 필요한 만큼만 적은 Playwright 모양 (설치 전에도 tsc가 통과하게)
interface PwVideo {
  path(): Promise<string>;
}
interface PwPage {
  goto(url: string, o?: Record<string, unknown>): Promise<unknown>;
  evaluate<T = unknown>(expr: string): Promise<T>;
  waitForTimeout(ms: number): Promise<void>;
  waitForSelector(sel: string, o?: Record<string, unknown>): Promise<unknown>;
  screenshot(o: Record<string, unknown>): Promise<Buffer>;
  mouse: { click(x: number, y: number): Promise<void> };
  video(): PwVideo | null;
  close(): Promise<void>;
}
interface PwContext {
  addInitScript(o: { content: string }): Promise<void>;
  newPage(): Promise<PwPage>;
  close(): Promise<void>;
}
export interface PwBrowser {
  newContext(o: Record<string, unknown>): Promise<PwContext>;
  close(): Promise<void>;
}

export async function launch(opts: { chrome?: string; channel?: string; headed?: boolean }): Promise<PwBrowser> {
  const name = 'playwright-core';
  let mod: { chromium: { launch(o: Record<string, unknown>): Promise<PwBrowser> } };
  try {
    mod = (await import(name)) as typeof mod;
  } catch (e) {
    throw new Error(`playwright-core를 불러오지 못했다. \`npm i -D playwright-core\` 뒤 다시 실행하세요. (${(e as Error).message})`);
  }
  const o: Record<string, unknown> = { headless: !opts.headed };
  if (opts.chrome) o.executablePath = opts.chrome;
  else o.channel = opts.channel ?? 'chrome';
  return mod.chromium.launch(o);
}

export const HEIGHT: Record<number, number> = { 1440: 1000, 1920: 1080 };

export interface SideRun {
  url: string;
  steps: ClickStep[];
  width: number;
  settleMs: number;
  selectors: string[];
  outDir: string;
  side: 'mock' | 'app';
  /** 앱 쪽만: 이 요소가 보일 때까지 기다린 뒤 시작 (Next loading.tsx 뼈대 화면 건너뛰기) */
  readySelector?: string;
}

export const APP_READY_TIMEOUT_MS = 20000;
export const FIND_TIMEOUT_MS = 10000;
export const FIND_POLL_MS = 250;

/** fn이 ok를 돌려줄 때까지(최대 timeoutMs) pollMs 간격으로 다시 부른다. 마지막 결과를 돌려준다. */
export async function retryFind<T extends { ok: boolean }>(
  fn: () => Promise<T>,
  wait: (ms: number) => Promise<void>,
  timeoutMs = FIND_TIMEOUT_MS,
  pollMs = FIND_POLL_MS,
): Promise<T> {
  let r = await fn();
  for (let waited = 0; !r.ok && waited < timeoutMs; waited += pollMs) {
    await wait(pollMs);
    r = await fn();
  }
  return r;
}

export async function runSide(browser: PwBrowser, r: SideRun): Promise<SideCapture> {
  const height = HEIGHT[r.width] ?? Math.round((r.width * 9) / 16);
  const vdir = mkdtempSync(path.join(os.tmpdir(), 'design-diff-video-'));
  const ctx = await browser.newContext({ viewport: { width: r.width, height }, deviceScaleFactor: 1, recordVideo: { dir: vdir, size: { width: r.width, height } } });
  await ctx.addInitScript({ content: HOOKS });
  const page = await ctx.newPage();
  const empty: MotionSnap = { animations: [], events: [], timers: [] };
  const res: SideCapture = { ok: true, elements: [], motion: empty };
  try {
    await page.goto(r.url, { waitUntil: 'load', timeout: 60000 });
    if (r.readySelector) {
      try {
        await page.waitForSelector(r.readySelector, { state: 'visible', timeout: APP_READY_TIMEOUT_MS });
      } catch {
        throw new Error(`--app-ready 요소가 ${APP_READY_TIMEOUT_MS / 1000}초 안에 안 보임 (${r.readySelector})`);
      }
    }
    await page.evaluate('document.fonts.ready.then(function(){return true})');
    await page.waitForTimeout(500);
    await page.evaluate('window.__dd && window.__dd.start()');
    for (const [i, s] of r.steps.entries()) {
      const t = await retryFind(
        () => page.evaluate<{ ok: boolean; count: number; x?: number; y?: number; disabled?: boolean }>(`${FIND_TARGET}(${JSON.stringify(s)})`),
        (ms) => page.waitForTimeout(ms),
      );
      if (!t.ok || t.x === undefined || t.y === undefined) {
        res.ok = false;
        res.error = `${i + 1}번째 단계를 못 찾음 (${JSON.stringify(s)}, 후보 ${t.count}개)`;
        break;
      }
      await page.mouse.click(t.x, t.y);
      const last = i === r.steps.length - 1;
      await page.waitForTimeout(s.waitMs ?? (last ? r.settleMs + 300 : 400));
    }
    await page.waitForTimeout(300);
    await page.evaluate('document.fonts.ready.then(function(){return true})');
    res.motion = await page.evaluate<MotionSnap>('window.__dd ? window.__dd.collect() : {animations:[],events:[],timers:[]}');
    res.elements = await page.evaluate<ElementSnap[]>(`${CAPTURE}(${JSON.stringify(r.selectors)})`);
    const png = `${r.side}-${r.width}.png`;
    writeFileSync(path.join(r.outDir, png), await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' }));
    res.png = png;
  } catch (e) {
    res.ok = false;
    res.error = (e as Error).message.split('\n')[0];
  }
  const video = page.video();
  await page.close();
  await ctx.close();
  if (video) {
    try {
      const webm = `${r.side}-${r.width}.webm`;
      mkdirSync(r.outDir, { recursive: true });
      copyFileSync(await video.path(), path.join(r.outDir, webm));
      res.video = webm;
    } catch {
      // 녹화 실패는 비교를 막지 않는다
    }
  }
  return res;
}
