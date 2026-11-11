/**
 * 옛 주소 `/cases/[disputeId]` → Today 탭 `/?item=<disputeId>` (T060, SPEC v2.10 2장 "두 탭 + 서랍").
 *
 * 분쟁 상세는 Today 탭 오른쪽 칸에 있다 (`../case-detail.tsx`). 이 파일은 PayPal을 읽지 않고 보내기만 한다.
 * 화면에 내지 않는 분쟁 번호여도 그대로 보낸다 — Today는 목록에 없는 번호면 목록 첫 항목을 보인다.
 */
import { redirect } from 'next/navigation';

import { applyLangParam } from '@/app/_server/locale';

type Props = {
  params: Promise<{ disputeId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function decode(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export default async function CaseRedirect({ params, searchParams }: Props) {
  const { disputeId } = await params;
  await applyLangParam(`/cases/${encodeURIComponent(decode(disputeId))}`, await searchParams);
  redirect(`/?item=${encodeURIComponent(decode(disputeId))}`);
}
