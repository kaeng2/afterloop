/**
 * 대화 (T061 4번 → T090 시안 v4). 말풍선. **구매자 원문이 기본**(큰 글자), 그 아래 한 줄 "Translated · 영어 · 날짜".
 * T090: 대화 사이의 배송사 줄("Carrier: Customs hold")은 그리지 않는다 (배송사 기록은 사건 기록 카드에 있다).
 *
 * - 시연용 글(시드 문의·시드 번역): 말풍선 끝에 작은 'Demo data' **하나만**.
 * - 영어가 없는 글은 원문만 두고, 구매자 언어가 영어가 아니면 "English translation unavailable"을 보인다
 *   (번역을 지어내지 않는다).
 * - 카드사 언급은 엔진 신호가 참일 때만 `<mark>`로 보인다 (`../model.ts`).
 * - 날짜가 있는 글·배송사 줄은 날짜 순, 날짜를 모르는 실제 분쟁 글은 맨 뒤 (받은 순서 그대로).
 *
 * 토글이 없어 서버 컴포넌트다. 받은 값은 이미 가려진 글이다.
 */
import type { FactLocale } from '@/ai/tokens';
import type { EscalationSignals } from '@/types';

import { Badge } from '../../_shared/badges';
import { currentLocale, t } from '../../_shared/copy';
import { readTags, type ReadTag } from '../desk-model';
import { shortDate, type CarrierLineView, type CaseMessageView } from '../model';
import { Segments } from './segments';

type Entry = { kind: 'message'; message: CaseMessageView } | { kind: 'carrier'; line: CarrierLineView };

const dateOf = (entry: Entry): string | null => (entry.kind === 'message' ? entry.message.date : entry.line.date);

/** 날짜가 있는 것끼리 날짜 순 (같으면 배송사 줄이 먼저), 날짜 없는 글은 뒤에 받은 순서대로. */
export function timeline(messages: CaseMessageView[], carrierLine: CarrierLineView | null): Entry[] {
  const entries: Entry[] = [
    ...(carrierLine === null ? [] : [{ kind: 'carrier' as const, line: carrierLine }]),
    ...messages.map((message) => ({ kind: 'message' as const, message })),
  ];
  const dated = entries.filter((entry) => dateOf(entry) !== null);
  const undated = entries.filter((entry) => dateOf(entry) === null);
  dated.sort((a, b) => {
    const da = (dateOf(a) ?? '').slice(0, 10);
    const db = (dateOf(b) ?? '').slice(0, 10);
    if (da !== db) return da < db ? -1 : 1;
    return a.kind === b.kind ? 0 : a.kind === 'carrier' ? -1 : 1;
  });
  return [...dated, ...undated];
}

/** 태그는 "AI read" 뒤에 두 개까지 (T090 시안). */
export const MAX_READ_TAGS = 2;

