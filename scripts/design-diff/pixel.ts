// 픽셀 비교: pixelmatch + pngjs (devDependency). 크기가 다르면 큰 쪽에 맞춰 자홍색으로 채운다(채운 곳도 차이로 센다).
import { readFileSync, writeFileSync } from 'node:fs';
import type { PixelResult } from './types';

interface PngLike {
  width: number;
  height: number;
  data: Uint8Array;
}
interface PngCtor {
  new (o: { width: number; height: number }): PngLike;
  sync: { read(b: Buffer): PngLike; write(p: PngLike): Buffer };
}
type PixelmatchFn = (a: Uint8Array, b: Uint8Array, out: Uint8Array, w: number, h: number, o?: Record<string, unknown>) => number;

async function load(): Promise<{ PNG: PngCtor; pixelmatch: PixelmatchFn }> {
  // 변수 이름으로 불러 설치 전에도 tsc가 통과하게 한다
  const pngName = 'pngjs';
  const pmName = 'pixelmatch';
  try {
    const png = (await import(pngName)) as { PNG?: PngCtor; default?: { PNG: PngCtor } };
    const pm = (await import(pmName)) as { default?: PixelmatchFn } & PixelmatchFn;
    const PNG = png.PNG ?? png.default?.PNG;
    const pixelmatch = (pm.default ?? pm) as PixelmatchFn;
    if (!PNG || typeof pixelmatch !== 'function') throw new Error('모듈 모양이 다르다');
    return { PNG, pixelmatch };
  } catch (e) {
    throw new Error(`pixelmatch·pngjs를 불러오지 못했다. \`npm i -D pixelmatch pngjs\` 뒤 다시 실행하세요. (${(e as Error).message})`);
  }
}

/** RGBA 버퍼를 (w,h)로 넓힌다. 새로 생긴 칸은 자홍색 */
export function padRgba(src: Uint8Array, sw: number, sh: number, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h * 4);
  for (let i = 0; i < out.length; i += 4) {
    out[i] = 255;
    out[i + 1] = 0;
    out[i + 2] = 255;
    out[i + 3] = 255;
  }
  for (let y = 0; y < sh; y++) out.set(src.subarray(y * sw * 4, (y + 1) * sw * 4), y * w * 4);
  return out;
}

export async function comparePng(mockPath: string, appPath: string, diffPath: string, width: number): Promise<PixelResult> {
  const { PNG, pixelmatch } = await load();
  const a = PNG.sync.read(readFileSync(mockPath));
  const b = PNG.sync.read(readFileSync(appPath));
  const w = Math.max(a.width, b.width);
  const h = Math.max(a.height, b.height);
  const da = padRgba(a.data, a.width, a.height, w, h);
  const db = padRgba(b.data, b.width, b.height, w, h);
  const out = new PNG({ width: w, height: h });
  const n = pixelmatch(da, db, out.data, w, h, { threshold: 0.1, diffColor: [255, 0, 0], alpha: 0.25 });
  writeFileSync(diffPath, PNG.sync.write(out));
  return { width, ratio: n / (w * h), diffPixels: n, total: w * h };
}
