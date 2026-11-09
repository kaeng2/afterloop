/**
 * `tests/sandbox/manifest.json` 읽기·쓰기 (T001, SPEC v2.2 9-5장).
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
});

export const ManifestDisputeSchema = z.object({
  key: z.string().min(1),
  disputeId: z.string().min(1),
  orderKey: z.string().min(1),
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
