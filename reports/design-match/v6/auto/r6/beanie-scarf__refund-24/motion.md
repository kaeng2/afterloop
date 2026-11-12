# beanie-scarf__refund-24 · 모션

## 1440px

### 시안

| 종류 | 이름 | 대상 | duration | delay | easing | iterations |
|---|---|---|---|---|---|---|
| CSSTransition | background-color | button\|Refunded ✓ | 150 | 0 | ease | 1 |
| CSSAnimation | flash | div\|Disputes prevented | 1600 | 0 | linear | 1 |
| CSSAnimation | flash | div\|Money kept | 1600 | 0 | linear | 1 |
| CSSAnimation | flash | div\|Replies drafted by AI | 1600 | 0 | linear | 1 |
| CSSAnimation | rise | status\|✓ | 350 | 0 | linear | 1 |

타이머 간격: timeout 3000ms×1
이벤트 10개: transitionstart background-color @ button\|Refunded ✓×1; animationstart flash @ div\|Disputes prevented×1; animationstart flash @ div\|Money kept×1; animationstart flash @ div\|Replies drafted by AI×1; animationstart rise @ status\|✓×1; transitionend background-color @ button\|Refunded ✓×1; animationend rise @ status\|✓×1; animationend flash @ div\|Disputes prevented×1; animationend flash @ div\|Money kept×1; animationend flash @ div\|Replies drafted by AI×1

### 앱

| 종류 | 이름 | 대상 | duration | delay | easing | iterations |
|---|---|---|---|---|---|---|
| CSSTransition | background-color | button\|Refunded ✓ | 150 | 0 | ease | 1 |
| CSSAnimation | motion-toast-rise | status\|✓ | 350 | 0 | linear | 1 |

타이머 간격: timeout 3000ms×1
이벤트 4개: transitionstart background-color @ button\|Refunded ✓×1; animationstart motion-toast-rise @ status\|✓×1; transitionend background-color @ button\|Refunded ✓×1; animationend motion-toast-rise @ status\|✓×1

## 1920px

### 시안

| 종류 | 이름 | 대상 | duration | delay | easing | iterations |
|---|---|---|---|---|---|---|
| CSSTransition | background-color | button\|Refunded ✓ | 150 | 0 | ease | 1 |
| CSSAnimation | flash | div\|Disputes prevented | 1600 | 0 | linear | 1 |
| CSSAnimation | flash | div\|Money kept | 1600 | 0 | linear | 1 |
| CSSAnimation | flash | div\|Replies drafted by AI | 1600 | 0 | linear | 1 |
| CSSAnimation | rise | status\|✓ | 350 | 0 | linear | 1 |

타이머 간격: timeout 3000ms×1
이벤트 10개: transitionstart background-color @ button\|Refunded ✓×1; animationstart flash @ div\|Disputes prevented×1; animationstart flash @ div\|Money kept×1; animationstart flash @ div\|Replies drafted by AI×1; animationstart rise @ status\|✓×1; transitionend background-color @ button\|Refunded ✓×1; animationend rise @ status\|✓×1; animationend flash @ div\|Disputes prevented×1; animationend flash @ div\|Money kept×1; animationend flash @ div\|Replies drafted by AI×1

### 앱

| 종류 | 이름 | 대상 | duration | delay | easing | iterations |
|---|---|---|---|---|---|---|
| CSSTransition | background-color | button\|Refunded ✓ | 150 | 0 | ease | 1 |
| CSSAnimation | motion-toast-rise | status\|✓ | 350 | 0 | linear | 1 |

타이머 간격: timeout 3000ms×1
이벤트 4개: transitionstart background-color @ button\|Refunded ✓×1; animationstart motion-toast-rise @ status\|✓×1; transitionend background-color @ button\|Refunded ✓×1; animationend motion-toast-rise @ status\|✓×1

## 시안과 다른 것

| 폭 | 대상 | 항목 | 시안 | 앱 | 예외 |
|---|---|---|---|---|---|
| 1440 | div\|Disputes prevented | flash | 1600ms · delay 0 · linear · ×1 | (없음) | **설명 없음** |
| 1440 | div\|Money kept | flash | 1600ms · delay 0 · linear · ×1 | (없음) | **설명 없음** |
| 1440 | div\|Replies drafted by AI | flash | 1600ms · delay 0 · linear · ×1 | (없음) | **설명 없음** |
| 1440 | status\|✓ | rise | 350ms · delay 0 · linear · ×1 | (없음) | **설명 없음** |
| 1440 | status\|✓ | motion-toast-rise | (없음) | 350ms · delay 0 · linear · ×1 | **설명 없음** |
| 1920 | div\|Disputes prevented | flash | 1600ms · delay 0 · linear · ×1 | (없음) | **설명 없음** |
| 1920 | div\|Money kept | flash | 1600ms · delay 0 · linear · ×1 | (없음) | **설명 없음** |
| 1920 | div\|Replies drafted by AI | flash | 1600ms · delay 0 · linear · ×1 | (없음) | **설명 없음** |
| 1920 | status\|✓ | rise | 350ms · delay 0 · linear · ×1 | (없음) | **설명 없음** |
| 1920 | status\|✓ | motion-toast-rise | (없음) | 350ms · delay 0 · linear · ×1 | **설명 없음** |

> 앱에만 있는 타이머(프레임워크 내부)는 차이로 세지 않는다. 시안 타이머 간격이 앱에 없을 때만 센다.
