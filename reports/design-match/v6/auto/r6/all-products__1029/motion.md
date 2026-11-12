# all-products__1029 · 모션

## 1440px

### 시안

| 종류 | 이름 | 대상 | duration | delay | easing | iterations |
|---|---|---|---|---|---|---|
| CSSTransition | background-color | button\|#1042 | 150 | 0 | ease | 1 |
| CSSTransition | background-color | button\|#1029 | 150 | 0 | ease | 1 |

타이머 간격: 없음
이벤트 5개: transitionstart background-color @ button\|#1042×1; transitionend background-color @ button\|#1042×1; transitionstart background-color @ button\|#1029×2; transitionend background-color @ button\|#1029×1

### 앱

| 종류 | 이름 | 대상 | duration | delay | easing | iterations |
|---|---|---|---|---|---|---|
| CSSTransition | background-color | button\|#1042 | 150 | 0 | ease | 1 |
| CSSTransition | opacity | presentation\| | 400 | 0 | ease | 1 |
| CSSTransition | opacity | presentation\|Product | 400 | 0 | ease | 1 |
| CSSTransition | opacity | presentation\|Dispute risk | 400 | 0 | ease | 1 |
| CSSTransition | background-color | button\|#1029 | 150 | 0 | ease | 1 |

타이머 간격: interval 1000ms×2, timeout 200ms×2, timeout 500ms×10, timeout 50ms×1
이벤트 7개: transitionstart background-color @ button\|#1042×1; transitionstart opacity @ presentation\|Product×1; transitionstart opacity @ presentation\|Dispute risk×1; transitionend background-color @ button\|#1042×1; transitionstart background-color @ button\|#1029×2; transitionend background-color @ button\|#1029×1

## 1920px

### 시안

| 종류 | 이름 | 대상 | duration | delay | easing | iterations |
|---|---|---|---|---|---|---|
| CSSTransition | background-color | button\|#1042 | 150 | 0 | ease | 1 |
| CSSTransition | background-color | button\|#1029 | 150 | 0 | ease | 1 |

타이머 간격: 없음
이벤트 5개: transitionstart background-color @ button\|#1042×1; transitionend background-color @ button\|#1042×1; transitionstart background-color @ button\|#1029×2; transitionend background-color @ button\|#1029×1

### 앱

| 종류 | 이름 | 대상 | duration | delay | easing | iterations |
|---|---|---|---|---|---|---|
| CSSTransition | background-color | button\|#1042 | 150 | 0 | ease | 1 |
| CSSTransition | opacity | presentation\|Product | 400 | 0 | ease | 1 |
| CSSTransition | opacity | presentation\|Dispute risk | 400 | 0 | ease | 1 |
| CSSTransition | background-color | button\|#1029 | 150 | 0 | ease | 1 |

타이머 간격: interval 1000ms×2, timeout 200ms×2, timeout 500ms×10, timeout 50ms×1
이벤트 7개: transitionstart background-color @ button\|#1042×1; transitionstart opacity @ presentation\|Product×1; transitionstart opacity @ presentation\|Dispute risk×1; transitionend background-color @ button\|#1042×1; transitionstart background-color @ button\|#1029×2; transitionend background-color @ button\|#1029×1

## 시안과 다른 것

| 폭 | 대상 | 항목 | 시안 | 앱 | 예외 |
|---|---|---|---|---|---|
| 1440 | presentation\| | opacity | (없음) | 400ms · delay 0 · ease · ×1 | **설명 없음** |
| 1440 | presentation\|Product | opacity | (없음) | 400ms · delay 0 · ease · ×1 | **설명 없음** |
| 1440 | presentation\|Dispute risk | opacity | (없음) | 400ms · delay 0 · ease · ×1 | **설명 없음** |
| 1920 | presentation\|Product | opacity | (없음) | 400ms · delay 0 · ease · ×1 | **설명 없음** |
| 1920 | presentation\|Dispute risk | opacity | (없음) | 400ms · delay 0 · ease · ×1 | **설명 없음** |

> 앱에만 있는 타이머(프레임워크 내부)는 차이로 세지 않는다. 시안 타이머 간격이 앱에 없을 때만 센다.
