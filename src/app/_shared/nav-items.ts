/**
 * 위쪽 막대의 탭과 "지금 보고 있는 화면" 판정 (T047 → T060). 그리지 않는 부분만 떼어 둔 파일이다
 * (`top-bar.tsx`가 가져다 쓰고, 단위 테스트는 이 파일을 부른다).
 *
 * 화면 구조는 두 탭 + 서랍이다 (사람 결정 2026-11-10, SPEC v2.10 2장). 분쟁 상세는 Today 탭 오른쪽 칸에 있다
 * (`/?item=<분쟁 번호>`. 옛 주소 `/cases/<번호>`는 그리로 보낸다).
 */

export type TabItem = { href: string; copyKey: string };

/** 탭 주소와 문구 키. 순서가 탭 순서다. */
export const NAV_ITEMS: readonly TabItem[] = [
  { href: '/', copyKey: 'nav.today' },
];

/** 지금 주소가 그 탭에 속하는지. `/`는 정확히 같을 때만 (모든 주소가 `/`로 시작한다). */
export function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * 판매자 칩 글자. `config/rules.json`의 `reply.names.sellerSignature`("이름, 가게 이름")에서 가른다 —
 * 가게 이름 = 첫 쉼표 뒤, 머리글자 = 첫 쉼표 앞 첫 글자. 쉼표가 없으면 전체를 가게 이름으로 쓴다.
 */
export function sellerChip(signature: string): { initial: string; shop: string } {
  const comma = signature.indexOf(',');
  const person = (comma === -1 ? signature : signature.slice(0, comma)).trim();
  const shop = (comma === -1 ? signature : signature.slice(comma + 1)).trim();
  return { initial: [...person][0]?.toUpperCase() ?? '', shop: shop === '' ? person : shop };
}
