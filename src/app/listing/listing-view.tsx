/**
 * /listing 그림 (T087, 시안 docs/design/mockup-v4/scene3/Main.dc.html의 배치·간격·카드 모양).
 * 상태를 바꾸지 않고 `buildView` 값만 그린다 (시험이 정적 렌더로 본다). 손잡이는 `handlers`로 받는다.
 *
 * - 쇼핑몰 껍데기(왼쪽 메뉴·검색창·가게 이름)는 고정 데모 — 버튼은 `aria-disabled`, 핸들러 없음.
 * - 숫자 옆 "≈ Assumption", 고칠 문구 옆 "AI suggests". 색은 listing.css 변수(우리 강조색)만.
 */
import { AiSuggestsBadge, AssumptionBadge } from '../_shared/badges';
import type { FieldView, FormKey, ListingView } from './model';
import { TYPE_TONE } from './model';
import type { ListingDisputeType, ListingFixKey } from '@/types';

export type ListingHandlers = {
  edit: (key: FormKey, value: string) => void;
  publish: () => void;
  toDetail: () => void;
  publishAnyway: () => void;
  recalc: () => void;
  publishFinal: () => void;
  backEdit: () => void;
  restart: () => void;
  insert: (fix: ListingFixKey) => void;
};

const NOOP: ListingHandlers = {
  edit: () => {},
  publish: () => {},
  toDetail: () => {},
  publishAnyway: () => {},
  recalc: () => {},
  publishFinal: () => {},
  backEdit: () => {},
  restart: () => {},
  insert: () => {},
};

function Mark({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="30 70 200 110" aria-hidden="true">
      <path d="M92 112H146C176 112 192 126 206 158" className="ls-mark-line" strokeWidth="30" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="56" cy="112" r="16" className="ls-mark-dot" />
    </svg>
  );
}

function AiChip({ small = false }: { small?: boolean }) {
  return <span className={small ? 'ls-ai ls-ai-sm' : 'ls-ai'}>AI</span>;
}

function ApiPill({ v }: { v: ListingView }) {
  return (
    <span className="ls-apib" title={v.c.apiBy}>
      <span className="ls-apib-ic">
        <Mark />
      </span>
      <b>{v.c.apiName}</b>
      <span className="ls-livedot" aria-hidden="true" />
      <span>{v.c.apiOn}</span>
    </span>
  );
}

function Dots({ dots, size }: { dots: (ListingDisputeType | null)[]; size: 'sm' | 'md' }) {
  return (
    <div className={`ls-dots ls-dots-${size}`} aria-hidden="true">
      {dots.map((k, i) => (
        <span key={i} className={k === null ? 'ls-dot' : `ls-dot ${TYPE_TONE[k]}`} />
      ))}
    </div>
  );
}

