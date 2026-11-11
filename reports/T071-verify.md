판정: 통과

# T071 검증 (b2aef07, lane/engine)

- 범위: 변경은 `src/engine/sim.ts`(추가만, 22줄), `tests/unit/sim.test.ts`, `reports/T071-impl.md` 뿐. 기존 `simulate`·`simulatePass`·`simInputFor` 줄 변경 0 (순수 추가). SPEC v2.10 일치.
- 실행: `npm test` 1975 통과(종료 0), `npx tsc --noEmit` 0, `npm run lint` 0, `npm run test:acceptance` 158 통과/9 skipped(종료 0).
- 직접 대조(가디건 FK-CD-OAT, 4800센트/재고 120): 처방 0개·4개·2개 섞인 두 경우 모두 `simulate` 차이와 정확히 일치(엄밀 동등), FIX_ORDER 순서, 두 번 호출 결과 동일, 입력 불변, 켜짐/꺼짐 플래그 일치. 시간 10~23ms (< 500ms).

## 네 처방 값 (센트)
| 처방 | 처방 0개 (켜면 줄어드는 양) | 처방 4개 (끄면 늘어나는 양) |
|---|---|---|
| tracking_24h | 4637 | 4643 |
| color_note | 6602 | 2810 |
| kr_customs_notice | 1917 | 1147 |
| settle_first | 7862 | 4460 |

섞인 경우(참고): [tracking_24h, settle_first] 켠 상태 → 5435 / 2809 / 1146 / 8660. [color_note, kr_customs_notice] 켠 상태 → 4273 / 6603 / 1918 / 4090. 음수 없음.
