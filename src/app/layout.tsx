/**
 * 화면 공용 뼈대 (T047 → T060). 위쪽 막대(로고 · Today (N) / Products 탭 · Autopilot · PayPal activity · 판매자 칩)
 * + 본문 자리. 화면 구조는 두 탭 + 서랍이다 (사람 결정 2026-11-10, SPEC v2.10 2장).
 *
 * - Today (N)의 N은 Today 목록 항목 수다 (`loadTodayForRequest` — Today 화면과 같은 요청 안에서 한 번만 읽는다).
 * - 판매자 칩 글자는 `config/rules.json`의 `reply.names.sellerSignature`에서 온다 (코드에 이름을 쓰지 않는다).
 * - 글자는 `config/copy.en.json`에서 읽는다.
 * - 글꼴 (T067, 사람 결정으로 T047 "외부 글꼴 금지"를 바꿨다): Figtree + Noto Sans KR을 `next/font/google`로
 *   **빌드 때** 받아 자체 제공한다 (브라우저가 Google에 요청하지 않는다. css에서 외부 글꼴을 불러오지 않는다).
 *   이름 변수 `--font-figtree`·`--font-noto-kr`을 `<html>`에 붙이고, `globals.css`의 `--font-sans`가 쓴다.
 * - 이 파일은 POST를 보내지 않는다 (분쟁·주문 조회만).
 */
import type { Metadata, Viewport } from 'next';
import { Figtree, Noto_Sans_KR } from 'next/font/google';

import { loadReplyNames } from '@/ai/names';

import { loadTodayForRequest } from './_server/today';
import { t } from './_shared/copy';
import { sellerChip } from './_shared/nav-items';
import { TopBar } from './_shared/top-bar';
import './globals.css';

export const dynamic = 'force-dynamic';

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

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const today = await loadTodayForRequest();
  const seller = sellerChip(loadReplyNames().sellerSignature);

  return (
    <html lang="en" className={`${figtree.variable} ${notoSansKr.variable}`}>
      <body>
        <a className="skip-link" href="#main">
          {t('nav.skipToContent')}
        </a>
        <TopBar todayCount={today.view.count} seller={seller} />
        <main className="main" id="main">
          {children}
        </main>
      </body>
    </html>
  );
}
