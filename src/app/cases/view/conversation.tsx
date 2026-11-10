'use client';

/**
 * 대화 (T009 1부 2번). 구매자 글 원문 ↔ 영어 토글.
 *
 * - 실제 글: "From PayPal" 표시 (배지 없음). 시연용 글(시드 문의): 'Demo data' 배지.
 * - 영어: AI 번역이면 'AI suggests', 시드 번역이면 'Demo data'. 영어가 없는 글은 원문 그대로 두고
 *   "English translation unavailable"을 보인다 (번역을 지어내지 않는다).
 * - 카드사 언급은 엔진 신호가 참일 때만 `<mark>`로 보인다 (`../model.ts`).
 *
 * 토글 때문에 클라이언트 컴포넌트다. 서버 전용 코드를 import하지 않는다. 받은 값은 이미 가려진 글이다.
 */
import { useState } from 'react';

import { Badge } from '../../_shared/badges';
import { t } from '../../_shared/copy';
import type { CaseMessageView } from '../model';
import { Segments } from './segments';

export function Conversation({ messages }: { messages: CaseMessageView[] }) {
  const hasEnglish = messages.some((message) => message.english !== null);
  const [english, setEnglish] = useState(hasEnglish);
  const markTitle = t('case.view.cardCompanyMark');

  return (
    <section className="card stack" aria-labelledby="case-conversation">
      <div className="case-card-head">
        <h2 className="section-title" id="case-conversation">
          {t('case.view.conversation')}
        </h2>
        {hasEnglish ? (
          <button
            type="button"
            className="case-toggle"
            aria-pressed={english}
            onClick={() => setEnglish((value) => !value)}
          >
            {english ? t('case.view.showOriginal') : t('case.view.showEnglish')}
          </button>
        ) : null}
      </div>

      {messages.length === 0 ? <p className="small muted">{t('case.view.noMessages')}</p> : null}

      <ol className="case-messages">
        {messages.map((message, index) => {
          const showEnglish = english && message.english !== null;
          return (
            <li key={index} className={message.source === 'demo' ? 'case-message case-message-demo' : 'case-message'}>
              <div className="row small">
                <span className="muted num">{message.date ?? t('case.view.dateUnknown')}</span>
                {message.sourceKey === null ? null : <span className="case-source">{t(message.sourceKey)}</span>}
                {message.badges.map((kind) => (
                  <Badge key={kind} kind={kind} />
                ))}
                {showEnglish
                  ? message.englishBadges.map((kind) => <Badge key={`en-${kind}`} kind={kind} />)
                  : null}
              </div>
              <p className="case-message-text" lang={showEnglish ? 'en' : undefined}>
                <Segments segments={showEnglish ? (message.english ?? []) : message.original} markTitle={markTitle} />
              </p>
              {english && message.english === null ? (
                <p className="small muted">{t('case.view.englishUnavailable')}</p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
