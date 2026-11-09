## 요청: 운영 문서 갱신 (컨트롤타워가 직접 수정)
### CLAUDE.md
- "운영 모드: 자동 배분" 섹션: 사람이 지시문을 붙여넣지 않음. 컨트롤타워가 서브에이전트(또는 worktree에서 claude -p)로 tasks/T0xx.md 실행.
  흐름: 구현 → 검증(별도 서브에이전트, 코드 수정 금지) → 통과 시 main 병합 → reports/STATUS.md 한 줄 + 푸시
- "심사위원 리뷰 세션" 규칙: 읽기 전용, 결과는 reports/review-[날짜]-[회차].md만 작성, 새 기능 제안 금지, DECISIONS.md 결정사항 재논쟁 금지
- "브라우저 작업" 규칙: 웹 화면(PayPal 대시보드, sandbox 결제·분쟁, Render, Devpost)은 브라우저 에이전트 담당. Client Secret은 어떤 AI도 읽거나 출력하지 않음. live PayPal 화면이 나오면 즉시 중단
### DECISIONS.md
- 분쟁 수수료 f = $15 (근거: 파일 1)
- 실데이터 의존 값 분류 (README 정직성 표 원본)
  - 실데이터 필요(가정 배지): p_win, p_acc, 유형별 발생률, 처방 계수, 위험 점수 가중치
  - 공개 근거: 업계 평균 차지백 승률 약 20%(Datos Insights × Mastercard 2025, 참고용), INR 판매자 보호의 추적 정보 요건
  - 정책값: x 15%, 확신도 기준 0.7, autopilot 규칙, 72h
  - 판단식 x·A < (1−p_win)(A+f)는 p_acc와 무관 → 수락률 가정이 틀려도 추천은 유지
- 작업 구조: 로컬 컨트롤타워 자동 배분 + 심사위원 리뷰 3회(11/10 밤, 11/11 밤, 11/12 오후) + 브라우저 에이전트 분리 + 모바일은 STATUS.md 확인
### HANDOFF.md
- "6. 자동 배분 시작", "7. 브라우저 작업(sandbox 계정·앱 → Secret 직접 입력 → 승인 12건 → 분쟁 3건)" 추가
### README.md
- 지금은 수정하지 않음
