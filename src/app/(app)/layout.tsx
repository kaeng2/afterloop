/**
 * 앱 화면 뼈대 (T047 → T060 → T079 → T081 → T096). 위쪽 막대(로고 · 날짜 · 공개 데모 표시 · PayPal activity · EN/KO · 판매자 칩)
 * + 본문 자리. T096: 탭이 없어 막대는 Today 데이터를 읽지 않는다 (날짜는 `dateLine(new Date())`). T114: `/products` 화면은 지웠다 (`/`로 308).
 *
 * 라우트 그룹 `(app)` (T079): Today·옛 사례 주소·견본 화면만 이 뼈대를 쓴다. `/intro`·`/listing`은 그룹 밖이다.
 * - T081: 화면 언어(EN/KO)는 요청마다 `initLocale()`로 정한다.
 * - 판매자 칩 글자는 `config/rules.json`의 `reply.names.sellerSignature`에서 온다 (코드에 이름을 쓰지 않는다).
 * - 글자는 `config/copy.en.json`에서 읽는다.
 * - 이 파일은 POST를 보내지 않는다 (분쟁·주문 조회만).
 */
import { loadReplyNames } from '@/ai/names';

import { initLocale } from '@/app/_server/locale';
import { resolveDemoMode } from '@/app/_server/mode';
import { t } from '@/app/_shared/copy';
import { sellerChip } from '@/app/_shared/nav-items';
import { TopBar } from '@/app/_shared/top-bar';
import { dateLine } from '@/app/today/model';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await initLocale();
  const seller = sellerChip(loadReplyNames().sellerSignature);
  // 모드 이름만 화면에 (T070). public이면 "Public demo · simulated sends" 한 줄
  const mode = resolveDemoMode();
  const modeNote = mode === 'public' ? t('mode.public') : undefined;

  return (
    <>
      <a className="skip-link" href="#main">
        {t('nav.skipToContent')}
      </a>
      <TopBar seller={seller} modeNote={modeNote} dateLine={dateLine(new Date())} />
      <main className="main" id="main">
        {children}
      </main>
    </>
  );
}
