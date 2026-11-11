/**
 * 대화 (T061 4번). 말풍선. **구매자 원문이 기본**(큰 글자), 그 아래 영어 번역을 작게 + 출처 배지.
 * 날짜 순서 사이에 배송사 줄 한 줄("Oct 30 · Carrier: …" + Demo data)을 끼운다 — 따로 있던 배송사 카드를 대신한다.
 *
 * - 실제 글: "From PayPal" 표시 (배지 없음). 시연용 글(시드 문의): 'Demo data' 배지.
 * - 영어: AI 번역이면 'AI suggests', 시드 번역이면 'Demo data'. 영어가 없는 글은 원문만 두고, 구매자 언어가
 *   영어가 아니면 "English translation unavailable"을 보인다 (번역을 지어내지 않는다).
 * - 카드사 언급은 엔진 신호가 참일 때만 `<mark>`로 보인다 (`../model.ts`).
 * - 날짜가 있는 글·배송사 줄은 날짜 순, 날짜를 모르는 실제 분쟁 글은 맨 뒤 (받은 순서 그대로).
 *
 * 토글이 없어 서버 컴포넌트다. 받은 값은 이미 가려진 글이다.
 */
import type { FactLocale } from '@/ai/tokens';
import type { EscalationSignals } from '@/types';

import { Badge } from '../../_shared/badges';
import { t } from '../../_shared/copy';
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

/** 말풍선 아래 "AI read" 태그 줄 (있는 판정만, `readTags`). 태그가 없으면 그리지 않는다. */
function ReadTags({ tags }: { tags: ReadTag[] }) {
  if (tags.length === 0) return null;
  const byAi = tags.some((tag) => tag.by === 'ai');
  const byCode = tags.some((tag) => tag.by === 'code');
  return (
    <div className="case-read">
      <span className="case-read-label">{t('case.read.label')}</span>
      {tags.map((tag) => (
        <span key={tag.key} className={tag.tone === 'bad' ? 'desk-chip desk-chip-bad' : 'desk-chip'}>
          {t(tag.key)}
        </span>
      ))}
      {byCode ? <Badge kind="codeDecides" /> : null}
      {byAi ? <Badge kind="aiSuggests" /> : null}
    </div>
  );
}

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
  // 같은 배지는 한 번만 (시연용 문의는 글 자체도, 시드 번역도 'Demo data'라 두 번 붙던 문제)
  const englishOnly = message.englishBadges.filter((kind) => !message.badges.includes(kind));
  // 꼬리("Dispute message · From PayPal" / 날짜 + Demo data)는 따로 줄을 두지 않고 마지막 줄 끝에 붙인다 (T068 재시도 1번)
  const meta = (
    <span className="case-bubble-meta">
      <span className="num">{message.date === null ? t('case.view.dateUnknown') : shortDate(message.date)}</span>
      {message.sourceKey === null ? null : <span className="case-source">{t(message.sourceKey)}</span>}
      {message.badges.map((kind) => (
        <Badge key={kind} kind={kind} />
      ))}
    </span>
  );
  // 원문이 영어면(또는 번역이 원문과 같으면) 번역 줄을 두지 않는다 — 같은 글이 두 번 나오지 않게 (T068 재시도 2번)
  const noEnglishLine = message.english === null && (locale === 'en' || message.originalIsEnglish);
  return (
    <li className={message.source === 'demo' ? 'case-bubble case-bubble-demo' : 'case-bubble'}>
      <p className="case-bubble-original" lang={message.originalIsEnglish ? 'en' : (locale ?? undefined)}>
        <Segments segments={message.original} markTitle={markTitle} />
      </p>
      {noEnglishLine ? (
        <p className="case-bubble-en">{meta}</p>
      ) : message.english === null ? (
        <p className="case-bubble-en">
          <span>{t('case.view.englishUnavailable')}</span>
          {meta}
        </p>
      ) : (
        <p className="case-bubble-en" lang="en">
          <Segments segments={message.english} markTitle={markTitle} />
          {englishOnly.map((kind) => (
            <Badge key={`en-${kind}`} kind={kind} />
          ))}
          {meta}
        </p>
      )}
      <ReadTags tags={tags} />
    </li>
  );
}

const hasMark = (message: CaseMessageView): boolean =>
  [...message.original, ...(message.english ?? [])].some((segment) => segment.mark);

export function Conversation({
  messages,
  carrierLine,
  locale,
  signals = null,
  languageKey = null,
}: {
  messages: CaseMessageView[];
  carrierLine: CarrierLineView | null;
  locale: FactLocale | null;
  /** 엔진 신호 (T076 "AI read" 태그 — 있는 판정만). 없으면 태그 없음. */
  signals?: EscalationSignals | null;
  /** 구매자 언어 키 (제목 옆 "Original, in Korean"). */
  languageKey?: string | null;
}) {
  const markTitle = t('case.view.cardCompanyMark');
  const entries = timeline(messages, carrierLine);
  const lastReal = [...messages].reverse().find((message) => message.source === 'paypal') ?? null;

  return (
    <section className="case-conversation" aria-labelledby="case-conversation">
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
