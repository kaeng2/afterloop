/**
 * `tests/sandbox/last-run.md` 기록 (T001).
 *
 * 절(section)마다 따로 덮어쓴다: `sandbox:check`는 "조회" 절, `--probe-request-id`는 "요청 ID 길이" 절,
 * `sandbox:disputes`는 "분쟁 읽기" 절. 한쪽을 다시 돌려도 다른 쪽 기록은 남는다.
 *
 * 들어가는 것: 엔드포인트, 상태 코드, 주문·분쟁·캡처 ID, 시각.
 * 들어가지 않는 것: Client ID·Secret, 액세스 토큰, Authorization 헤더, 구매자 식별값(payer_id·이메일·이름).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from './env';

export type SectionName = 'check' | 'probe' | 'disputes';

/** 파일에 적히는 순서. */
const ORDER: SectionName[] = ['check', 'probe', 'disputes'];
const TITLE: Record<SectionName, string> = {
  check: '조회 (`npm run sandbox:check`)',
  probe: '요청 ID 길이 확인 (`npm run sandbox:check -- --probe-request-id`)',
  disputes: '분쟁 읽기 (`npm run sandbox:disputes`)',
};

const HEADER = '# 샌드박스 마지막 실행 기록\n\n> 스크립트가 덮어쓴다. 비밀값(Secret·토큰)과 구매자 개인정보는 적지 않는다.\n';
const marker = (name: SectionName): string => `<!-- afterloop:last-run:${name} -->`;

export const lastRunPath = (root: string = ROOT): string => path.join(root, 'tests/sandbox/last-run.md');

/**
 * 떼어 낸 절에서 제목 줄(`## …`)을 버린다.
 * 제목은 다시 쓸 때 붙이므로, 버리지 않으면 쓸 때마다 제목이 쌓인다.
 */
function stripHeadings(text: string): string {
  let out = text.trim();
  while (out.startsWith('## ')) {
    const lineEnd = out.indexOf('\n');
    if (lineEnd === -1) return '';
    out = out.slice(lineEnd + 1).trim();
  }
  return out;
}

/** 기존 파일에서 절들을 떼어 낸다 (알 수 없는 내용은 버린다). */
function readSections(file: string): Map<SectionName, string> {
  const sections = new Map<SectionName, string>();
  if (!existsSync(file)) return sections;
  const text = readFileSync(file, 'utf8');
  for (const name of ORDER) {
    const start = text.indexOf(marker(name));
    if (start === -1) continue;
    const rest = text.slice(start + marker(name).length);
    const ends = ORDER.map((other) => (other === name ? -1 : rest.indexOf(marker(other)))).filter((i) => i >= 0);
    const end = ends.length > 0 ? Math.min(...ends) : rest.length;
    sections.set(name, stripHeadings(rest.slice(0, end)));
  }
  return sections;
}

/** 절 하나를 덮어쓰고 파일을 다시 쓴다. */
export function writeLastRunSection(name: SectionName, body: string, root: string = ROOT): string {
  const file = lastRunPath(root);
  const sections = readSections(file);
  sections.set(name, body.trim());

  const parts = [HEADER];
  for (const section of ORDER) {
    const content = sections.get(section);
    if (content === undefined) continue;
    parts.push(`${marker(section)}\n## ${TITLE[section]}\n\n${content}\n`);
  }
  writeFileSync(file, `${parts.join('\n')}`, 'utf8');
  return file;
}

/** 기록에 적는 시각 (KST). */
export function kstStamp(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return `${shifted.toISOString().slice(0, 16).replace('T', ' ')} KST`;
}
