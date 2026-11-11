'use client';

/**
 * Products 탭 세 칸 (T062). 처방 토글 상태를 들고, 토글할 때마다 `model.ts`(엔진을 그대로 부른다)를
 * **브라우저에서** 다시 불러 큰 숫자·범위 문장·점 그림·왼쪽 목록의 with fixes 값을 함께 바꾼다
 * (엔진은 비밀값을 읽지 않는다. 서버 왕복이 없어 0.5초 안에 다시 그린다 — 보고서에 잰 시간).
 *
 * 이 파일은 계산하지 않는다. PayPal·LLM을 부르지 않는다 (색상 문구는 부모가 넘긴 서버 액션만).
 */
import { startTransition, useMemo, useState } from 'react';

import type { FixId, SeedProduct } from '@/types';

import { ColorNoteSlot } from './color-note-card';
import {
  ALL_FIXES,
  buildProductRows,
  buildProductView,
  toggleFix,
  type ColorNoteView,
  type TransactionLineView,
} from './model';
import { FixCards, ProductList, Rehearsal } from './views';

export function ProductsScreen({
  products,
  selectedSku,
  txLine,
  colorNoteSkus,
  writeColorNote,
}: {
  products: SeedProduct[];
  selectedSku: string;
  txLine: TransactionLineView | null;
  /** 색상 문구를 쓸 구매자 글이 있는 상품 (서버가 시드로 정한다). 없으면 그 자리를 숨긴다 */
  colorNoteSkus: string[];
  writeColorNote: (sku: string) => Promise<ColorNoteView | null>;
}) {
  const [fixesOn, setFixesOn] = useState<FixId[]>([]);

  const product = products.find((p) => p.sku === selectedSku) ?? products[0];
  const rows = useMemo(() => buildProductRows(products, fixesOn, product.sku), [products, fixesOn, product.sku]);
  const view = useMemo(() => buildProductView(product, fixesOn), [product, fixesOn]);

  const colorNoteSlot = colorNoteSkus.includes(product.sku) ? (
    <ColorNoteSlot key={product.sku} sku={product.sku} write={writeColorNote} />
  ) : null;

  return (
    <div className="products">
      <ProductList rows={rows} />
      <Rehearsal view={view} txLine={txLine} />
      <FixCards
        view={view}
        // 다시 계산은 급하지 않은 갱신으로 (T084): 누른 반응이 먼저, 숫자는 같은 엔진 결과
        onToggle={(id) => startTransition(() => setFixesOn((current) => toggleFix(current, id)))}
        onAllOn={() => startTransition(() => setFixesOn([...ALL_FIXES]))}
        colorNoteSlot={colorNoteSlot}
      />
    </div>
  );
}
