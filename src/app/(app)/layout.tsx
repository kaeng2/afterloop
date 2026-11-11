/**
 * 앱 화면 뼈대 (T047 → T060 → T079). 위쪽 막대(로고 · Today (N) / Products 탭 · Autopilot · PayPal activity · 판매자 칩)
 * + 본문 자리. 화면 구조는 두 탭 + 서랍이다 (사람 결정 2026-11-10, SPEC v2.10 2장).
 *
 * 라우트 그룹 `(app)` (T079): Today·Products·옛 사례 주소·견본 화면만 이 뼈대를 쓴다. `/intro`(첫 장면 껍데기)는
 * 그룹 밖이라 이 파일이 돌지 않는다 → 위쪽 막대도, Today 데이터 읽기(PayPal 조회)도 없다. 주소는 그대로다
 * (괄호 이름 폴더는 주소에 들어가지 않는다).
 *
 * - Today (N)의 N은 Today 목록 항목 수다 (`loadTodayForRequest` — Today 화면과 같은 요청 안에서 한 번만 읽는다).
 * - 판매자 칩 글자는 `config/rules.json`의 `reply.names.sellerSignature`에서 온다 (코드에 이름을 쓰지 않는다).
 * - 글자는 `config/copy.en.json`에서 읽는다.
 * - 이 파일은 POST를 보내지 않는다 (분쟁·주문 조회만).
 */
import { loadReplyNames } from '@/ai/names';

import { resolveDemoMode } from '@/app/_server/mode';
import { loadTodayForRequest } from '@/app/_server/today';
import { t } from '@/app/_shared/copy';
import { sellerChip } from '@/app/_shared/nav-items';
import { TopBar } from '@/app/_shared/top-bar';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const today = await loadTodayForRequest();
  const seller = sellerChip(loadReplyNames().sellerSignature);
  // 모드 이름만 화면에 (T070). public이면 "Public demo · simulated sends" 한 줄
  const mode = resolveDemoMode();

  return (
    <>
      <a className="skip-link" href="#main">
        {t('nav.skipToContent')}
      </a>
      <TopBar
        todayCount={today.view.count}
        seller={seller}
        modeNote={mode === 'public' ? t('mode.public') : undefined}
        dateLine={today.view.dateLine}
      />
      <main className="main" id="main">
        {children}
      </main>
    </>
  );
}
