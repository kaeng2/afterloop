/**
 * 메뉴 항목과 "지금 보고 있는 화면" 판정 (T047). 그리지 않는 부분만 떼어 둔 파일이다
 * (`nav.tsx`가 가져다 쓰고, 단위 테스트는 이 파일을 부른다).
 *
 * Case(S5)는 메뉴에 없다 — Inbox(S4)에서 `/cases/[disputeId]`로 들어간다 (SPEC 2장).
 */

/** 화면 주소와 문구 키. 순서가 메뉴 순서다 (SPEC 2장 S1 → S2 → S3 → S4). */
export const NAV_ITEMS: readonly { href: string; copyKey: string }[] = [
  { href: '/', copyKey: 'nav.today' },
  { href: '/products', copyKey: 'nav.products' },
  { href: '/orders', copyKey: 'nav.orders' },
  { href: '/inbox', copyKey: 'nav.inbox' },
];

/** 지금 주소가 그 메뉴에 속하는지. `/`는 정확히 같을 때만 (모든 주소가 `/`로 시작한다). */
export function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}
