/**
 * /demo/seller-dashboard (옛 /intro, T115) — 첫 장면 껍데기 화면 (T078). 엔진·AI를 부르지 않고, **PayPal을 기다려 읽지 않는다.**
 * 화면 문구는 `config/intro.*.json`. 분쟁 해결 센터 사건 줄·건수·대목까지 남은 날은 Desk와 같은 출처 (`_server/intro-data`:
 * 연결 표 → 시드, 기한은 읽기 캐시에 담긴 값만). 언어는 다른 화면과 같은 쿠키·`?lang=` 값 (T081).
 * 응답을 보낸 뒤 Today가 읽을 분쟁을 뒤에서 읽어 캐시를 데운다 (`warmTodayReads`, T115 — 서연 화면이 바로 뜨게).
 */
import type { Metadata } from 'next';

import { loadIntroData, warmTodayReads } from '../../_server/intro-data';
import { applyLangParam } from '../../_server/locale';
import { SELLER_DASHBOARD_PATH } from '../../_shared/routes';
import { IntroScreen } from './intro-screen';

export const metadata: Metadata = { title: 'Seller dashboard (demo mock)' };

type Props = { searchParams: Promise<{ lang?: string | string[] }> };

export default async function IntroPage({ searchParams }: Props) {
  await applyLangParam(SELLER_DASHBOARD_PATH, await searchParams);
  const data = loadIntroData();
  warmTodayReads();
  return <IntroScreen data={data} />;
}
