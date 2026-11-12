'use client';

/**
 * 데모 항목 한 장 카드 — Lena #1029 (약속한 환불) · Yuki #1051 (사이즈 문의) (T122c, 시안 v6 L443–L478 `v.ai.lena`·`v.ai.yuki`,
 * 결정 2026-11-12 20:35 ③ · 충돌 ②).
 *
 * **PayPal 사건이 아니다 — 전부 Demo data.** 제목·설명·버튼 글·금액·약속일은 시드(`seed/demo-display.json` `demoItems`, T121),
 * 구매자 글·초안·단계 문장은 시안 문장(`config/copy.*.json` `card.lena.*`·`card.yuki.*`).
 *
 * 버튼은 **화면 상태만** 바꾼다: 서버 액션·PayPal·AI 호출이 없다 (쓰기 0회).
 * - Lena [Refund $24] = 승인 버튼. 누르면 "Refunded ✓" + "Simulated · no money moved" (실제 환불 호출 없음)
 * - Yuki [Looks good] = AI 답변 확인. 시안의 "Auto-sent"는 쓰지 않는다 (Auto 없음 예외 V6-C42) → "Simulated · not sent"
 *
 * 금액·날짜는 시드 값을 표기만 바꾼다 (`toDollarsRounded`, 날짜 표기). 계산하지 않는다.
 */
import { useState } from 'react';

import { Badge } from '../_shared/badges';
import { useLocale, useT } from '../_shared/locale-context';
import { toDollarsRounded } from '../_shared/money';
import type { TodayRowView } from './model';
import { OneCard, translatedFor } from './one-card';
import { tPick } from './one-card-data';
import { useSavings } from './savings';
import { WorkDetail } from './work-card';

/** 시드 `demoItems` 한 줄 (직렬화할 수 있는 값만 — 서버가 시드에서 넘긴다). */
export type DemoItemCardItem = {
  key: 'lena' | 'yuki';
  displayNo: string;
  title?: string;
  titleKo?: string;
  aiAnswer?: string;
  aiAnswerKo?: string;
  body: string;
  bodyKo: string;
  action: string;
  actionKo: string;
  refundCents?: number;
  promisedDate?: string;
};

/** "Nov 6" / "11월 6일" (시드 날짜 표기만). */
function dayLabel(ymd: string, locale: 'en' | 'ko'): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (match === null) return ymd;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', { timeZone: 'UTC', month: locale === 'ko' ? 'long' : 'short', day: 'numeric' }).format(date);
}

export function DemoItemCard({
  item,
  row = null,
  doneId = null,
}: {
  item: DemoItemCardItem;
  row?: TodayRowView | null;
  /** 목록 항목 id. 주면 누른 뒤 "Done today"로 옮긴다 (화면 상태만). */
  doneId?: string | null;
}) {
  const t = useT();
  const locale = useLocale();
  const { report, markDone } = useSavings();
  const [done, setDone] = useState(false);
  const ko = locale === 'ko';
  const key = item.key;
  const lang = key === 'lena' ? 'de' : 'ja';
  const languageName = t(`card.langOf.${lang}`);
  const amount = item.refundCents === undefined ? null : toDollarsRounded(item.refundCents);
  const params = { amount: amount ?? '', date: item.promisedDate === undefined ? '' : dayLabel(item.promisedDate, locale) };
  const fill = (k: string) => tPick(k, params, locale);

  const title = key === 'lena' ? (ko ? item.titleKo : item.title) : ko ? item.aiAnswerKo : item.aiAnswer;
  const steps = [1, 2, 3, 4].map((n) => fill(`card.${key}.s${n}`));
  const doneLabel = t(`card.${key}.done`);
  const api = key === 'lena' && amount !== null ? t('card.api.refund', { amount }) : t('card.simulatedNotSent');

  function run() {
    if (done) return;
    // 화면 상태만. 서버·PayPal을 부르지 않는다 (Simulated)
    setDone(true);
    if (doneId !== null) markDone(doneId, { simulated: true });
    report(null);
  }

  const titleId = `demo-item-title-${key}`;
  return (
    <WorkDetail row={row} className="demo-item-detail">
      <OneCard
        titleId={titleId}
        title={title ?? ''}
        body={
          <>
            {ko ? item.bodyKo : item.body} <Badge kind="demo" />
          </>
        }
        message={{
          languageName,
          code: lang,
          original: t(`card.${key}.msg`),
          translated: translatedFor(t(`card.${key}.msgTr`), lang, locale),
          tags: [{ text: t(`card.${key}.tag1`) }, { text: t(`card.${key}.tag2`) }],
          badge: <Badge kind="demo" />,
        }}
        steps={steps}
        draft={{
          title: t(done ? 'card.draftSentT' : 'card.draftT', { language: languageName }),
          code: lang,
          original: fill(`card.${key}.draft`),
          translated: translatedFor(fill(`card.${key}.draftTr`), lang, locale),
          sent: done,
        }}
        approval={{ label: t('card.apiT'), api }}
        action={
          <>
            <button type="button" className="btn b-black" disabled={done} onClick={run}>
              {done ? doneLabel : ko ? item.actionKo : item.action}
            </button>
            {key === 'lena' ? <span className="oc-mode">{t('card.simulatedNoMoney')}</span> : null}
          </>
        }
      />
    </WorkDetail>
  );
}