/** 말풍선 아래 "AI read" 태그 줄 (있는 판정만, `readTags`). 태그가 없으면 그리지 않는다. */
function ReadTags({ tags }: { tags: ReadTag[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="case-read">
      <span className="case-read-label">{t('case.read.label')}</span>
      {tags.slice(0, MAX_READ_TAGS).map((tag) => (
        <span key={tag.key} className={tag.tone === 'bad' ? 'desk-chip desk-chip-bad' : 'desk-chip'}>
          {t(tag.key)}
        </span>
      ))}
    </div>
  );
}

/** 말풍선 끝 "Demo data" — 글이나 번역 어느 쪽이든 시연용이면 **하나만** (T090). */
export function bubbleIsDemo(message: CaseMessageView): boolean {
  return message.source === 'demo' || message.badges.includes('demo') || message.englishBadges.includes('demo');
}

/**
 * 말풍선 (T090 시안 v4): 원문 → 아래 한 줄 "Translated · <영어> · <날짜>". 시연용 글이면 끝에 작은 "Demo data" 하나.
 * 번역이 없는 비영어 글은 "English translation unavailable · <날짜>" (번역을 지어내지 않는다).
 */
function Bubble({
  message,
  locale,
  markTitle,
  tags,
}: {
  message: CaseMessageView;
  locale: FactLocale | null;
  markTitle: string;
  tags: ReadTag[];
}) {
  const date = <span className="num">{message.date === null ? t('case.view.dateUnknown') : shortDate(message.date)}</span>;
  const demo = bubbleIsDemo(message) ? <Badge kind="demo" /> : null;
  // 원문이 영어면(또는 번역이 원문과 같으면) 번역을 두지 않는다 — 같은 글이 두 번 나오지 않게 (T068 재시도 2번)
  // T107 (시안 DI.ko msgs en:''): 한국어 화면에서 한국어 원문이면 영어 번역 줄 없이 날짜만
  const koScreen = currentLocale() === 'ko' && locale === 'ko' && !message.originalIsEnglish;
  const noEnglishLine = koScreen || (message.english === null && (locale === 'en' || message.originalIsEnglish));
  return (
    <li className="case-bubble-wrap">
      <div className="case-bubble">
        <p className="case-bubble-original" lang={message.originalIsEnglish ? 'en' : (locale ?? undefined)}>
          <Segments segments={message.original} markTitle={markTitle} />
        </p>
        {noEnglishLine ? (
          <p className="case-bubble-sub">
            {date}
            {demo}
          </p>
        ) : message.english === null ? (
          <p className="case-bubble-sub">
            <span>{t('case.view.englishUnavailable')}</span>
            {' · '}
            {date}
            {demo}
          </p>
        ) : (
          <p className="case-bubble-sub">
            <span>{t('case.view.translated')}</span>
            {' · '}
            <span lang="en">
              <Segments segments={message.english} markTitle={markTitle} />
            </span>
            {' · '}
            {date}
            {demo}
          </p>
        )}
      </div>
      <ReadTags tags={tags} />
    </li>
  );
}

const hasMark = (message: CaseMessageView): boolean =>
  [...message.original, ...(message.english ?? [])].some((segment) => segment.mark);

export function Conversation({
  messages,
  locale,
  signals = null,
  languageKey = null,
}: {
  messages: CaseMessageView[];
  /** T090부터 대화 사이에 배송사 줄을 그리지 않는다 (받아도 쓰지 않는다 — 옛 부르는 쪽 호환). */
  carrierLine?: CarrierLineView | null;
  locale: FactLocale | null;
  /** 엔진 신호 (T076 "AI read" 태그 — 있는 판정만). 없으면 태그 없음. */
  signals?: EscalationSignals | null;
  /** 구매자 언어 키 (제목 옆 "Original, in Korean"). */
  languageKey?: string | null;
}) {
  const markTitle = t('case.view.cardCompanyMark');
  const entries = timeline(messages, null);
  const lastReal = [...messages].reverse().find((message) => message.source === 'paypal') ?? null;

  return (
    <section className="case-conversation zone-buyer" aria-labelledby="case-conversation">
      <div className="desk-card-head">
        <h2 className="desk-card-title" id="case-conversation">
          {t('case.view.conversation')}
        </h2>
        <span className="desk-card-sub">
          {languageKey === null || locale === 'en'
            ? t('case.view.conversationSubEn')
            : t('case.view.conversationSub', { language: t(languageKey) })}
        </span>
      </div>

      {messages.length === 0 ? <p className="small muted">{t('case.view.noMessages')}</p> : null}

      <ol className="case-thread">
        {entries.map((entry, index) =>
          entry.kind === 'carrier' ? (
            <li key={`carrier-${index}`} className="case-carrier-line">
              <span className="num">{t('case.view.carrierLine', { date: shortDate(entry.line.date), text: entry.line.text })}</span>
              {entry.line.badges.map((kind) => (
                <Badge key={kind} kind={kind} />
              ))}
            </li>
          ) : (
            <Bubble
              key={`message-${index}`}
              message={entry.message}
              locale={locale}
              markTitle={markTitle}
              tags={readTags({ marked: hasMark(entry.message), isLastReal: entry.message === lastReal, signals })}
            />
          ),
        )}
      </ol>
    </section>
  );
}
