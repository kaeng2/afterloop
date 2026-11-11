'use client';

/**
 * 1 Pick a way to resolve — 엔진 수별 카드 (T076 → T090 모양 → T091 누르기). 시안 `.npath` 버튼:
 * 누르면 그 수로 바뀌고(`aria-pressed`) 답장 칸이 그 수의 초안을 타이핑하듯 넣는다 → 위험 %·곡선 끝점·반응 막대·칩이
 * 엔진 값으로 다시 나온다 (답장 칸의 예측 어댑터). 타이핑 중에는 카드가 꺼진다 (시안 `disabled={{busy}}`).
 *
 * - 막힌 수(엔진 `blockedBy`, 예: 서연의 부분 환불)는 회색 + 이유, **누를 수 없다** (`aria-disabled="true"`, 눌러도 아무 일 없음).
 * - 환불 카드를 고르면 "Refund done · Simulated" 꼬리표 (실제 환불 없음 — PayPal을 부르지 않는다).
 * - 숫자는 `ChoiceView`(엔진 `recommend`·`forecastMoves` 값) 그대로. 고르기의 처음 값은 엔진 최선 수.
 */
import { Badge } from '../../_shared/badges';
import { useT } from '../../_shared/locale-context';
import type { ChoiceView } from '../desk-model';
import { useDeskSelection } from './desk-selection';

export function ChoiceCards({ choices }: { choices: ChoiceView[] }) {
  const t = useT();
  const { path, busy, pick } = useDeskSelection();
  if (choices.length === 0) return null;
  return (
    <div className="desk-step">
      <div className="desk-rail" aria-hidden="true">
        <span className="desk-step-num">1</span>
        <span className="desk-rail-line" />
      </div>
      <div className="desk-step-body">
        <div className="desk-step-head">
          <h3 className="desk-step-title">{t('case.choice.title')}</h3>
          <span className="desk-step-sub">{t('case.choice.sub', { count: choices.length })}</span>
          <Badge kind="assumption" />
        </div>
        <ul className="choice-list">
          {choices.map((choice) => {
            // 처음(아직 아무것도 고르지 않음)은 엔진 최선 수가 고른 상태다
            const on = path === null ? choice.best : path === choice.move;
            return (
              <li
                key={choice.move}
                className={['choice', choice.best ? 'choice-best' : '', choice.blocked ? 'choice-blocked' : '']
                  .filter((name) => name !== '')
                  .join(' ')}
                aria-current={choice.best ? 'true' : undefined}
                data-on={on && !choice.blocked ? 'true' : undefined}
              >
                <button
                  type="button"
                  className="choice-button"
                  aria-pressed={choice.blocked ? undefined : on}
                  aria-disabled={choice.blocked ? 'true' : undefined}
                  disabled={!choice.blocked && busy}
                  data-move={choice.move}
                  onClick={choice.blocked ? undefined : () => pick(choice.move)}
                >
                  <span className="choice-top">
                    <span
                      className={on && !choice.blocked ? 'choice-radio choice-radio-on' : 'choice-radio'}
                      aria-hidden="true"
                    />
                    <span className="choice-title">{t(choice.titleKey)}</span>
                    {choice.best ? <span className="choice-best-tag">{t('case.choice.best')}</span> : null}
                  </span>
                  <span className="choice-how">{choice.blockedKey === null ? t(choice.howKey) : t(choice.blockedKey)}</span>
                  {choice.expectedLoss === null ? null : (
                    <span className="choice-numbers num">
                      {choice.chargeback === null ? null : (
                        <>
                          <strong className={`choice-cb choice-cb-${choice.chargebackTone ?? 'low'}`}>
                            {t('case.choice.chargeback', { percent: choice.chargeback })}
                          </strong>
                          {' · '}
                        </>
                      )}
                      {t('case.choice.cost', { amount: choice.expectedLoss.display })}
                    </span>
                  )}
                  {on && choice.move === 'refund' && !choice.blocked ? (
                    <span className="choice-simulated">{t('case.reply.refundDone')}</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
