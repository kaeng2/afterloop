'use server';

/**
 * 서랍이 부르는 서버 액션 (T064). 서버 메모리의 기록을 화면 줄로 바꿔 돌려준다.
 * PayPal을 부르지 않는다. 돌려주는 값은 문구·메서드·경로·응답 코드·시각·건수뿐이다.
 */
import { listActivity } from '../_server/activity';
import { initLocale } from '../_server/locale';
import { buildActivityView, type ActivityView } from './activity-view';

export async function loadActivityView(): Promise<ActivityView> {
  await initLocale();
  return buildActivityView(listActivity());
}
