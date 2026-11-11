/**
 * /intro — 첫 장면 껍데기 화면 (T078). 서버·PayPal·엔진·AI를 부르지 않는 정적 화면이다.
 * 문구와 고정 데모 값은 `config/intro.*.json`에서만 온다.
 */
import type { Metadata } from 'next';

import { IntroScreen } from './intro-screen';

export const metadata: Metadata = { title: 'Seller dashboard (demo mock)' };

export default function IntroPage() {
  return <IntroScreen />;
}
