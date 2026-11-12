// 실행: npx tsx scripts/design-diff/run.ts --mock <dir> --app <url> --out <dir> [--states s1,s2] [--widths 1440,1920]
// 사용법은 scripts/design-diff/README.md
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { analyze } from './analyze';
import { parseArgs } from './args';
import { launch, runSide } from './browser';
import { applyExceptions, compareMotion, compareStyles, judge, parseExceptions, pixelDiff, selectorsOf } from './compare';
import { comparePng } from './pixel';
import { indexHtml, motionMd, statesMd, stylesMd } from './report';
import { prepareMock, serveDir } from './server';
import type { DiffItem, ExceptionRule, MotionSnap, PixelResult, StateResult, StatesFile } from './types';

export function stateDir(out: string, name: string): string {
  return path.join(out, name.replace(/[^\p{L}\p{N}_~.-]+/gu, '-'));
}

export function joinUrl(base: string, p?: string): string {
  if (!p) return base;
  return new URL(p, base.endsWith('/') ? base : base + '/').toString();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const mockDir = path.resolve(args.mock!);
  const entry = args.entry ?? readdirSync(mockDir).find((f) => f.endsWith('.dc.html')) ?? 'index.html';
  const out = path.resolve(args.out);
  mkdirSync(out, { recursive: true });

  // 1. 상태 목록
  const html = readFileSync(path.join(mockDir, entry), 'utf8');
  const an = analyze(html, path.join(args.mock!, entry), { maxDepth: args.maxDepth, maxStates: args.maxStates });
  writeFileSync(path.join(out, 'states.md'), statesMd(an));
  writeFileSync(path.join(out, 'states.generated.json'), JSON.stringify(an.file, null, 2));
  const statesPath = args.statesFile ? path.resolve(args.statesFile) : path.join(out, 'states.json');
  if (!args.statesFile && (args.regen || !existsSync(statesPath))) writeFileSync(statesPath, JSON.stringify(an.file, null, 2));
  const sf = JSON.parse(readFileSync(statesPath, 'utf8')) as StatesFile;
  console.log(`상태 ${an.file.states.length}개 → ${path.relative(process.cwd(), path.join(out, 'states.md'))} (사용: ${path.relative(process.cwd(), statesPath)})`);
  if (args.analyzeOnly) return;

  // 2. 예외
  const exPath = args.exceptions ? path.resolve(args.exceptions) : path.join(out, 'exceptions.json');
  const rules: ExceptionRule[] = existsSync(exPath) ? parseExceptions(JSON.parse(readFileSync(exPath, 'utf8'))) : [];
  const selectors = selectorsOf(rules);
  console.log(`예외 ${rules.length}줄${existsSync(exPath) ? '' : ' (파일 없음: ' + exPath + ')'}`);

  let states = sf.states;
  if (args.states) {
    const want = new Set(args.states);
    states = states.filter((s) => want.has(s.name));
    const missing = args.states.filter((n) => !states.some((s) => s.name === n));
    if (missing.length) throw new Error(`states.json에 없는 상태: ${missing.join(', ')}`);
  }

  // 3. 시안 사본 + 서버, 브라우저
  const copy = prepareMock(mockDir, args.vendor);
  const server = await serveDir(copy);
  const mockUrl = server.url + encodeURIComponent(entry);
  const browser = await launch({ chrome: args.chrome, channel: args.channel, headed: args.headed });
  const results: StateResult[] = [];
  try {
    for (const s of states) {
      const dir = stateDir(out, s.name);
      mkdirSync(dir, { recursive: true });
      let diffs: DiffItem[] = [];
      const pixels: PixelResult[] = [];
      const motions: { width: number; mock: MotionSnap; app: MotionSnap }[] = [];
      for (const width of args.widths) {
        const common = { width, settleMs: s.settleMs, selectors, outDir: dir };
        const m = await runSide(browser, { ...common, url: mockUrl, steps: s.mock, side: 'mock' });
        const a = await runSide(browser, { ...common, url: joinUrl(args.app!, s.appPath), steps: s.app, side: 'app' });
        for (const [side, c] of [['mock', m] as const, ['app', a] as const]) {
          if (!c.ok) diffs.push({ state: s.name, width, kind: 'repro', key: `repro|${side}`, prop: side, mock: side === 'mock' ? c.error : '', app: side === 'app' ? c.error : '', selectors: [], exceptions: [] });
        }
        diffs.push(...compareStyles(s.name, width, m.elements, a.elements));
        diffs.push(...compareMotion(s.name, width, m.motion, a.motion));
        motions.push({ width, mock: m.motion, app: a.motion });
        if (m.png && a.png) {
          const p = await comparePng(path.join(dir, m.png), path.join(dir, a.png), path.join(dir, `diff-${width}.png`), width);
          pixels.push(p);
          const pd = pixelDiff(s.name, p);
          if (pd) diffs.push(pd);
        }
      }
      diffs = applyExceptions(diffs, rules);
      const r = judge(s.name, args.widths, diffs, pixels);
      results.push(r);
      writeFileSync(path.join(dir, 'styles.md'), stylesMd(r, rules));
      writeFileSync(path.join(dir, 'motion.md'), motionMd(s.name, motions, diffs, rules));
      console.log(`${r.pass ? '통과' : '실패'} ${s.name}: 차이 ${diffs.length}, 설명 없음 ${r.unexplained}, 픽셀 ${pixels.map((p) => (p.ratio * 100).toFixed(2) + '%').join(' / ')}`);
    }
  } finally {
    await browser.close();
    await server.close();
  }

  // 4. 요약
  const meta = { mock: path.join(args.mock!, entry), app: args.app!, generatedAt: new Date().toISOString(), widths: args.widths, states: sf.states };
  writeFileSync(path.join(out, 'index.html'), indexHtml(results, meta));
  const summary = {
    ...meta,
    states: undefined,
    pass: results.every((r) => r.pass),
    unexplained: results.reduce((n, r) => n + r.unexplained, 0),
    results: results.map((r) => ({ state: r.state, pass: r.pass, diffs: r.diffs.length, unexplained: r.unexplained, pixels: r.pixels })),
  };
  writeFileSync(path.join(out, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(`${summary.pass ? '통과' : '실패'} · 설명 없는 차이 ${summary.unexplained} → ${path.relative(process.cwd(), path.join(out, 'index.html'))}`);
  process.exitCode = summary.pass ? 0 : 1;
}

const invoked = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invoked.endsWith(path.join('design-diff', 'run.ts'))) {
  main().catch((e) => {
    console.error((e as Error).message);
    process.exitCode = 2;
  });
}
