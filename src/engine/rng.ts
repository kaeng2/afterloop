/**
 * 시드 고정 난수 (SPEC v2.2 8장 "상품별 시드로 난수를 한 번 만들고"). 작업 T015.
 *
 * `Math.random`·`Date`·`performance.now`를 쓰지 않는다: 같은 시드면 어느 기계에서도 같은 순서의
 * 같은 값이 나와야 하고, 그래야 Before·After·폭포 단계가 **같은 난수**를 쓸 수 있다
 * (common random numbers, SPEC 8장). 난수 생성기와 시드 방식은 우리 구현이 정한 것이다 (SPEC 8장 Q4).
 *
 * 암호용이 아니다. 시뮬레이션에만 쓴다.
 */

/**
 * mulberry32: 32비트 상태 PRNG. [0, 1) 구간의 값을 돌려준다.
 *
 * 비교가 `난수 < 확률` 한 방향이라 1을 포함하지 않는 반열린 구간이 맞다 (확률 0이면 절대 걸리지 않고,
 * 확률 1이면 항상 걸린다). 상태는 32비트로 잘라 쓰므로 정수·음수·실수 시드를 모두 받는다.
 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * FNV-1a 32비트 해시. 상품 SKU 같은 문자열에서 시드를 결정적으로 만든다
 * (`simInputFor`가 쓴다. 화면과 합계가 같은 시드 = 같은 결과를 보게 하기 위한 것).
 */
export function seedFromString(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}
