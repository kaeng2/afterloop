/**
 * 글 조각 그리기 (T009 1부). `mark`가 참인 조각(카드사 언급)만 `<mark>`로 눈에 띄게 그린다.
 * 어느 조각을 표시할지는 `../model.ts`가 엔진 신호와 낱말 목록으로 정했다 — 여기서는 그리기만 한다.
 */
import type { TextSegment } from '../model';

export function Segments({ segments, markTitle }: { segments: TextSegment[]; markTitle: string }) {
  return (
    <>
      {segments.map((segment, index) =>
        segment.mark ? (
          <mark key={index} className="case-mark" title={markTitle}>
            {segment.text}
          </mark>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  );
}
