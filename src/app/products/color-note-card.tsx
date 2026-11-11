'use client';

/**
 * AI 색상 문구 자리 (T062, T020). [Write the note]를 누르면 서버 액션만 부른다.
 * 한국어 한 줄을 크게, 나머지 언어(+역번역)는 접기. AI가 실패하면 **이 자리 전체를 숨긴다** (기본 문구 없음).
 * 문구 글자는 AI 결과를 그대로 보인다 ('AI suggests').
 */
import { useState, useTransition } from 'react';

import { AiSuggestsBadge } from '../_shared/badges';
import { t } from '../_shared/copy';
import type { ColorNoteView } from './model';

export function ColorNoteResult({ note }: { note: ColorNoteView }) {
  return (
    <div className="color-note" data-color-note="shown">
      <div className="row">
        <AiSuggestsBadge />
      </div>
      <p className="color-note-ko" lang="ko">
        {note.ko.text}
      </p>
      <details className="color-note-more">
        <summary className="small">{t('product.colorNote.more')}</summary>
        <ul className="small stack">
          {note.others.map((line) => (
            <li key={line.locale} lang={line.locale}>
              <span className="label">{line.label}</span> {line.text}
              {line.backTranslation === null ? null : (
                <span className="muted">
                  {' '}
                  · {t('product.colorNote.back')}: {line.backTranslation}
                </span>
              )}
            </li>
          ))}
          {note.ko.backTranslation === null ? null : (
            <li className="muted">
              <span className="label">{note.ko.label}</span> {t('product.colorNote.back')}: {note.ko.backTranslation}
            </li>
          )}
        </ul>
      </details>
    </div>
  );
}

type State = { kind: 'idle' } | { kind: 'shown'; note: ColorNoteView } | { kind: 'hidden' };

export function ColorNoteSlot({
  sku,
  write,
  initial = null,
}: {
  sku: string;
  write: (sku: string) => Promise<ColorNoteView | null>;
  /** 테스트·견본용 처음 결과 */
  initial?: ColorNoteView | null;
}) {
  const [state, setState] = useState<State>(initial === null ? { kind: 'idle' } : { kind: 'shown', note: initial });
  const [pending, startTransition] = useTransition();

  if (state.kind === 'hidden') return null;
  if (state.kind === 'shown') return <ColorNoteResult note={state.note} />;

  const onClick = () => {
    startTransition(async () => {
      try {
        const note = await write(sku);
        setState(note === null ? { kind: 'hidden' } : { kind: 'shown', note });
      } catch {
        setState({ kind: 'hidden' });
      }
    });
  };

  return (
    <button type="button" className="color-note-button" onClick={onClick} disabled={pending}>
      {pending ? t('product.colorNote.writing') : t('product.colorNote.write')}
    </button>
  );
}
