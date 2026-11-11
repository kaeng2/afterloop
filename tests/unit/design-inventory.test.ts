import { describe, expect, it } from 'vitest';
import { buildInventory, extractTables, parseFilled, type MockupInput } from '../../scripts/design/inventory';

// 표마다 최소 1행이 나오도록 만든 작은 가짜 시안 (실제 시안 파일은 읽지 않는다)
const FAKE = `<!doctype html>
<x-dc>
<helmet><style>
.btn{background:#112233;transition:color .3s ease}.btn:hover{background:rgba(0, 0, 0, 0.5)}
@keyframes pop{0%{opacity:0}100%{opacity:1}}
.pop{animation:pop .4s ease both;background:linear-gradient(120deg, #002991 0%, #60CDFF 100%)}
</style></helmet>
<button class="btn" onClick="{{toggle}}" aria-expanded="{{boxOpen}}">Toggle</button>
<sc-if value="{{boxOpen}}"><div class="box" style="transform:rotate(90deg)">x</div></sc-if>
</x-dc>
<script>
class A {
  toggle() { this.setState({ boxOpen: !this.state.boxOpen, seen: true }); this.later(() => this.setState({ done: 1 }), 500); }
  later(fn, ms) { setTimeout(fn, ms); }
  renderVals() {
    const riskCol = (p) => p >= 0.5 ? '#C4321F' : '#0066F5';
    return { st: 'color:' + (this.state.boxOpen ? '#000000' : '#C4321F') };
  }
}
</script>`;

const input: MockupInput[] = [{ file: 'fake/Fake.dc.html', text: FAKE }];

describe('design inventory (T097)', () => {
  it('표 다섯 개가 모두 1행 이상 나온다', () => {
    const t = extractTables(FAKE);
    for (const id of [1, 2, 3, 4, 5] as const) expect(t[id].length, `표 ${id}`).toBeGreaterThan(0);
  });

  it('색·모션·상태 키를 올바르게 뽑는다', () => {
    const t = extractTables(FAKE);
    const keys = (id: 1 | 2 | 3 | 4 | 5) => t[id].map((r) => r.key);
    expect(keys(1)).toContain('#112233');
    expect(keys(1)).toContain('rgba(0,0,0,0.5)');
    expect(keys(1)).toContain('linear-gradient(120deg,#002991 0%,#60CDFF 100%)');
    expect(keys(2)).toContain('@keyframes pop');
    expect(keys(2)).toContain('.btn:hover');
    expect(keys(2)).toContain('transition: color .3s ease');
    expect(keys(2)).toContain('later 500');
    const click = t[3].find((r) => r.key === 'onClick toggle');
    expect(click?.note).toContain('boxOpen');
    expect(click?.note).toContain('seen');
    expect(click?.note).toContain('done');
    expect(keys(4)).toContain('sc-if boxOpen');
    expect(keys(4)).toContain('state boxOpen');
    expect(keys(4)).toContain('rotate(90deg)');
    expect(t[5].some((r) => r.key.startsWith('fn riskCol'))).toBe(true);
    expect(t[5].some((r) => r.key.includes("'#000000' : '#C4321F'"))).toBe(true);
  });

  it('같은 시안이면 같은 출력이고 바뀐 것이 없다고 알린다', () => {
    const a = buildInventory(input, null, '2026-01-01 00:00');
    const b = buildInventory(input, a.md, '2026-02-02 12:00');
    expect(b.changed).toBe(false);
    expect(b.md).toBe(a.md);
  });

  it('다시 돌려도 채운 상태·근거 칸이 유지된다 (파이프·역슬래시 포함)', () => {
    const a = buildInventory(input, null, '2026-01-01 00:00');
    const lines = a.md.split('\n');
    const idx = lines.findIndex((l) => l.startsWith('| `#112233`'));
    expect(idx).toBeGreaterThan(0);
    lines[idx] = lines[idx].replace(/\|\s*\|\s*\|$/, '| 구현함 | src/app/x.tsx 시험 a\\|b |');
    const filledMd = lines.join('\n');
    expect(parseFilled(filledMd).size).toBe(1);

    const b = buildInventory(input, filledMd, '2026-03-03 00:00');
    expect(b.md).toContain('| 구현함 | src/app/x.tsx 시험 a\\|b |');

    // 시안이 바뀌어도 (색 하나 추가) 채운 칸은 남는다
    const changed: MockupInput[] = [{ file: input[0].file, text: FAKE.replace('#112233', '#112233;color:#ABCDEF') }];
    const c = buildInventory(changed, filledMd, '2026-04-04 00:00');
    expect(c.changed).toBe(true);
    expect(c.md).toContain('| 구현함 | src/app/x.tsx 시험 a\\|b |');
    expect(c.md).toContain('`#ABCDEF`');
  });

  it('시안에서 사라진 행의 채운 값은 "사라진 행" 절에 남는다', () => {
    const a = buildInventory(input, null, '2026-01-01 00:00');
    const filledMd = a.md.replace(/^(\| `#112233` .*)\|\s*\|\s*\|$/m, '$1| 예외 | 데이터 |');
    const gone: MockupInput[] = [{ file: input[0].file, text: FAKE.replace('#112233', '#445566') }];
    const c = buildInventory(gone, filledMd, '2026-05-05 00:00');
    expect(c.md).toContain('## 사라진 행');
    expect(c.md).toContain('| 예외 | 데이터 |');
  });
});
