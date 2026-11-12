// design-diff 공통 타입. 시안(mock)과 앱(app)을 같은 클릭 순서로 재현해 비교한다.

/** 상태를 만드는 클릭 한 단계. 시안·앱 양쪽에서 같은 규칙(src/page-scripts.ts findTarget)으로 찾는다. */
export interface ClickStep {
  /** 접근성 역할 (button, row, switch, columnheader …). 명시 role 속성이 없으면 태그의 기본 역할 */
  role?: string;
  /** 요소 이름표: 자기 글자(직계 텍스트). 없으면 자손 중 처음 나오는 자기 글자 */
  text?: string;
  /** text가 정확히 같지 않아도 포함되면 찾는다 (앱 쪽 문구가 조금 다를 때) */
  contains?: boolean;
  /** CSS selector. 있으면 role/text보다 우선 */
  selector?: string;
  /** 같은 조건에 맞는 요소가 여럿일 때 몇 번째(0부터, 문서 순서) */
  nth?: number;
  /** 누른 뒤 기다릴 시간(ms). 시안 타이머 합에서 계산 */
  waitMs?: number;
}

export interface TimerUse {
  kind: 'timeout' | 'interval';
  ms: number;
  count: number;
}

export interface StateDef {
  name: string;
  /** 시안 쪽 클릭 단계 */
  mock: ClickStep[];
  /** 앱 쪽 클릭 단계 (기본: 시안과 같은 글자·역할) */
  app: ClickStep[];
  /** 앱 시작 경로(--app URL 뒤에 붙임). 없으면 --app 그대로 */
  appPath?: string;
  /** 마지막 단계 뒤 시안 타이머가 끝나는 데 걸린 시간(ms) */
  settleMs: number;
  /** 마지막 단계에서 시안 로직이 건 타이머 */
  timers: TimerUse[];
  /** 시안 로직에서 바뀐 state 키 (마지막 단계) */
  changed: string[];
  note?: string;
}

export interface StatesFile {
  version: 1;
  source: string;
  generatedAt: string;
  states: StateDef[];
}

/** 페이지에서 잡은 요소 하나 (계산된 스타일 비교용) */
export interface ElementSnap {
  key: string;
  role: string;
  text: string;
  tag: string;
  styles: Record<string, string>;
  /** exceptions.json의 selector 중 이 요소(또는 조상)에 맞는 것 */
  matches: string[];
}

export interface AnimSnap {
  type: string;
  name: string;
  target: string;
  duration: string;
  delay: string;
  easing: string;
  iterations: string;
}

export interface MotionEvent {
  type: string;
  name: string;
  target: string;
}

export interface MotionSnap {
  animations: AnimSnap[];
  events: MotionEvent[];
  timers: TimerUse[];
}

export interface SideCapture {
  ok: boolean;
  error?: string;
  elements: ElementSnap[];
  motion: MotionSnap;
  /** 상대 경로 (out/<state>/ 기준) */
  png?: string;
  video?: string;
}

export type DiffKind = 'style' | 'missing' | 'extra' | 'pixel' | 'motion' | 'repro';

export interface DiffItem {
  state: string;
  width: number;
  kind: DiffKind;
  key: string;
  role?: string;
  text?: string;
  prop?: string;
  mock?: string;
  app?: string;
  selectors: string[];
  /** 이 차이를 설명하는 예외 줄 id */
  exceptions: string[];
}

export interface ExceptionRule {
  id: string;
  reason?: string;
  match: {
    kind?: DiffKind | DiffKind[];
    state?: string;
    width?: number;
    role?: string;
    /** 글자(부분 일치). "/패턴/플래그"면 정규식 */
    text?: string;
    /** 요소 key 부분 일치 */
    key?: string;
    prop?: string | string[];
    selector?: string;
  };
}

export interface PixelResult {
  width: number;
  ratio: number;
  diffPixels: number;
  total: number;
}

export interface StateResult {
  state: string;
  widths: number[];
  diffs: DiffItem[];
  pixels: PixelResult[];
  unexplained: number;
  pass: boolean;
}
