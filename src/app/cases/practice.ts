/**
 * 녹화 연습용 (T061 "전송 상태 표시"·"연습용 실패 화면"). **서버에서만 부른다** (서버 액션·답장 칸 서버 읽기).
 *
 * 보내기 관문(`src/app/_server/send.ts`)은 고치지 않는다 — 이 파일은 관문 **밖**에서 두 가지만 한다:
 *
 *  1. 전송 모드 글자에 쓰는 값: 연결 표에서 이 분쟁의 실제 전송이 허용되는가 (`liveSendAllowedFor`).
 *  2. 연습용 실패 화면: 서버 환경 변수 `AFTERLOOP_SIMULATE_FAILURE`(네 값 중 하나)가 있으면, **가짜 전송이
 *     관문을 모두 통과해 성공했을 때만** 그 결과를 해당 실패 화면으로 바꾼다 (`applySimulatedFailure`).
 *     실제 전송(`AFTERLOOP_REAL_SEND=1`)이면 이 변수를 **읽지도 않는다**. 네 값 밖·빈 값은 무시한다.
 *     문구는 지금의 실패 문구 키 그대로다 (paypal_error는 실행 층이 PayPal 비2xx에 쓰는 문장 그대로).
 *
 * 가짜 연습을 몇 번이고 할 수 있는 것은 관문의 지금 동작이다: `executeMove`의 중복 방지 기억은 호출기 함수별이라
 * 가짜 호출기의 기억은 실제 호출기의 기억과 따로이고, 같은 답장을 다시 보내면 기억된 가짜 성공이 돌아온다
 * (`tests/unit/app-t061.test.ts`가 확인한다). 실제 전송의 "같은 계획은 한 번"은 그대로다.
 */
import 'server-only';

import { EXEC_COPY, format } from '@/exec/copy';
import { ENDPOINTS } from '@/exec/request';
import type { DemoLink } from '@/types';

import { t } from '../_shared/copy';
import { demoLinks, linkFor } from '../_shared/demo-links';
import { resolveSendMode, type SendEnv } from '../_server/send';
import type { SendKind, SendOutcome } from './reply-model';

/** 연습용 실패 화면 네 가지. */
export const SIMULATED_FAILURES = ['paypal_error', 'already_replied', 'not_allowed', 'checks_failed'] as const;
export type SimulatedFailure = (typeof SIMULATED_FAILURES)[number];

type PracticeEnv = SendEnv & Partial<Record<'AFTERLOOP_SIMULATE_FAILURE', string>>;

/**
 * `AFTERLOOP_SIMULATE_FAILURE` 읽기. 실제 전송이면 변수를 보지 않고 `null`. 네 값 밖·빈 값은 `null`.
 */
export function resolveSimulatedFailure(env: PracticeEnv = process.env as PracticeEnv): SimulatedFailure | null {
  if (resolveSendMode(env) === 'live') return null;
  const value = env.AFTERLOOP_SIMULATE_FAILURE;
  return value !== undefined && (SIMULATED_FAILURES as readonly string[]).includes(value) ? (value as SimulatedFailure) : null;
}

/** 연결 표에서 이 분쟁의 실제 전송이 허용되는가 (화면에 내는 분쟁 + `liveSendAllowed`). 표 밖이면 거짓. */
export function liveSendAllowedFor(disputeId: string, links: DemoLink[] = demoLinks): boolean {
  const link = linkFor(disputeId, links);
  return link !== undefined && link.showOnScreen && link.liveSendAllowed;
}

/** 실패 화면 하나 (가짜 전송 결과). 문구는 관문이 같은 실패에 쓰는 키·문장 그대로. */
export function simulatedFailureOutcome(failure: SimulatedFailure, kind: SendKind): SendOutcome {
  const base = { ok: false as const, mode: 'simulated' as const };
  switch (failure) {
    case 'paypal_error': {
      const endpoint = ENDPOINTS[kind === 'offer' ? 'make_offer' : 'send_message'] ?? kind;
      return {
        ...base,
        failure: 'paypal_error',
        error: format(EXEC_COPY.callFailed, { endpoint, status: 500 }),
        nextAction: format(EXEC_COPY.nextCheckPayPal, { endpoint }),
      };
    }
    case 'already_replied':
      return { ...base, failure: 'already_replied', error: t('case.send.error.alreadyReplied'), nextAction: t('case.send.next.checkPayPal') };
    case 'not_allowed':
      return { ...base, failure: 'blocked', error: t('case.send.error.liveNotAllowed'), nextAction: t('case.send.next.liveNotAllowed') };
    case 'checks_failed':
      return { ...base, failure: 'blocked', error: t('case.send.error.checkFailed'), nextAction: t('case.send.next.regenerate') };
  }
}

/**
 * 관문의 결과에 연습용 실패를 덧씌운다. **가짜 전송 성공일 때만** 바꾼다 — 실제 전송 결과·관문의 진짜 실패는
 * 그대로 둔다 (진짜 실패가 있으면 그것이 먼저 보인다).
 */
export function applySimulatedFailure(outcome: SendOutcome, failure: SimulatedFailure | null, kind: SendKind): SendOutcome {
  if (failure === null || !outcome.ok || outcome.mode !== 'simulated') return outcome;
  return simulatedFailureOutcome(failure, kind);
}
