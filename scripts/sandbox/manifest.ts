/**
 * `tests/sandbox/manifest.json` 읽기·쓰기 (T001·T039, SPEC v2.3 9-5장).
 *
 * 주문·분쟁 ID와 지시서 표의 키만 담는다. 이메일·이름·토큰은 담지 않는다.
 * AC13이 이 파일을 읽으므로 모양을 바꿀 때는 컨트롤 타워에 먼저 알린다.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { ROOT } from './env';

export const ManifestOrderSchema = z.object({
  key: z.string().min(1),
  orderId: z.string().min(1),
  buyer: z.string().min(1),
  sku: z.string().min(1),
  tracked: z.boolean(),
  /** 캡처 ID (T026 capture 단계가 적는다. 없으면 주문 상세에서 읽는다) */
  captureId: z.string().min(1).optional(),
  /** 링크가 만료돼 `sandbox:orders -- --fresh`로 다시 만들었을 때의 이전 주문 ID들 (오래된 것부터, T029) */
  previousOrderIds: z.array(z.string().min(1)).optional(),
});

export const ManifestDisputeSchema = z.object({
  key: z.string().min(1),
  disputeId: z.string().min(1),
  orderKey: z.string().min(1),
  /**
   * 시연에서 뺀 분쟁 (SPEC v2.3 9-5). 기록으로만 남긴다 —
   * 스크립트는 이 분쟁에 아무 조치도 하지 않고, 이 ID를 다른 키에 다시 배정하지 않는다.
   * 다만 이 분쟁이 가리키는 주문도 "분쟁 진행 중"이므로 추적 등록 대상에서는 빠진다 (SPEC 9-3).
   */
  demoExcluded: z.boolean().optional(),
  /** 사람이 적어 둔 메모 (왜 시연에서 뺐는지 등). 읽고 다시 써도 지워지지 않는다. */
  note: z.string().min(1).optional(),
});

export const ManifestSchema = z.object({
  orders: z.array(ManifestOrderSchema).default([]),
  disputes: z.array(ManifestDisputeSchema).default([]),
});

export type ManifestOrder = z.infer<typeof ManifestOrderSchema>;
export type ManifestDispute = z.infer<typeof ManifestDisputeSchema>;
export type Manifest = z.infer<typeof ManifestSchema>;

export const manifestPath = (root: string = ROOT): string => path.join(root, 'tests/sandbox/manifest.json');

/** 파일이 없으면 빈 manifest. 모양이 틀리면 던진다 (추측하지 않는다). */
export function readManifest(root: string = ROOT): Manifest {
  const file = manifestPath(root);
  if (!existsSync(file)) return { orders: [], disputes: [] };
  const raw: unknown = JSON.parse(readFileSync(file, 'utf8'));
  const parsed = ManifestSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`tests/sandbox/manifest.json 모양이 맞지 않는다: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`);
  }
  return parsed.data;
}

export function writeManifest(manifest: Manifest, root: string = ROOT): void {
  writeFileSync(manifestPath(root), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}
