/**
 * /demo/seller-dashboard 렌더 시험용 `IntroData` (T115). 값은 `loadIntroData`가 캐시 없이 만드는 것과 같다
 * (app-t115 시험이 둘이 같은지 본다).
 */
import type { IntroData } from '@/app/_server/intro-data';

export const INTRO_SAMPLE: IntroData = {
  peakDays: 15,
  cases: [
    {
      id: 'PP-R-GMS-10197661',
      buyer: { en: 'Seo-yeon Kim', ko: '김서연' },
      product: 'Wool Sweater, Navy',
      amount: '$72.00',
      reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
      repeat: false,
      due: { en: 'Nov 30', ko: '11/30' },
      mentionsChargeback: true,
    },
    {
      id: 'PP-R-ZOK-10200237', // 지호 새 품질 사건 (결정 2026-11-12 20:35)
      buyer: { en: 'Ji-ho Park', ko: '박지호' },
      product: 'Knit Cardigan, Oat',
      amount: '$48.00',
      reason: 'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED',
      repeat: false,
      // ZOK는 PayPal 응답 기한 없음 (DECISIONS 2026-11-12) — 캐시가 차도 null. config fallbackDue엔 옛 MBJ 키만 있다 (T126 보고)
      due: null,
      mentionsChargeback: false,
    },
    {
      id: 'PP-R-FYT-10197651',
      buyer: { en: 'Mike Morgan', ko: 'Mike Morgan' },
      product: 'Beanie + Scarf Set',
      amount: '$35.00',
      reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
      repeat: true,
      due: null,
      mentionsChargeback: false,
    },
  ],
};
