/**
 * 한 장 카드 (T122c, 시안 v6 `Desk.dc.html` L443–L478 `isOther` 블록, 차이 목록 V6-B45 ~ V6-B52).
 *
 *   [구매자 대화 `.zone-buyer`]  ← `message`가 있을 때만 (V6-B45)
 *   `.zone-work`
 *     윗줄: AI 알약 · 제목 20px · 설명 15px | "Keeps ≈$N" 알약 (V6-B46)
 *     "How AI handled this" + 번호 원 단계 (V6-B47)
 *     표 (`rows`, 추적 주문 같은 것) (V6-B48)
 *     "What the buyer will receive (L)" 상자 (+ Translated 줄) (V6-B49)
 *     (`children`: 알림·확인 상자·결과 줄 — 관문 쪽이 넘긴다)
 *     "On approval" + 호출 이름 | 버튼 (V6-B50 · V6-B51)
 *
 * **그리기만 한다.** 글·숫자·호출 이름·버튼은 모두 부르는 쪽이 넘긴다 (엔진·데이터·문구에서 만든 값).
 * 읽기·쓰기·계산 없음, 훅 없음 (서버·브라우저 어느 쪽에서도 그린다).
 *
 * T118 교훈: 자리마다 순서가 고정이다 — 없는 칸은 `null`로 비우고 다른 칸이 자리를 바꾸지 않는다.
 */
import type { ReactNode } from 'react';

import { AiPill } from '../_shared/badges';
import { t } from '../_shared/copy';

/** "AI read" 태그 하나. `bad` = 시안 `tone: 'bad'`의 첫 칩(`c-bad`). */
export type OneCardTag = { text: string; bad?: boolean };

export type OneCardMessage = {
  /** 언어 이름 ("Korean"). 모르면 `null`. */
  languageName: string | null;
  /** `lang` 속성 (`ko` …). 모르면 `null`. */
  code: string | null;
  original: string;
  /** 번역. 없거나 화면 언어와 같은 글이면 `null` (Translated 줄 없음). */
  translated: string | null;
  tags: OneCardTag[];
  /** 출처 배지 (Demo data 등). */
  badge?: ReactNode;
};

export type OneCardDraft = {
  /** "What the buyer will receive (Korean)" / "Sent to the buyer (Korean)" — 부르는 쪽이 `sent`에 맞춰 고른 글. */
  title: string;
  code: string | null;
  original: string;
  translated: string | null;
  /** 보낸 뒤(가짜 포함) — 상자가 짙은 남색으로 (시안 `draftSt`). */
  sent: boolean;
  badge?: ReactNode;
};

/** 표. `muted` 줄 = 회색(시안 `.ag-r.dn`, 예: 분쟁이 걸려 빠진 주문) — 같은 열 격자를 쓴다. */
export type OneCardRows = { head: string[]; columns: string; rows: { cells: string[]; muted?: boolean }[] };

export type OneCardApproval = {
  /** "On approval" / "Already sent". */
  label: string;
  /** 호출 이름 (실제 이름만) 또는 "Simulated · not sent". */
  api: string;
};

export type OneCardProps = {
  titleId: string;
  ai?: boolean;
  title: ReactNode;
  body?: ReactNode;
  /** "Keeps ≈$N" (엔진 값 표기). 없으면 알약 없음. */
  keep?: string | null;
  message?: OneCardMessage | null;
  steps: ReactNode[];
  rows?: OneCardRows | null;
  draft?: OneCardDraft | null;
  /** "On approval" 줄. 없으면 줄 전체가 없다 (실행할 것이 없는 카드). */
  approval?: OneCardApproval | null;
  /** 줄 오른쪽 버튼 (+ 전송 모드 표시). */
  action?: ReactNode;
  className?: string;
  /** 관문 알림·확인 상자·결과 줄. 초안 상자와 "On approval" 줄 사이. */
  children?: ReactNode;
};

