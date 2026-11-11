'use server';

/**
 * S5 답장 전송 서버 액션 (T009 2부). 답장 칸의 [Send in …]·[Send offer · …] 버튼이 부른다.
 *
 * 브라우저가 보낸 값은 믿지 않는다: 받는 것은 분쟁 번호·준비해 둔 답장 번호·확인한 약속 범주뿐이고,
 * 모양을 zod로 본 뒤 `_server/send.ts`의 `sendFromScreen`에 넘긴다. 글·계획·승인은 서버가 다시 만든다.
 * 모양이 틀리면 호출 없이 거부한다. 기본은 가짜 전송이다 (`resolveSendMode`).
 *
 * 결과는 같은 화면, 같은 자리에 뜬다 (주소를 바꾸지 않는다. `redirect`·`revalidatePath`를 부르지 않는다).
 */
import { z } from 'zod';

import { COMMITMENT_CATEGORIES } from '@/ai/commitments';
import { DRAFT_INPUT_MAX_CHARS } from '@/ai/reply';

import { t } from '../_shared/copy';
import { initLocale } from '../_server/locale';
import { prepareEditedFromScreen, sendFromScreen, resolveSendMode } from '../_server/send';
import { applySimulatedFailure, resolveSimulatedFailure } from './practice';
import { EDIT_KEYS, type EditedPrepareOutcome, type SendOutcome } from './reply-model';

const SendFormSchema = z.object({
  disputeId: z.string().regex(/^PP-[A-Z0-9-]{1,40}$/),
  /** 보내는 수. 없으면 메시지. 금액·계획은 받지 않는다 (서버가 엔진으로 다시 만든다). */
  kind: z.enum(['message', 'offer']).default('message'),
  replyId: z.string().regex(/^r-[0-9a-f]{32}$/),
  confirmedCommitments: z
    .array(z.enum(COMMITMENT_CATEGORIES as unknown as [string, ...string[]]))
    .max(COMMITMENT_CATEGORIES.length),
});

const EditedFormSchema = z.object({
  disputeId: z.string().regex(/^PP-[A-Z0-9-]{1,40}$/),
  replyId: z.string().regex(/^r-[0-9a-f]{32}$/),
  text: z.string().min(1).max(DRAFT_INPUT_MAX_CHARS),
});

/**
 * 고친 글 번역·검사 (T100). **보내지 않는다** — 서버가 글을 토큰으로 되돌려 `translateReply`를 지나고, 검사를 통과한
 * 글만 기억해 번호를 준다. 보내기는 그 번호로 `sendReplyAction`(기존 관문)을 지난다.
 */
export async function prepareEditedAction(form: unknown): Promise<EditedPrepareOutcome> {
  await initLocale();
  const parsed = EditedFormSchema.safeParse(form);
  if (!parsed.success) return { ok: false, reasonKey: EDIT_KEYS.invalid };
  try {
    return await prepareEditedFromScreen(parsed.data);
  } catch {
    return { ok: false, reasonKey: EDIT_KEYS.aiUnavailable };
  }
}

export async function sendReplyAction(form: unknown): Promise<SendOutcome> {
  await initLocale();
  const parsed = SendFormSchema.safeParse(form);
  if (!parsed.success) {
    return {
      ok: false,
      mode: resolveSendMode(),
      failure: 'blocked',
      error: t('case.send.error.badRequest'),
      nextAction: t('case.send.next.reload'),
    };
  }
  try {
    const outcome = await sendFromScreen({
      disputeId: parsed.data.disputeId,
      kind: parsed.data.kind,
      replyId: parsed.data.replyId,
      confirmedCommitments: parsed.data.confirmedCommitments as (typeof COMMITMENT_CATEGORIES)[number][],
    });
    // 녹화 연습용 실패 화면 (T061). 가짜 전송 성공일 때만 바뀐다. 실제 전송이면 변수를 읽지도 않는다
    const practice = resolveSendMode() === 'simulated' ? resolveSimulatedFailure() : null;
    return applySimulatedFailure(outcome, practice, parsed.data.kind);
  } catch {
    // 예외 문장은 싣지 않는다 (PayPal 응답 문장이 섞일 수 있다)
    return {
      ok: false,
      mode: resolveSendMode(),
      failure: 'network',
      error: t('case.send.error.unexpected'),
      nextAction: t('case.send.next.tryLater'),
    };
  }
}