/** `[__]` 자리표시자를 눈에 띄게 */
function Blanks({ text }: { text: string }) {
  const parts = text.split(/(\[__\])/);
  return (
    <>
      {parts.map((p, i) =>
        p === '[__]' ? (
          <mark key={i} className="ls-blank">
            [__]
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

function Field({ f, h, v }: { f: FieldView; h: ListingHandlers; v: ListingView }) {
  const gap = f.missing.length > 0;
  return (
    <div className={f.flash === null ? 'ls-field' : `ls-field ${f.flash % 2 ? 'ls-flA' : 'ls-flB'}`} data-field={f.key}>
      <label htmlFor={f.id} className="ls-lab ls-lab-row">
        {f.label}
        {gap ? (
          <span className="ls-chip ls-chip-gap" data-missing={f.missing.map((m) => m.fix).join(' ')}>
            {v.c.gap}: {f.missing.map((m) => m.label).join(' · ')}
          </span>
        ) : null}
      </label>
      <textarea
        id={f.id}
        className={gap ? 'ls-fld ls-fld-gap' : 'ls-fld'}
        rows={f.rows}
        value={f.value}
        onChange={(e) => h.edit(f.key, e.target.value)}
      />
      {f.inserts.length > 0 ? (
        <div className="ls-ins-row">
          {f.inserts.map((i) => (
            <button key={i.fix} type="button" className="ls-ins" disabled={i.done} data-insert={i.fix} onClick={() => h.insert(i.fix)}>
              <AiChip small />
              {i.done ? `${i.label} · ${v.c.inserted}` : `${v.c.insert}: ${i.label}`}
            </button>
          ))}
        </div>
      ) : null}
      {f.inserted.map((x) => (
        <div key={x.fix} className="ls-inserted" data-inserted={x.fix}>
          <AiSuggestsBadge />
          <p className="ls-inserted-text" lang="en">
            <Blanks text={x.text} />
          </p>
        </div>
      ))}
    </div>
  );
}

function Shell({ v, children }: { v: ListingView; children: React.ReactNode }) {
  const n = v.c.nav;
  return (
    <div className="ls" lang={v.locale}>
      <div className="ls-band" role="note">
        {v.c.mockBand}
      </div>
      <header className="ls-header">
        <span className="ls-store">
          <span className="ls-store-logo" aria-hidden="true">
            {v.c.storeInitial}
          </span>
          <span className="ls-store-name">
            <b>{v.c.store}</b>
            <span>{v.c.admin}</span>
          </span>
        </span>
        <label className="ls-search">
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input placeholder={v.c.search} aria-label={v.c.search} readOnly />
        </label>
        <span className="ls-avatar" aria-hidden="true">
          {v.c.avatar}
        </span>
      </header>
      <div className="ls-body">
        <nav aria-label={n.label} className="ls-side">
          {(['home', 'orders', 'products', 'customers', 'analytics', 'marketing'] as const).map((k) => (
            <button key={k} type="button" className={k === 'products' ? 'ls-snav on' : 'ls-snav'} aria-disabled="true">
              {n[k]}
            </button>
          ))}
          <span className="ls-side-h">{n.apps}</span>
          <button type="button" className="ls-snav" aria-disabled="true">
            <span className="ls-apib-ic">
              <Mark />
            </span>
            {n.disputeless}
          </button>
          {/* "PayPal payments"는 아이콘 없이 글자만 (T087 규칙 3) */}
          <button type="button" className="ls-snav" aria-disabled="true">
            {n.payments}
          </button>
        </nav>
        <main className="ls-main">
          <div className="ls-crumb">
            <span>{n.products}</span>
            <span aria-hidden="true">›</span>
            <b>{v.c.crumb}</b>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

function Editor({ v, h }: { v: ListingView; h: ListingHandlers }) {
  const c = v.c;
  const isDetail = v.screen === 'detail';
  return (
    <section className="ls-card ls-editor">
      {isDetail ? (
        <div className="ls-head">
          <b>{c.detailT}</b>
          <span>{c.detailS}</span>
        </div>
      ) : null}
      <div className="ls-group">
        <span className="ls-lab">{c.photos}</span>
        <div className="ls-photos">
          {c.photoItems.map((p) => (
            <div key={p.src} className="ls-ph">
              {/* eslint-disable-next-line @next/next/no-img-element -- 고정 데모 사진 4장 (public/listing) */}
              <img src={p.src} alt={p.label} />
              <span className="ls-phl">{p.label}</span>
            </div>
          ))}
          <span className="ls-addph" aria-disabled="true">
            <span className="ls-addic" aria-hidden="true">
              +
            </span>
            <span className="ls-addph-t">{c.addPhoto}</span>
            <span className="ls-addph-h">{c.addHint}</span>
          </span>
        </div>
      </div>
      <div className="ls-grid3">
        <label className="ls-group">
          <span className="ls-lab">{c.fTitle}</span>
          <input className="ls-fld" value={v.form.title} onChange={(e) => h.edit('title', e.target.value)} />
        </label>
        <label className="ls-group">
          <span className="ls-lab">{c.fPrice}</span>
          <input className="ls-fld" value={v.priceText} readOnly />
        </label>
        <label className="ls-group">
          <span className="ls-lab">{c.fUnits}</span>
          <input className="ls-fld" value={v.unitsText} readOnly />
        </label>
      </div>
      <div className="ls-grid-dates">
        <label className="ls-group">
          <span className="ls-lab">{c.fFrom}</span>
          <input type="date" className="ls-fld" value={v.form.from} onChange={(e) => h.edit('from', e.target.value)} />
        </label>
        <label className="ls-group">
          <span className="ls-lab">{c.fTo}</span>
          <input type="date" className="ls-fld" value={v.form.to} onChange={(e) => h.edit('to', e.target.value)} />
        </label>
        <span className={v.peak ? 'ls-peak on' : 'ls-peak'}>{v.datesValid ? (v.peak ? c.peakOn : c.peakOff) : c.datesInvalid}</span>
      </div>
      {v.aiWriting ? (
        <p className="ls-note" role="status">
          <AiChip small /> {c.aiWriting}
        </p>
      ) : null}
      {v.fields.map((f) => (
        <Field key={f.key} f={f} h={h} v={v} />
      ))}
      {v.anyInserted ? (
        <p className="ls-note ls-note-blank" role="note">
          {c.fillBlanks}
        </p>
      ) : null}
      {v.screen === 'edit' || v.screen === 'sheet' ? (
        <div className="ls-actions">
          <ApiPill v={v} />
          <button type="button" className="ls-btn ls-b-tint" aria-disabled="true">
            {c.saveDraft}
          </button>
          <button type="button" className="ls-btn ls-b-black" data-action="publish" disabled={!v.datesValid} onClick={h.publish}>
            {c.publish}
          </button>
        </div>
      ) : null}
    </section>
  );
}

function Panel({ v, h }: { v: ListingView; h: ListingHandlers }) {
  const p = v.panel;
  if (p === null) return null;
  const c = v.c;
  return (
    <aside className="ls-panel" aria-label={c.panelT}>
      <div className="ls-panel-h">
        <AiChip />
        <div>
          <b>{c.panelT}</b>
          <span>
            {c.panelS} · {p.basisLine}
          </span>
          <span className="ls-panel-data">
            {p.dataLine} <AssumptionBadge source={p.dataLine} />
          </span>
        </div>
      </div>
      <section className="ls-card ls-card-tight">
        <div className="ls-panel-top">
          <div className="ls-group-tight">
            <span className="ls-lab">{c.probL}</span>
            <div className="ls-big-row">
              <span className={p.improved ? 'ls-big good' : 'ls-big'} data-value="prob">
                {p.prob}
              </span>
              <AssumptionBadge />
            </div>
            <span className="ls-sub">
              {p.probSub} · {p.before}
            </span>
          </div>
          <div className="ls-tipw">
            <span className="ls-tip-l">
              {c.lossL}
              <button type="button" className="ls-tipq" aria-label={c.lossHow}>
                i
              </button>
            </span>
            <b className="ls-loss" data-value="loss">
              {p.loss} <AssumptionBadge />
            </b>
            <span className="ls-sub">{p.lossRange}</span>
            <span className="ls-tipb" role="tooltip">
              {p.lossTip}
            </span>
          </div>
        </div>
        <div className="ls-group-tight">
          <Dots dots={p.dots} size="sm" />
          <span className="ls-tiny">{p.dotsL}</span>
        </div>
        <div className="ls-types">
          <b>
            {c.typesT} <AssumptionBadge />
          </b>
          {p.types.map((t) => (
            <div key={t.k} className="ls-type-row" data-type={t.k}>
              <span className={`ls-sw ${TYPE_TONE[t.k]}`} aria-hidden="true" />
              <span className="ls-ellipsis">{t.name}</span>
              <div className="ls-bar">
                <div className="ls-bar-ghost" style={{ width: `${(t.ghost * 100).toFixed(1)}%` }} />
                <div className={t.down ? `ls-bar-fill down` : `ls-bar-fill ${TYPE_TONE[t.k]}`} style={{ width: `${(t.bar * 100).toFixed(1)}%` }} />
              </div>
              <b className="ls-num">{t.pct}</b>
            </div>
          ))}
        </div>
        <div className={p.dirty ? 'ls-status dirty' : 'ls-status'}>
          <span role="status">{p.status}</span>
          <button type="button" className="ls-btn ls-b-ai ls-b-sm" data-action="recalc" disabled={p.recalcDisabled} onClick={h.recalc}>
            {p.recalcLabel}
          </button>
        </div>
        {p.running ? (
          <div className="ls-prog" aria-hidden="true">
            <div className="ls-prog-fill" style={{ width: `${(p.progress * 100).toFixed(1)}%` }} />
          </div>
        ) : null}
      </section>
      <section className="ls-card ls-card-tight ls-checks">
        <b>{c.reduceT}</b>
        {p.checks.map((x) => (
          <div key={x.k} className="ls-check" data-check={x.k}>
            <span className={x.on ? 'ls-check-ic on' : 'ls-check-ic'} aria-hidden="true">
              {x.on ? '✓' : '○'}
            </span>
            <span className="ls-grow">{x.t}</span>
            <b className={x.on ? 'ls-check-s on' : 'ls-check-s'}>{x.s}</b>
            {x.on ? null : <AssumptionBadge />}
          </div>
        ))}
        <div className="ls-actions ls-actions-split">
          <ApiPill v={v} />
          <button type="button" className="ls-btn ls-b-black" data-action="publishFinal" disabled={p.running} onClick={h.publishFinal}>
            {c.publishNow}
          </button>
        </div>
      </section>
    </aside>
  );
}

function Sheet({ v, h }: { v: ListingView; h: ListingHandlers }) {
  const s = v.sheet;
  if (s === null) return null;
  const c = v.c;
  return (
    <>
      <div className="ls-scrim" aria-hidden="true" />
      <div className="ls-sheet" role="dialog" aria-modal="true" aria-label={c.sheetKicker}>
        <span className="ls-grab" aria-hidden="true" />
        <div className="ls-kicker">
          <AiChip />
          <span>{c.sheetKicker}</span>
        </div>
        {s.kind === 'running' ? (
          <>
            <div className="ls-an">
              <div className="ls-spin-wrap" aria-hidden="true">
                <svg className="ls-spin" width="96" height="96" viewBox="0 0 96 96">
                  <circle cx="48" cy="48" r="40" className="ls-spin-track" strokeWidth="8" />
                  <path d="M48 8a40 40 0 0 1 40 40" className="ls-spin-arc" strokeWidth="8" strokeLinecap="round" />
                </svg>
              </div>
              <div className="ls-group-tight">
                <b className="ls-an-t">{c.anT}</b>
                <span className="ls-sub">{s.anS}</span>
                <ol className="ls-steps">
                  {s.steps.map((st, i) => (
                    <li key={i} className={`ls-step ${st.mark}`}>
                      {st.mark === 'done' ? '✓' : st.mark === 'now' ? '●' : '○'} {st.text}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
            <div className="ls-run">
              <div className="ls-cells" aria-hidden="true">
                {s.cells.map((on, i) => (
                  <span key={i} className={on ? 'ls-cell on' : 'ls-cell'} />
                ))}
              </div>
              <div
                className="ls-prog"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={s.total}
                aria-valuenow={s.done}
                aria-label={s.runTxt}
              >
                <div className="ls-prog-fill" style={{ width: `${((s.done / s.total) * 100).toFixed(1)}%` }} />
              </div>
              <span className="ls-tiny" data-progress={`${s.done}/${s.total}`} aria-live="polite">
                {s.runTxt}
              </span>
            </div>
          </>
        ) : (
          <div className="ls-rise ls-result">
            <b className="ls-res-t">{c.resT}</b>
            <div className="ls-basis" aria-label={c.basisT}>
              {s.basis.map((b) => (
                <div key={b.k} className="ls-basis-cell">
                  <span className="ls-basis-k">{b.k}</span>
                  <b>{b.v}</b>
                  {b.chip ? <span className="ls-chip ls-chip-peak">{b.chip}</span> : null}
                  {'assumption' in b && b.assumption ? <AssumptionBadge source={b.v} /> : null}
                </div>
              ))}
            </div>
            <div className="ls-hero">
              <div className="ls-group-tight">
                <span className="ls-lab">{c.probL}</span>
                <span className="ls-hero-n" data-value="prob">
                  {s.prob}
                </span>
                <span className="ls-sub">
                  {s.probSub} <AssumptionBadge />
                </span>
              </div>
              <div className="ls-group-tight">
                <Dots dots={s.dots} size="md" />
                <div className="ls-legend">
                  {s.legend.map((l) => (
                    <span key={l.k}>
                      <span className={`ls-sw ${TYPE_TONE[l.k]}`} aria-hidden="true" />
                      {l.name} <b>{l.pct}</b>
                    </span>
                  ))}
                </div>
                <span className="ls-tiny">{s.dotsL}</span>
              </div>
            </div>
            <div className="ls-group-tight">
              <span className="ls-lab">
                {c.topT2} <AssumptionBadge />
              </span>
              <div className="ls-top">
                {s.top.map((t) => (
                  <div key={t.k} className="ls-top-card" data-type={t.k}>
                    <div className="ls-top-h">
                      <span className={`ls-rank ${TYPE_TONE[t.k]}`}>{t.rank}</span>
                      <b>{t.name}</b>
                    </div>
                    <div className="ls-top-n">
                      <b>{t.pct}</b>
                      <span className="ls-tiny">{t.of}</span>
                    </div>
                    <span className="ls-sub">{t.why}</span>
                  </div>
                ))}
              </div>
            </div>
            {s.peak ? (
              <div className="ls-bf" role="note">
                <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M3 7h11v9H3zM14 10h4l3 3v3h-7zM7 19a2 2 0 1 0 0-.01M17 19a2 2 0 1 0 0-.01"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                </svg>
                <div className="ls-group-tight">
                  <b>{c.bfT}</b>
                  <span className="ls-sub">{c.bfB}</span>
                </div>
              </div>
            ) : null}
            <div className="ls-split">
              <div className="ls-group-tight">
                <span className="ls-lab">{c.fixT}</span>
                {s.fixes.map((x) => (
                  <div key={x.k} className="ls-fix" data-fix={x.k}>
                    <span className="ls-fix-plus" aria-hidden="true">
                      +
                    </span>
                    <span className="ls-grow">{x.t}</span>
                    <b className="ls-fix-s">{x.s}</b>
                    <AssumptionBadge />
                  </div>
                ))}
              </div>
              <div className="ls-loss-box">
                <div className="ls-loss-row">
                  <span className="ls-lab">{c.lossL}</span>
                  <b className="ls-loss" data-value="loss">
                    {s.loss} <AssumptionBadge />
                  </b>
                </div>
                <span className="ls-sub">{s.lossRange}</span>
                <span className="ls-lab">{c.lossHow}</span>
                <span className="ls-sub">{s.lossTip}</span>
              </div>
            </div>
            <div className="ls-actions">
              <button type="button" className="ls-btn ls-b-tint" data-action="publishAnyway" onClick={h.publishAnyway}>
                {c.publishAnyway}
              </button>
              <button type="button" className="ls-btn ls-b-ai" data-action="toDetail" onClick={h.toDetail}>
                {c.seeDetail} →
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function Done({ v, h }: { v: ListingView; h: ListingHandlers }) {
  const d = v.done;
  if (d === null) return null;
  return (
    <div className="ls-done-wrap">
      <section className="ls-card ls-rise ls-done">
        <span className="ls-done-ic" aria-hidden="true">
          ✓
        </span>
        <b className="ls-done-t">{v.c.doneT}</b>
        <span className="ls-sub">{d.title}</span>
        <div className="ls-done-box">
          <b className={d.improved ? 'ls-done-prob good' : 'ls-done-prob'} data-value="doneProb">
            {d.prob} <AssumptionBadge />
          </b>
          <span className="ls-sub" data-value="doneLoss">
            {d.loss} · {d.disp}
          </span>
        </div>
        <span className="ls-tiny">{d.note}</span>
        <div className="ls-done-actions">
          <button type="button" className="ls-btn ls-b-tint" data-action="backEdit" onClick={h.backEdit}>
            {v.c.backEdit}
          </button>
          <button type="button" className="ls-btn ls-b-black" data-action="restart" onClick={h.restart}>
            {v.c.restart}
          </button>
        </div>
      </section>
    </div>
  );
}

export function ListingScreenView({ view, handlers = NOOP }: { view: ListingView; handlers?: ListingHandlers }) {
  const showEditor = view.screen !== 'done';
  return (
    <Shell v={view}>
      {showEditor ? (
        <div className={view.screen === 'detail' ? 'ls-layout ls-layout-detail' : 'ls-layout'}>
          <Editor v={view} h={handlers} />
          <Panel v={view} h={handlers} />
        </div>
      ) : null}
      <Sheet v={view} h={handlers} />
      <Done v={view} h={handlers} />
    </Shell>
  );
}
