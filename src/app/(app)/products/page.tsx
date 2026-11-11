/**
 * Products 탭 `/products` (T062, PRD v3 8장 S2). 세 칸: 왼쪽 상품 목록 · 가운데 리허설 · 오른쪽 처방 카드 4개.
 *
 * - 고른 상품은 주소에 둔다 (`/products?sku=FK-CD-OAT`). 없거나 모르는 값이면 Today의 Prevent 상품 (`selectSku`).
 * - 숫자는 모두 엔진 결과 (`model.ts`). 처방 토글은 브라우저에서 다시 계산한다 (`products-screen.tsx`).
 * - 서버가 하는 일: 거래 조회 한 줄(GET만, 실패하면 숨김)과 색상 문구 서버 액션 연결. POST를 보내지 않는다.
 */
import { seedDisputes, seedInquiries, seedProducts } from '../../../../seed/index';

import { applyLangParam } from '@/app/_server/locale';
import { writeColorNoteAction } from '@/app/products/actions';
import { colorComplaintsFor, selectSku } from '@/app/products/model';
import { ProductsScreen } from '@/app/products/products-screen';
import { loadTransactionLine } from '@/app/products/transactions-line';

import '@/app/products/products.css';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ sku?: string | string[]; lang?: string | string[] }> };

export default async function ProductsPage({ searchParams }: Props) {
  const params = await searchParams;
  await applyLangParam('/products', params);
  const { sku } = params;
  const requested = Array.isArray(sku) ? sku[0] : sku;
  const selected = selectSku(seedProducts, requested);
  if (selected === null) return null;

  const txLine = await loadTransactionLine();
  const colorNoteSkus = seedProducts
    .map((product) => product.sku)
    .filter((productSku) => colorComplaintsFor(productSku, seedDisputes, seedInquiries).length > 0);

  return (
    <ProductsScreen
      products={seedProducts}
      selectedSku={selected}
      txLine={txLine}
      colorNoteSkus={colorNoteSkus}
      writeColorNote={writeColorNoteAction}
    />
  );
}
