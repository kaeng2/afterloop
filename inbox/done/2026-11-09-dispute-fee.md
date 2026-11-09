## 요청: f(분쟁 수수료) 값 수정 — T004 착수 전
- 현재 config/params.json f = 800¢ (source "가정(임시)")
- PayPal 미국 공식: Standard Dispute Fee 15.00 USD, High Volume 30.00 USD
  - 출처: https://www.paypal.com/webapps/mpp/merchant-fees
  - inquiry 단계 해결 / 원만 합의 시 Standard 수수료 면제 (FAQ4352) → 제안 수락 분기에 f 없음은 현행 유지
- 변경: f = 1500¢, source "PayPal"
- 영향: AC1 기대값 변경. fight 4120→4610, offer 1816→1953(SPEC 반올림 규칙 적용 후 재계산해 확인), refund 5000 유지, 추천 offer 유지
  AC2 등 f를 쓰는 다른 AC와 fixture도 재계산
- 미결(기획자 확인 중): 판매자 승소 시에도 수수료 부과 여부. 답이 올 때까지 "질 때만 부과"(현행 공식) 유지
- 절차: SPEC 버전업 → DECISIONS.md 기록 → AC/fixture 갱신 → 테스트 통과 확인 후 T004 시작
