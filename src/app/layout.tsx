/**
 * 화면 공용 뼈대 (T047). 머리글(가로 한 줄: 이름 + 메뉴) + 본문 자리만 둔다.
 *
 * 화면 5개의 내용은 각 지시서가 만든다 (T014 S1, T013 S2, T016 S3, T012 S4, T009 S5).
 * 글자는 `config/copy.en.json`(`nav.*`)에서 읽는다 — 코드에 직접 쓰지 않는다.
 * 글꼴은 시스템 글꼴 묶음이다 (`globals.css`의 `--font-sans`). 외부 글꼴을 내려받지 않는다.
 */
import type { Metadata, Viewport } from 'next';

import { t } from './_shared/copy';
import { Nav } from './_shared/nav';
import './globals.css';

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
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          {t('nav.skipToContent')}
        </a>
        <header className="header">
          <div className="header-inner">
            <div className="brand">
              <span className="brand-name">{t('nav.appName')}</span>
              <span className="brand-note">{t('nav.sandboxNote')}</span>
            </div>
            <Nav />
          </div>
        </header>
        <main className="main" id="main">
          {children}
        </main>
      </body>
    </html>
  );
}
