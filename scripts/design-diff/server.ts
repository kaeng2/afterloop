// 시안 사본(저장소 밖 임시 폴더) + vendor React UMD + 로컬 정적 서버
import { cpSync, existsSync, mkdtempSync, readdirSync, createReadStream, statSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

/** vendor 폴더에서 react.js / react-dom.js로 쓸 파일을 고른다 */
export function pickVendor(files: string[]): { react?: string; reactDom?: string } {
  const pick = (re: RegExp) => files.filter((f) => re.test(f)).sort((a, b) => a.length - b.length)[0];
  return {
    react: pick(/^react(\.(development|production(\.min)?))?\.js$/),
    reactDom: pick(/^react-dom(\.(development|production(\.min)?))?\.js$/),
  };
}

/**
 * 시안 폴더를 임시 폴더로 복사하고 vendor/react.js·react-dom.js를 갖춘다.
 * 찾는 순서: 시안 안 vendor/ → --vendor 폴더 → node_modules/react{,-dom}/umd (React 18까지만 있음)
 */
export function prepareMock(mockDir: string, vendorDir?: string, repoRoot = process.cwd()): string {
  const dst = mkdtempSync(path.join(os.tmpdir(), 'design-diff-mock-'));
  cpSync(mockDir, dst, { recursive: true });
  const vdst = path.join(dst, 'vendor');
  const have = existsSync(vdst) ? pickVendor(readdirSync(vdst)) : {};
  if (have.react === 'react.js' && have.reactDom === 'react-dom.js') return dst;
  const sources: { react?: string; reactDom?: string }[] = [];
  if (vendorDir) {
    const v = pickVendor(readdirSync(vendorDir));
    sources.push({ react: v.react && path.join(vendorDir, v.react), reactDom: v.reactDom && path.join(vendorDir, v.reactDom) });
  }
  const umd = (pkg: string, f: string) => path.join(repoRoot, 'node_modules', pkg, 'umd', f);
  sources.push({ react: umd('react', 'react.production.min.js'), reactDom: umd('react-dom', 'react-dom.production.min.js') });
  if (have.react && have.reactDom) sources.unshift({ react: path.join(vdst, have.react), reactDom: path.join(vdst, have.reactDom) });
  for (const s of sources) {
    if (s.react && s.reactDom && existsSync(s.react) && existsSync(s.reactDom)) {
      cpSync(s.react, path.join(vdst, 'react.js'));
      cpSync(s.reactDom, path.join(vdst, 'react-dom.js'));
      return dst;
    }
  }
  throw new Error(
    'react@18.3.1 UMD(react.js, react-dom.js)를 찾지 못했다. 시안 폴더의 vendor/에 넣거나 `--vendor <폴더>`로 주세요. ' +
      '(저장소의 react는 19라 umd 빌드가 없다)',
  );
}

export interface Served {
  url: string;
  close: () => Promise<void>;
}

export function serveDir(root: string): Promise<Served> {
  const base = path.resolve(root);
  const server = http.createServer((req, res) => {
    const u = decodeURIComponent((req.url ?? '/').split('?')[0]);
    const p = path.resolve(base, '.' + u);
    if (!p.startsWith(base) || !existsSync(p) || !statSync(p).isFile()) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(p).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    createReadStream(p).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({ url: `http://127.0.0.1:${port}/`, close: () => new Promise((r) => server.close(() => r())) });
    });
  });
}
