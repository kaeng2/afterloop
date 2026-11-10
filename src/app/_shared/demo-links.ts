/**
 * 실제 샌드박스 분쟁 ↔ 시드 연결 표 읽기 (T047, SPEC v2.6 9-4장 "연결 표", 계약 `DemoLinksConfig`).
 *
 * 이 표가 "무엇을 화면에 보여 주고 어디에 실제로 보낼 수 있는가"의 **유일한 정본**이다. 분쟁 번호를
 * 코드에 직접 쓰지 않는다. 표에 없는 분쟁은 화면에 내지 않고 전송도 하지 않는다 (모르는 것은 막는다).
 *
 * 설정 파일은 신뢰하지 않는 입력으로 보고 zod로 검증한다 — 모양이 틀리면 화면을 반쯤 띄우지 말고 예외다.
 * 인수 테스트 AC29가 표의 **내용**을 지킨다. 이 파일은 표를 **읽는 방법**만 정한다.
 */
import { z } from 'zod';

import type { DemoLink, DemoLinksConfig } from '@/types';

import demoLinksJson from '../../../config/demo-links.json';

/** 분쟁 ID 꼴 (`src/paypal/disputes.ts`의 검사와 같은 뜻). 그 밖은 설정 오류다. */
const DISPUTE_ID = /^PP-[A-Za-z0-9-]{1,60}$/;

const demoLinkSchema = z.object({
  paypalDisputeId: z.string().regex(DISPUTE_ID, 'paypalDisputeId 꼴이 아니다'),
  seedDisputeId: z.string().min(1).nullable(),
  carrierOrderId: z.string().min(1).nullable(),
  showOnScreen: z.boolean(),
  liveSendAllowed: z.boolean(),
  note: z.string().optional(),
});

export const demoLinksConfigSchema = z.object({
  version: z.string().min(1),
  note: z.string().optional(),
  links: z.array(demoLinkSchema),
});

/** 설정 1개를 검증해 읽는다. 분쟁 번호가 겹치면 예외 (어느 줄이 이기는지 정할 수 없다). */
export function parseDemoLinks(value: unknown): DemoLinksConfig {
  const result = demoLinksConfigSchema.safeParse(value);
  if (!result.success) {
    const fields = new Set(result.error.issues.map((i) => (i.path.length === 0 ? '(전체)' : i.path.join('.'))));
    throw new Error(`config/demo-links.json: 모양이 계약과 다르다 (${[...fields].join(', ')})`);
  }
  const ids = result.data.links.map((l) => l.paypalDisputeId);
  if (new Set(ids).size !== ids.length) {
    throw new Error('config/demo-links.json: 같은 분쟁 번호가 두 줄에 있다');
  }
  return result.data;
}

/** 라이브 설정 (`config/demo-links.json`). 불러올 때 한 번 검증한다. */
export const demoLinksConfig: DemoLinksConfig = parseDemoLinks(demoLinksJson);

/** 표의 모든 줄. 파일에 적힌 순서 그대로 (화면 순서도 이 순서다). */
export const demoLinks: DemoLink[] = demoLinksConfig.links;

/** 분쟁 번호 → 표의 줄. 표에 없으면 `undefined`. */
export function linkFor(disputeId: string, links: DemoLink[] = demoLinks): DemoLink | undefined {
  return links.find((link) => link.paypalDisputeId === disputeId);
}

/** 화면에 내는 줄만 (지금 D1·D2·D3). 연습용·시연 제외 분쟁은 여기서 빠진다. */
export function screenLinks(links: DemoLink[] = demoLinks): DemoLink[] {
  return links.filter((link) => link.showOnScreen);
}

/**
 * 화면에 낼 분쟁만 남긴다 (AC19 초안 1번).
 *
 * 남기는 기준은 표의 `showOnScreen`뿐이다 — 표에 없는 분쟁, 연습용 분쟁(`PP-R-HEY-…`), 옛 서연
 * 분쟁(`PP-R-GAH-…`)은 모두 빠진다. **이전 미수령 분쟁 수도 이 결과로 센다** (빼지 않으면 서연의
 * 이전 분쟁이 1로 나온다, `DECISIONS.md` 2026-11-10).
 *
 * 받은 순서를 그대로 지킨다 (같은 입력이면 같은 결과).
 */
export function withoutDemoExcluded<T extends { dispute_id: string }>(disputes: T[], links: DemoLink[] = demoLinks): T[] {
  const allowed = new Set(screenLinks(links).map((link) => link.paypalDisputeId));
  return disputes.filter((dispute) => allowed.has(dispute.dispute_id));
}

/**
 * **실제 전송을 해도 되는가.** 표의 `liveSendAllowed`가 참일 때만 참이고, 표에 없으면 거짓이다.
 * T009의 전송 코드가 이것을 본다 (T047은 전송 코드를 만들지 않는다).
 */
export function isLiveSendAllowed(disputeId: string, links: DemoLink[] = demoLinks): boolean {
  return linkFor(disputeId, links)?.liveSendAllowed === true;
}
