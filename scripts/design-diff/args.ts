export interface Args {
  mock?: string;
  entry?: string;
  app?: string;
  out: string;
  states?: string[];
  widths: number[];
  statesFile?: string;
  exceptions?: string;
  vendor?: string;
  chrome?: string;
  channel?: string;
  headed: boolean;
  analyzeOnly: boolean;
  regen: boolean;
  maxDepth?: number;
  maxStates?: number;
}

const USAGE = `사용법: npx tsx scripts/design-diff/run.ts --mock <시안 폴더> --app <앱 URL> --out <결과 폴더>
  [--states s1,s2] [--widths 1440,1920] [--entry Desk.dc.html] [--states-file states.json]
  [--exceptions exceptions.json] [--vendor <react UMD 폴더>] [--chrome <실행 파일>] [--channel chrome]
  [--max-depth 4] [--max-states 120] [--analyze-only] [--regen] [--headed]`;

export function usage(): string {
  return USAGE;
}

export function parseArgs(argv: string[]): Args {
  const a: Args = { out: 'out/design-diff', widths: [1440, 1920], headed: false, analyzeOnly: false, regen: false };
  const need = (i: number, k: string) => {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) throw new Error(`${k} 값이 없다\n${USAGE}`);
    return v;
  };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    switch (k) {
      case '--mock':
        a.mock = need(i++, k);
        break;
      case '--entry':
        a.entry = need(i++, k);
        break;
      case '--app':
        a.app = need(i++, k);
        break;
      case '--out':
        a.out = need(i++, k);
        break;
      case '--states':
        a.states = need(i++, k).split(',').map((s) => s.trim()).filter(Boolean);
        break;
      case '--widths':
        a.widths = need(i++, k)
          .split(',')
          .map((s) => Number(s.trim()))
          .filter((n) => Number.isFinite(n) && n > 0);
        if (!a.widths.length) throw new Error('--widths 값이 잘못됐다');
        break;
      case '--states-file':
        a.statesFile = need(i++, k);
        break;
      case '--exceptions':
        a.exceptions = need(i++, k);
        break;
      case '--vendor':
        a.vendor = need(i++, k);
        break;
      case '--chrome':
        a.chrome = need(i++, k);
        break;
      case '--channel':
        a.channel = need(i++, k);
        break;
      case '--max-depth':
        a.maxDepth = Number(need(i++, k));
        break;
      case '--max-states':
        a.maxStates = Number(need(i++, k));
        break;
      case '--analyze-only':
        a.analyzeOnly = true;
        break;
      case '--regen':
        a.regen = true;
        break;
      case '--headed':
        a.headed = true;
        break;
      case '-h':
      case '--help':
        throw new Error(USAGE);
      default:
        throw new Error(`모르는 인자: ${k}\n${USAGE}`);
    }
  }
  if (!a.mock) throw new Error(`--mock이 필요하다\n${USAGE}`);
  if (!a.analyzeOnly && !a.app) throw new Error(`--app이 필요하다 (상태 목록만 만들려면 --analyze-only)\n${USAGE}`);
  return a;
}
