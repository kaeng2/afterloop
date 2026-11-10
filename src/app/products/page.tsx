/**
 * Products 탭 `/products` (T060 최소판). 같은 틀 안에 가게 상품 목록만 보인다 — 상품별 진단은 T062가 채운다.
 *
 * - 목록은 시드 상품 (이름 · SKU · 남은 재고). 숫자를 만들지 않는다 (재고는 시드 값 그대로).
 * - `?sku=`가 있으면 그 상품을 고른 것으로 표시한다 (Today의 Prevent 항목이 여기로 온다).
 * - 이 화면은 PayPal·LLM을 부르지 않는다.
 */
import { seedProducts } from '../../../seed/index';
import { DemoBadge } from '../_shared/badges';
import { t } from '../_shared/copy';

import './products.css';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ sku?: string | string[] }> };

export default async function ProductsPage({ searchParams }: Props) {
  const { sku } = await searchParams;
  const selected = Array.isArray(sku) ? sku[0] : sku;

  return (
    <div className="stack products">
      <div className="row">
        <h1 className="products-title">{t('shell.products.title')}</h1>
        <DemoBadge />
      </div>
      <ul className="products-list" aria-label={t('shell.products.listLabel')}>
        {seedProducts.map((product) => (
          <li
            key={product.sku}
            className="products-item"
            aria-current={product.sku === selected ? 'true' : undefined}
          >
            <span className="products-name">{product.itemName}</span>
            <span className="small muted num">{product.sku}</span>
            <span className="small num">{t('shell.products.stockLeft', { stock: product.stock })}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
