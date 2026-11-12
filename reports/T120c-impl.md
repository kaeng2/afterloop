# T120c 구현 보고 (ui, Sonnet 5.5, 기준 SPEC v2.16)

## 한 일
- `src/app/cases/model.ts`: `ACTION_KEY`에 `repair: 'case.view.action.repair'` 추가.
- `config/copy.en.json`·`copy.ko.json`: `case.view.action.repair` ("Offer a free repair" / "무료 수선 제안").
- `src/app/cases/reply/load.ts`: 추천 수가 `repair`면 `move = null` → AI 초안·번역 경로로 넘기지 않고 기존 "초안 없음" 동작.
- `src/app/cases/view/load.ts` (지시서 목록 밖이나 같은 `src/app/cases/`, 같은 컴파일 오류 `ReplyMove`): 추천이 `repair`면 `unavailable`(초안 없음) 반환. tsc 0을 위해 필요했다.

## 확인
- `npx tsc --noEmit`: 오류 0.
- `npm test`: 2604 통과 / 1 실패 = `storefront.test.ts` 결정론 100회 5초 타임아웃(부하 때 flake, 단독 실행 31/31 통과, 내 변경과 무관).
- `npm run lint`: 오류 0 (경고 2, 기존).
- `npm run test:acceptance`: 179 통과 / 3 실패 = AC35 (repair 평가 없음, T120 전이라 예상된 것).
- 새 단위 테스트는 추가하지 않음 (현재 사건에는 repair 추천이 없어 동작 변화 없음).

## 컨트롤 타워에 요청할 결정
없음.
