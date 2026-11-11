# T098a 보고 (2026-11-12 01:55)

- 기준 SPEC: v2.15   (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/ui-scenes / 440ea57 (구현) — 이 보고서는 그 다음 커밋

## 결과
완료 — `reports/design-match/inventory.md`의 Scene1(35행 + 더한 4행)·Scene3(119행)의 상태·근거 칸 빈 행 0. 시안과 다른 곳은 시안 파일 값 그대로 고쳤다. 예외는 DECISIONS 11/11 22:55 목록 안의 것만 (로고 안 색 #00A8EA 2행, 엔진 숫자 5행).

비교 방법: 시안 두 파일(`scene1/Scene1.dc.html` 180줄, `scene3/Main.dc.html` 579줄)의 helmet style·인라인 style·renderVals 계산식을 줄마다 읽고 앱 css·tsx와 맞대 봤다. 시안을 브라우저로 띄우지는 않았다 (규칙 값이 파일에 그대로 적혀 있음). Playwright로 나란히 찍기는 지시서대로 컨트롤 타워 몫이다.

## 고친 것 (시안 줄 → 앱)
**Scene 1 /intro**
- L20 활성 탭 밑줄·로고 자리 글자색: 강조색 #0066F5 → #002991
- L27 focus-visible: outline 강조색 → 흰 고리 `#FFFFFF 0 0 0 2px` + outline 2px #097FF5
- L26·L28·L29 아이콘: 그림자 `rgba(0,112,224,.45) 0 4px 14px` 추가. pulse는 테두리를 키우던 `::after` → 시안의 box-shadow 고리 0→16px, 1.6s ease-out
- L62 말풍선 그림자 `rgba(0,0,0,.25) 0 12px 32px`, L64 NEW 꼬리표 그라디언트, L104 Handle all 그라디언트(단색이던 것)
- L23 검정 버튼 hover #333333, L22 버튼 gap 8px·nowrap
- L44 "Demo mock" 칩(#ECEEF0) 추가 (맨 위 띠는 그대로 — 예외 /intro). 문구 `config/intro.*.json` `mock`

**Scene 3 /listing**
- L20 검정 버튼 #0B0F14 → #000000, L21 연한 버튼은 8자리 값 그대로(#05378214/#05378227)
- L126 결과판 바탕 #EEF0F3 → #EEF1F5. L537·L555 좋아진 확률 색 #0066F5 → #002991
- L58·L59 flashA/B 끝 transparent → #FFFFFF
- 그림자: snav.on·사진(inset 1px #E4E6E9), Insert(border → inset 2px #99C2FF), 체크(inset 2px #CFD3D8), livedot(outline → 0 0 0 3px), 툴팁 `0 8px 24px`·모달 `0 -12px 40px`(공용 `--shadow-selected`이던 것), 더하기 아이콘 `0 4px 10px`. focus 흰 고리 (L38)
- L26 `.pulse`: 시안에서는 점검 모달 회전 고리 가운데 그래프 아이콘(L184)에 붙는다. 앱에는 livedot에 잘못 붙어 있어서 아이콘을 더하고 그쪽으로 옮겼다. 회전 고리 그라디언트(#002991→#60CDFF, L183)도 더함
- L93 Add photo: `aria-disabled` 껍데기 → 시안처럼 label + 파일 입력. 고른 사진은 blob URL로 이 브라우저에서만 "Your photo" 칸에 보인다 (서버로 보내지 않고 계산과 무관). hover·focus-within·transition 시안 값
- L73 왼쪽 메뉴 6개에 선 아이콘. "PayPal payments"는 아이콘 없음 그대로 (로고 예외, 기존 시험)
- L570 Recalculate 간격 `config/motion.json` scene3.recalc 70 → 60ms (+25 그대로)
- 글자 크기·색 몇 곳을 시안대로: 결과판 보조 줄 #6C7378, 모달 안내 14px, 진행 글자 12px #6C7378, 상위 유형 "~x of n" 12px, "How we estimate it" 12px 700, 완료 카드 15px/14px/13px. 칩 nowrap, AI 칩 gap 4px, 읽기 전용 칸 회색 덧칠 지움 (시안 .fld는 흰 바탕)

숫자·관문·데모 모드·정직성 문구는 바꾸지 않았다. 새 문구 키 2개(`intro.mock`, `listing.yours`)는 en=ko 같은 키.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| src/app/intro/intro.css, intro-screen.tsx | 위 Scene 1 |
| src/app/listing/listing.css, listing-view.tsx, listing-screen.tsx | 위 Scene 3 (사진 상태는 listing-screen의 useState) |
| config/intro.en/ko.json | `mock` 키 |
| config/listing.en/ko.json | `yours` 키 |
| config/motion.json | scene3.recalc.intervalMs 60, source 문장 |
| reports/design-match/inventory.md | Scene1·Scene3 절만 채움. Scene1 표 3에 행 4개 더함 (아래 "남은 문제" 1) |
| tests/unit/app-t098a-scenes.test.ts | 새 시험 18개 (고친 자리마다) |
| tests/unit/app-shared-design.test.ts | B-3 그림자: intro/·listing/ css는 `--i-shadow-*`/`--ls-shadow-*` 변수만 쓰고, 그 값이 시안 파일에 있는 값인지 검사하는 시험 추가. 다른 폴더는 그대로 `--shadow-selected` 하나 |
| tests/unit/app-t087-listing.test.ts | recalc 60ms, pulse 자리(livedot → 모달 아이콘) |
| tests/unit/app-t067.test.ts | `--ls-accent-line` → `--ls-shadow-ins` (같은 #99C2FF) |

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | 177 (+9 skipped) | 0 | |
| npm test | 2433 | 0 | 첫 실행에서 `storefront.test.ts` "같은 입력 100회"가 1번 실패, 따로 돌리면 통과, 다시 전체를 돌려도 통과 (시간 의존 같음, 이번 변경과 무관) |
| npx tsc --noEmit | 통과 | 0 | |
| npm run lint | 통과 | 0 | |
| npm run build | 통과 | 0 | |
| inventory 다시 돌리기 (파일은 쓰지 않고 `buildInventory` 직접 호출) | 채운 254행 모두 유지 | 0 | Scene1·Scene3 빈 행 0. Desk 빈 행 66은 T098b 몫 |

## 남은 문제
1. Scene1 표 3은 스크립트 추출이 0행이었다 (시안의 링크가 onClick이 아니라 `href="{{deskHref}}"`라서). 시안 L54·L66·L101·L104를 보고 행 4개(아이콘·말풍선 버튼·Respond·Handle all)를 손으로 더했다. `npx tsx scripts/design/inventory.ts`를 다시 돌리면 이 4행은 맨 끝 "사라진 행" 절로 옮겨지고 값은 남는다 (dry-run으로 확인). 그 자리에 계속 두려면 스크립트가 `href`도 뽑아야 한다 — `scripts/`는 이 태스크의 수정 가능 폴더가 아니다.
2. B-3 그림자 시험(`app-shared-design.test.ts`)은 T098b도 고친다 (지시서 ③). 이번 변경은 intro/·listing/만 예외로 둔 작은 분기라서, T098b가 시안 그림자 목록으로 바꿀 때 병합 충돌이 날 수 있다. 같은 생각(시안 값 = 변수, 값 검사)이라 합치기는 어렵지 않다.
3. /intro 활동 목록에 "Yuki Tanaka" 줄이 있다 (`config/intro.*.json` activities, T078부터). 22:55 예외 "Lena·Yuki 없음"과 겹칠 수 있지만 "데이터 무변경" 지시에 따라 건드리지 않았다.

## 컨트롤 타워에 요청할 결정
1. **/listing 결과판의 "−x pts" 칩 (시안 L132 `p.hasDelta`, L538)**: 시안은 화면에서 지금 확률을 처음 확률에서 빼서 칩을 만든다. CLAUDE.md "숫자 계산은 src/engine에서만"이고 엔진 결과에 그 차이 값이 없어서 그리지 않았다 (inventory에 예외 "데이터(엔진 숫자)"로 적음, 지금은 "Before x%"와 확률 색으로 보인다). 칩이 필요하면 엔진 레인에 차이 값(또는 `listingFixGains`처럼 비교 결과)을 더하는 태스크가 필요하다.
