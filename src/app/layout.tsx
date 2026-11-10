/**
 * 화면 공용 뼈대 (T047). 머리글 + 메뉴 + 본문 자리만 둔다.
 *
 * 화면 5개의 내용은 각 지시서가 만든다 (T014 S1, T013 S2, T016 S3, T012 S4, T009 S5).
 * 글자는 `config/copy.en.json`(`nav.*`)에서 읽는다 — 코드에 직접 쓰지 않는다.
 */
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';

import { t } from './_shared/copy';
import { Nav } from './_shared/nav';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: t('nav.appName'),
  description: t('nav.sandboxNote'),
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <a className="skip-link" href="#main">
          {t('nav.skipToContent')}
        </a>
        <header className="header">
          <div className="header-row">
            <span className="brand">{t('nav.appName')}</span>
            <span className="brand-note">{t('nav.sandboxNote')}</span>
          </div>
          <Nav />
        </header>
        <main className="main" id="main">
          {children}
        </main>
      </body>
    </html>
  );
}
