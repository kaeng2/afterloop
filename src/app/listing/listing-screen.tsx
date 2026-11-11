'use client';
/**
 * /listing 화면 (T087, Scene 3). 상태는 `model.ts`의 reducer, 진행은 `progress.ts`(config/motion.json 속도로 타이머마다 step),
 * 그림은 `listing-view.tsx`. 엔진은 브라우저에서 돈다 (같은 함수가 `POST /api/listing-check`에도 열려 있다).
 *
 * - AI 고칠 문구: Publish 때 서버 액션을 **한 번** 부른다 (상품명 + 그때 설명). 같은 상품명·설명이면 다시 부르지 않는다.
 * - Today 읽기·PayPal 조회 없음. 언어는 T081 공용 값(루트 layout이 쿠키·?lang에서 읽어 내려 준다).
 */
import { useEffect, useMemo, useReducer } from 'react';

import { useLocale } from '../_shared/locale-context';
import type { ListingFixDrafts, ListingFixKey } from '@/types';

import { draftListingFixesAction } from './actions';
import { ListingScreenView, type ListingHandlers } from './listing-view';
import { buildView, draftsKey, initialState, makeReducer, needsDrafts, type FormKey } from './model';
import { browserTimer, paceFor, runListingCheck, type TimerApi } from './progress';

import './listing.css';

type DraftFn = (input: { productTitle: string; productDescription: string }) => Promise<ListingFixDrafts | null>;

export function ListingScreen({ draftFixes = draftListingFixesAction, timer = browserTimer }: { draftFixes?: DraftFn; timer?: TimerApi }) {
  const locale = useLocale();
  const reducer = useMemo(() => makeReducer(locale), [locale]);
  const [state, dispatch] = useReducer(reducer, locale, initialState);

  const run = state.run;
  const runId = run?.id ?? null;
  useEffect(() => {
    if (run === null) return;
    const id = run.id;
    return runListingCheck(
      run.input,
      {
        onProgress: (done, total) => dispatch({ type: 'progress', id, done, total }),
        onDone: (calc) => dispatch({ type: 'finished', id, calc }),
      },
      timer,
      paceFor(run.purpose),
    );
    // 계산은 run이 새로 생길 때(id)만 시작한다 — 진행 숫자가 바뀔 때마다 다시 시작하지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, timer]);

  const handlers: ListingHandlers = {
    edit: (key: FormKey, value: string) => dispatch({ type: 'edit', key, value }),
    publish: () => {
      if (needsDrafts(state)) {
        const key = draftsKey(state.form);
        dispatch({ type: 'draftsLoading', key });
        draftFixes({ productTitle: state.form.title, productDescription: state.form.desc })
          .then((drafts) => dispatch({ type: 'drafts', key, drafts }))
          .catch(() => dispatch({ type: 'drafts', key, drafts: null }));
      }
      dispatch({ type: 'publish' });
    },
    toDetail: () => dispatch({ type: 'toDetail' }),
    publishAnyway: () => dispatch({ type: 'publishAnyway' }),
    recalc: () => dispatch({ type: 'recalc' }),
    publishFinal: () => dispatch({ type: 'publishFinal' }),
    backEdit: () => dispatch({ type: 'backEdit' }),
    restart: () => dispatch({ type: 'restart' }),
    insert: (fix: ListingFixKey) => dispatch({ type: 'insert', fix }),
  };

  return <ListingScreenView view={buildView(state, locale)} handlers={handlers} />;
}
