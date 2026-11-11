/**
 * 앱 화면 뼈대 (T047 → T060 → T079 → T081 언어 → T084). 위쪽 막대(로고 · Today (N) / Products 탭 · Autopilot · PayPal activity · 판매자 칩)
 * + 본문 자리. 화면 구조는 두 탭 + 서랍이다 (사람 결정 2026-11-10, SPEC v2.10 2장).
 *
 * 라우트 그룹 `(app)` (T079): Today·Products·옛 사례 주소·견본 화면만 이 뼈대를 쓴다. `/intro`(첫 장면 껍데기)는
 * 그룹 밖이라 이 파일이 돌지 않는다 → 위쪽 막대도, Today 데이터 읽기(PayPal 조회)도 없다. 주소는 그대로다
 * (괄호 이름 폴더는 주소에 들어가지 않는다).
 *
 * - Today (N)의 N은 Today 목록 항목 수다 (`loadTodayForRequest` — Today 화면과 같은 요청 안에서 한 번만 읽는다).
 * - T084: N을 읽는 동안 뼈대가 기다리지 않게 위쪽 막대를 `Suspense`로 뗀다. 읽는 동안은 같은 막대에 숫자만 없이
 *   ("Today") 보이고, 읽으면 지금과 같은 "Today (N)"으로 바뀐다. 본문은 `loading.tsx`가 바로 로딩 표시를 낸다.
 * - T081: 화면 언어(EN/KO)는 요청마다 `initLocale()`로 정한다. 그래서 layout 자체는 async지만 Today를 기다리지는 않는다
 *   (기다리는 건 `TopBarWithCount` 안의 `loadTodayForRequest()`뿐).
 * - 판매자 칩 글자는 `config/rules.json`의 `reply.names.sellerSignature`에서 온다 (코드에 이름을 쓰지 않는다).
 * - 글자는 `config/copy.en.json`에서 읽는다.
 * - 이 파일은 POST를 보내지 않는다 (분쟁·주문 조회만).
 */
import { Suspense } from 'react';

import { loadReplyNames } from '@/ai/names';

import { initLocale } from '@/app/_server/locale';
import { resolveDemoMode } from '@/app/_server/mode';
import { loadTodayForRequest } from '@/app/_server/today';
import { t } from '@/app/_shared/copy';
import { sellerChip } from '@/app/_shared/nav-items';
import { TopBar } from '@/app/_shared/top-bar';
import { dateLine } from '@/app/today/model';

export const dynamic = 'force-dynamic';

type BarProps = { seller: { initial: string; shop: string }; modeNote: string | undefined };

/** Today (N)을 읽은 뒤의 막대 (지금까지와 같은 값). */
async function TopBarWithCount({ seller, modeNote }: BarProps) {
  await initLocale();
  const today = await loadTodayForRequest();
  return <TopBar todayCount={today.view.count} seller={seller} modeNote={modeNote} dateLine={today.view.dateLine} />;
}

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
      <Suspense fallback={<TopBar seller={seller} modeNote={modeNote} dateLine={dateLine(new Date())} />}>
        <TopBarWithCount seller={seller} modeNote={modeNote} />
      </Suspense>
      <main className="main" id="main">
        {children}
      </main>
    </>
  );
}
