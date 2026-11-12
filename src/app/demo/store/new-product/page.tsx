/**
 * /demo/store/new-product (옛 /listing, T115) — 새 상품 등록 전 점검 (T087, Scene 3, SPEC v2.12 2장). `/intro`처럼 라우트 그룹 `(app)` 밖이라
 * 위쪽 앱 막대와 Today 읽기(PayPal 조회)가 돌지 않는다. 언어는 T081 공용 값 (쿠키·`?lang=`).
 */
import type { Metadata } from 'next';

import { applyLangParam } from '../../../_server/locale';
import { NEW_PRODUCT_PATH } from '../../../_shared/routes';
import { ListingScreen } from './listing-screen';

export const metadata: Metadata = { title: 'New listing check (demo store)' };

type Props = { searchParams: Promise<{ lang?: string | string[] }> };

export default async function ListingPage({ searchParams }: Props) {
  await applyLangParam(NEW_PRODUCT_PATH, await searchParams);
  return <ListingScreen />;
}
