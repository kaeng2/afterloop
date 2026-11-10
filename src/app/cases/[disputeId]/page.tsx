/**
 * S5 Case `/cases/[disputeId]` 1부 보기 (T009 1부, SPEC v2.7 2장 "S5 서연 장면").
 *
 * - 주소의 번호가 연결 표에서 화면에 내는 분쟁(`showOnScreen`)이 아니면 PayPal을 읽지 않고 404다
 *   (연습용·시연 제외 분쟁. SPEC 9-4·9-5).
 * - 서버 컴포넌트다. PayPal·LLM은 `./view/load.ts`(서버 전용)에서만 부른다. 이 화면은 POST를 보내지 않는다.
 * - 보기용 값은 `buildCaseView`가 엔진 결과를 옮겨 만든다 (화면은 계산하지 않는다).
 * - 2부(답장 칸)는 `layout.tsx`가 이 화면 옆에 그린다. 이 파일은 답장을 다루지 않는다.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { reasonCopyKey } from '../../_shared/availability';
import { t } from '../../_shared/copy';
import { buildCaseView } from '../model';
import { CaseView } from '../view/case-view';
import { loadCase } from '../view/load';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ disputeId: string }> };

function decode(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { disputeId } = await params;
  return { title: t('case.view.metaTitle', { disputeId: decode(disputeId) }), robots: { index: false, follow: false } };
}

export default async function CasePage({ params }: Props) {
  const { disputeId } = await params;
  const loaded = await loadCase(decode(disputeId));

  if (loaded.kind === 'not_found') notFound();

  if (loaded.kind === 'paypal_unavailable') {
    return (
      <div className="stack">
        <h1 className="page-title">{t('nav.case')}</h1>
        <div className="notice stack">
          <span>{t('common.paypalUnavailable')}</span>
          {loaded.paypal.reason === undefined ? null : <span>{t(reasonCopyKey(loaded.paypal.reason))}</span>}
        </div>
      </div>
    );
  }

  return <CaseView view={buildCaseView(loaded.input)} llmOk={loaded.llm.ok} />;
}
