/**
 * 루트 뼈대 (T047 → T079). `<html>`·`<body>`·글꼴·제목만. **데이터를 읽지 않는다** (PayPal·AI 호출 없음).
 *
 * - 위쪽 막대와 Today 데이터 읽기는 라우트 그룹 `(app)/layout.tsx`에 있다 (T079). `/intro`는 그룹 밖이라 그 둘이
 *   돌지 않는다 — 첫 장면 껍데기 화면은 서버 호출 0회.
 * - 글꼴 (T067, 사람 결정으로 T047 "외부 글꼴 금지"를 바꿨다): Figtree + Noto Sans KR을 `next/font/google`로
 *   **빌드 때** 받아 자체 제공한다 (브라우저가 Google에 요청하지 않는다. css에서 외부 글꼴을 불러오지 않는다).
 *   이름 변수 `--font-figtree`·`--font-noto-kr`을 `<html>`에 붙이고, `globals.css`의 `--font-sans`가 쓴다.
 * - 글자는 `config/copy.en.json`에서 읽는다.
 */
import type { Metadata, Viewport } from 'next';
import { Figtree, Noto_Sans_KR } from 'next/font/google';

import { t } from './_shared/copy';
import './globals.css';

const figtree = Figtree({ subsets: ['latin'], display: 'swap', variable: '--font-figtree' });
// 한국어 글자는 Google이 나눈 unicode-range 조각으로 함께 제공된다. 미리 받기는 라틴만 (preload: false)
const notoSansKr = Noto_Sans_KR({ subsets: ['latin'], display: 'swap', variable: '--font-noto-kr', preload: false });

export const metadata: Metadata = {
  title: t('nav.appName'),
  description: t('nav.sandboxNote'),
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${figtree.variable} ${notoSansKr.variable}`}>
      <body>{children}</body>
    </html>
  );
}
