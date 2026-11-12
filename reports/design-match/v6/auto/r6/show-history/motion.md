# show-history · 모션

## 1440px

### 시안

| 종류 | 이름 | 대상 | duration | delay | easing | iterations |
|---|---|---|---|---|---|---|
| CSSTransition | transform | span\|▾ | 200 | 0 | ease | 1 |
| CSSAnimation | ping | svg\|100% | 1400 | 0 | linear | Infinity |
| CSSAnimation | rise | div\|Oct 19 | 350 | 0 | linear | 1 |

타이머 간격: 없음
이벤트 4개: transitionstart transform @ span\|▾×1; animationstart rise @ div\|Oct 19×1; transitionend transform @ span\|▾×1; animationend rise @ div\|Oct 19×1

### 앱

| 종류 | 이름 | 대상 | duration | delay | easing | iterations |
|---|---|---|---|---|---|---|
| CSSTransition | transform | span\|▾ | 200 | 0 | ease | 1 |
| CSSAnimation | motion-ping | div\|100% | 1400 | 0 | linear | Infinity |
| CSSAnimation | motion-rise | ol\|Oct 19 | 350 | 0 | linear | 1 |

타이머 간격: 없음
이벤트 4개: transitionstart transform @ span\|▾×1; animationstart motion-rise @ ol\|Oct 19×1; transitionend transform @ span\|▾×1; animationend motion-rise @ ol\|Oct 19×1

## 1920px

### 시안

| 종류 | 이름 | 대상 | duration | delay | easing | iterations |
|---|---|---|---|---|---|---|
| CSSTransition | transform | span\|▾ | 200 | 0 | ease | 1 |
| CSSAnimation | ping | svg\|100% | 1400 | 0 | linear | Infinity |
| CSSAnimation | rise | div\|Oct 19 | 350 | 0 | linear | 1 |

타이머 간격: 없음
이벤트 4개: transitionstart transform @ span\|▾×1; animationstart rise @ div\|Oct 19×1; transitionend transform @ span\|▾×1; animationend rise @ div\|Oct 19×1

### 앱

| 종류 | 이름 | 대상 | duration | delay | easing | iterations |
|---|---|---|---|---|---|---|
| CSSTransition | transform | span\|▾ | 200 | 0 | ease | 1 |
| CSSAnimation | motion-ping | div\|100% | 1400 | 0 | linear | Infinity |
| CSSAnimation | motion-rise | ol\|Oct 19 | 350 | 0 | linear | 1 |

타이머 간격: 없음
이벤트 4개: transitionstart transform @ span\|▾×1; animationstart motion-rise @ ol\|Oct 19×1; transitionend transform @ span\|▾×1; animationend motion-rise @ ol\|Oct 19×1

## 시안과 다른 것

| 폭 | 대상 | 항목 | 시안 | 앱 | 예외 |
|---|---|---|---|---|---|
| 1440 | svg\|100% | ping | 1400ms · delay 0 · linear · ×Infinity | (없음) | **설명 없음** |
| 1440 | div\|Oct 19 | rise | 350ms · delay 0 · linear · ×1 | (없음) | **설명 없음** |
| 1440 | div\|100% | motion-ping | (없음) | 1400ms · delay 0 · linear · ×Infinity | **설명 없음** |
| 1440 | ol\|Oct 19 | motion-rise | (없음) | 350ms · delay 0 · linear · ×1 | **설명 없음** |
| 1920 | svg\|100% | ping | 1400ms · delay 0 · linear · ×Infinity | (없음) | **설명 없음** |
| 1920 | div\|Oct 19 | rise | 350ms · delay 0 · linear · ×1 | (없음) | **설명 없음** |
| 1920 | div\|100% | motion-ping | (없음) | 1400ms · delay 0 · linear · ×Infinity | **설명 없음** |
| 1920 | ol\|Oct 19 | motion-rise | (없음) | 350ms · delay 0 · linear · ×1 | **설명 없음** |

> 앱에만 있는 타이머(프레임워크 내부)는 차이로 세지 않는다. 시안 타이머 간격이 앱에 없을 때만 센다.