export function OneCardBuyer({ message }: { message: OneCardMessage }) {
  return (
    <section className="zone-buyer oc-buyer" aria-label={t('card.convT')}>
      <div className="oc-buyer-head">
        <b className="oc-buyer-title">{t('card.convT')}</b>
        {message.languageName === null ? null : <span className="oc-sub">{message.languageName}</span>}
        {message.badge ?? null}
      </div>
      <div className="bub-in oc-bub">
        <div className="oc-bub-orig" lang={message.code ?? undefined}>
          {message.original}
        </div>
        {message.translated === null ? null : (
          <div className="oc-bub-tr">
            <b className="oc-tr-lab">{t('card.tr')}</b> · {message.translated}
          </div>
        )}
      </div>
      {message.tags.length === 0 ? null : (
        <div className="oc-tags">
          <span className="oc-airead">{t('card.aiRead')}</span>
          {message.tags.map((tag, index) => (
            <span key={`${index}-${tag.text}`} className={`chip ${index === 0 && tag.bad ? 'c-bad' : 'c-n'}`}>
              {tag.text}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

export function OneCard({
  titleId,
  ai = true,
  title,
  body = null,
  keep = null,
  message = null,
  steps,
  rows = null,
  draft = null,
  approval = null,
  action = null,
  className,
  children,
}: OneCardProps) {
  return (
    <>
      {message === null ? null : <OneCardBuyer message={message} />}
      <section className={className === undefined ? 'zone-work oc' : `zone-work oc ${className}`} aria-labelledby={titleId}>
        <div className="oc-top">
          <div className="oc-top-text">
            {ai ? <AiPill /> : null}
            <h3 className="oc-title num" id={titleId}>
              {title}
            </h3>
            {body === null ? null : <div className="oc-body">{body}</div>}
          </div>
          {keep === null ? null : <span className="oc-keep num">{keep}</span>}
        </div>

        {steps.length === 0 ? null : (
          <div className="oc-steps">
            <div className="oc-steps-head">
              <b className="oc-steps-title">{t('card.aiT')}</b>
              <span className="oc-sub">{t('card.aiS')}</span>
            </div>
            <ol className="oc-step-list">
              {steps.map((step, index) => (
                <li key={index} className="oc-step">
                  <span className="oc-step-n" aria-hidden="true">
                    {index + 1}
                  </span>
                  <span className="oc-step-t">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {rows === null ? null : (
          <div className="oc-ag" role="grid">
            <div className="oc-ag-h" role="row" style={{ gridTemplateColumns: rows.columns }}>
              {rows.head.map((head) => (
                <span key={head} className="oc-ag-hc" role="columnheader">
                  {head}
                </span>
              ))}
            </div>
            {rows.rows.map((row, index) => (
              <div
                key={`${index}-${row.cells[0] ?? ''}`}
                className={row.muted === true ? 'oc-ag-r oc-ag-r-dn' : 'oc-ag-r'}
                role="row"
                style={{ gridTemplateColumns: rows.columns }}
              >
                {row.cells.map((cell, cellIndex) => (
                  <span key={cellIndex} className="oc-ag-c num" role="gridcell">
                    {cell}
                  </span>
                ))}
              </div>
            ))}
          </div>
        )}

        {draft === null ? null : (
          <div className="oc-draft">
            <b className="oc-draft-title">
              {draft.title}
              {draft.badge === undefined ? null : <> {draft.badge}</>}
            </b>
            <div className={draft.sent ? 'oc-draft-box oc-draft-box-sent' : 'oc-draft-box'}>
              <div className="oc-draft-orig" lang={draft.code ?? undefined}>
                {draft.original}
              </div>
              {draft.translated === null ? null : (
                <div className="oc-draft-tr">
                  <b className="oc-draft-tr-lab">{t('card.tr')}</b> · {draft.translated}
                </div>
              )}
            </div>
          </div>
        )}

        {children}

        {approval === null ? null : (
          <div className="oc-approve">
            <span className="oc-approve-lab">
              <b>{approval.label}</b>
              <code className="oc-api">{approval.api}</code>
            </span>
            <span className="oc-approve-act">{action}</span>
          </div>
        )}
      </section>
    </>
  );
}

/** 화면 언어와 같은 글이면 Translated 줄을 두지 않는다 (시안 ko 사전: 원문이 한국어면 `tr: ''`). */
export function translatedFor(
  translated: string | null | undefined,
  originalCode: string | null,
  uiLocale: 'en' | 'ko',
): string | null {
  if (translated === null || translated === undefined || translated.trim() === '') return null;
  if (originalCode !== null && originalCode.toLowerCase().startsWith(uiLocale)) return null;
  return translated;
}
