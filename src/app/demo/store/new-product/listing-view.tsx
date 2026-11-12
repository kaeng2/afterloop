/**
 * /listing 그림 (T087 → T109, 시안 docs/design/mockup-v4/scene3/Main.dc.html).
 * 상태를 바꾸지 않고 `buildView` 값만 그린다 (시험이 정적 렌더로 본다). 손잡이는 `handlers`로 받는다.
 *
 * - T109: 시안 class(btn·b-black·card·fld·lab·chip·ai·ph·addph·ins·sheet·rise·tipw·snav·apib…)를 그대로 쓰고,
 *   시안 인라인 style 값은 listing.css의 `ls-*` class 규칙(주석 = 시안 줄 번호)으로 옮겼다. 이 파일에는 색·그림자 값이 없다.
 * - 쇼핑몰 껍데기(왼쪽 메뉴·검색창·가게 이름)는 고정 데모 — 버튼은 `aria-disabled`, 핸들러 없음.
 * - "Add photo"는 시안처럼 동작한다 (T098a): 고른 사진을 이 브라우저에서만 "Your photo"로 보여 준다. 올리지 않고 계산과 무관.
 * - 숫자 옆 "≈ Assumption", 고칠 문구 옆 "AI suggests" (예외 — 사람 결정 11/12 "Keep as is").
 */
import { AiSuggestsBadge, AssumptionBadge } from '../../../_shared/badges';
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
  /** 시안 onChange addPhoto: 고른 사진을 이 브라우저 안에서만 보여 준다 (올리지 않는다, 계산과 무관) */
  addPhoto: (file: File) => void;
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
  addPhoto: () => {},
};

/** 시안 L73 왼쪽 메뉴 아이콘 (선 그림, currentColor) */
const NAV_ICON: Record<'home' | 'orders' | 'products' | 'customers' | 'analytics' | 'marketing', string> = {
  home: 'M4 11l8-7 8 7v9h-5v-6H9v6H4z',
  orders: 'M5 4h14v16H5zM9 9h6M9 13h6',
  products: 'M4 8l8-4 8 4-8 4zM4 8v8l8 4 8-4V8M12 12v8',
  customers: 'M8 11a3 3 0 1 0 0-.01M2 20c0-3 3-5 6-5s6 2 6 5M16 11a3 3 0 1 0 0-.01M14 15c3 0 6 1.6 6 5',
  analytics: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  marketing: 'M4 10v4l12 5V5zM16 9a3 3 0 0 1 0 6',
};

function Mark({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="30 70 200 110" aria-hidden="true">
      <path d="M92 112H146C176 112 192 126 206 158" className="ls-mark-line" strokeWidth="30" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="56" cy="112" r="16" className="ls-mark-dot" />
    </svg>
  );
}

/** 시안 L43 `.ai` (L111 작은 것은 padding 1px 7px) */
function AiChip({ small = false }: { small?: boolean }) {
  return <span className={small ? 'ai ls-ai-sm' : 'ai'}>AI</span>;
}

/** 시안 L117·L167 `.apib` */
function ApiPill({ v }: { v: ListingView }) {
  return (
    <span className="apib" title={v.c.apiBy}>
      <span className="ls-apib-ic">
        <Mark />
      </span>
      <b>{v.c.apiName}</b>
      <span className="livedot" aria-hidden="true" />
      <span>{v.c.apiOn}</span>
    </span>
  );
}

function Dots({ dots, size }: { dots: (ListingDisputeType | null)[]; size: 'sm' | 'md' }) {
  return (
    <div className={`ls-dots-${size}`} aria-hidden="true">
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

/** 시안 L107–L113 */
function Field({ f, h, v }: { f: FieldView; h: ListingHandlers; v: ListingView }) {
  const gap = f.missing.length > 0;
  return (
    <div className={f.flash === null ? 'ls-field' : `ls-field ${f.flash % 2 ? 'flA' : 'flB'}`} data-field={f.key}>
      <label htmlFor={f.id} className="lab ls-lab-row">
        {f.label}
        {gap ? (
          <span className="chip ls-chip-gap" data-missing={f.missing.map((m) => m.fix).join(' ')}>
            {v.c.gap}: {f.missing.map((m) => m.label).join(' · ')}
          </span>
        ) : null}
      </label>
      <textarea
        id={f.id}
        className={gap ? 'fld gap' : 'fld'}
        rows={f.rows}
        value={f.value}
        onChange={(e) => h.edit(f.key, e.target.value)}
      />
      {f.inserts.length > 0 ? (
        <div className="ls-ins-row">
          {f.inserts.map((i) => (
            <button key={i.fix} type="button" className="ins" disabled={i.done} data-insert={i.fix} onClick={() => h.insert(i.fix)}>
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

/** 시안 L64–L79 */
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
            <button key={k} type="button" className={k === 'products' ? 'snav on' : 'snav'} aria-disabled="true">
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path d={NAV_ICON[k]} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>{n[k]}</span>
            </button>
          ))}
          <span className="ls-side-h">{n.apps}</span>
          <button type="button" className="snav" aria-disabled="true">
            <span className="ls-apib-ic">
              <Mark />
            </span>
            {n.disputeless}
          </button>
          {/* "PayPal payments"는 아이콘 없이 글자만 (T087 규칙 3) */}
          <button type="button" className="snav" aria-disabled="true">
            {n.payments}
          </button>
        </nav>
        <main className="ls-main">
          <div className="ls-crumb">
            <span className="ls-crumb-a">{n.products}</span>
            <span aria-hidden="true">›</span>
            <b>{v.c.crumb}</b>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

/** 시안 L85–L122 */
function Editor({ v, h, userPhotos }: { v: ListingView; h: ListingHandlers; userPhotos: string[] }) {
  const c = v.c;
  const isDetail = v.screen === 'detail';
  return (
    <section className="card ls-editor">
      {isDetail ? (
        <div className="ls-head">
          <b>{c.detailT}</b>
          <span>{c.detailS}</span>
        </div>
      ) : null}
      <div className="ls-photo-block">
        <span className="lab">{c.photos}</span>
        <div className="ls-photos">
          {c.photoItems.map((p) => (
            <div key={p.src} className="ph">
              {/* eslint-disable-next-line @next/next/no-img-element -- 고정 데모 사진 4장 (public/listing) */}
              <img src={p.src} alt={p.label} />
              <span className="phl">{p.label}</span>
            </div>
          ))}
          {userPhotos.map((src) => (
            <div key={src} className="ph" data-user-photo="">
              {/* eslint-disable-next-line @next/next/no-img-element -- 사용자가 고른 사진 (blob URL, 올리지 않음) */}
              <img src={src} alt={c.yours} />
              <span className="phl">{c.yours}</span>
            </div>
          ))}
          <label className="addph">
            <input
              type="file"
              accept="image/*"
              aria-label={c.addPhoto}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) h.addPhoto(file);
                e.target.value = '';
              }}
            />
            <span className="addic" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24">
                <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
              </svg>
            </span>
            <span className="ls-addph-t">{c.addPhoto}</span>
            <span className="ls-addph-h">{c.addHint}</span>
          </label>
        </div>
      </div>
      <div className="ls-grid3">
        <label className="ls-group">
          <span className="lab">{c.fTitle}</span>
          <input className="fld" value={v.form.title} onChange={(e) => h.edit('title', e.target.value)} />
        </label>
        <label className="ls-group">
          <span className="lab">{c.fPrice}</span>
          <input className="fld" value={v.priceText} readOnly />
        </label>
        <label className="ls-group">
          <span className="lab">{c.fUnits}</span>
          <input className="fld" value={v.unitsText} readOnly />
        </label>
      </div>
      <div className="ls-grid-dates">
        <label className="ls-group">
          <span className="lab">{c.fFrom}</span>
          <input type="date" className="fld" value={v.form.from} onChange={(e) => h.edit('from', e.target.value)} />
        </label>
        <label className="ls-group">
          <span className="lab">{c.fTo}</span>
          <input type="date" className="fld" value={v.form.to} onChange={(e) => h.edit('to', e.target.value)} />
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
          <button type="button" className="btn b-tint" aria-disabled="true">
            {c.saveDraft}
          </button>
          <button type="button" className="btn b-black" data-action="publish" disabled={!v.datesValid} onClick={h.publish}>
            {c.publish}
          </button>
        </div>
      ) : null}
    </section>
  );
}

/** 시안 L126–L169 */
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
      <section className="card ls-card-risk">
        <div className="ls-panel-top">
          <div className="ls-prob-col">
            <span className="lab">{c.probL}</span>
            <div className="ls-big-row">
              <span className={p.improved ? 'ls-big good' : 'ls-big'} data-value="prob">
                {p.prob}
              </span>
              <AssumptionBadge />
            </div>
            <span className="ls-prob-sub" data-part="probSub">
              {p.probSub} · {p.before}
            </span>
          </div>
          <div className="tipw ls-tipw">
            <span className="ls-tip-l">
              {c.lossL}
              <button type="button" className="tipq" aria-label={c.lossHow}>
                i
              </button>
            </span>
            <b className="ls-loss" data-value="loss">
              {p.loss} <AssumptionBadge />
            </b>
            <span className="ls-range">{p.lossRange}</span>
            <span className="tipb" role="tooltip">
              {p.lossTip}
            </span>
          </div>
        </div>
        <div className="ls-dots-block">
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
          <span className="ls-status-t" role="status">
            {p.status}
          </span>
          <button type="button" className="btn b-ai b-sm" data-action="recalc" disabled={p.recalcDisabled} onClick={h.recalc}>
            {p.recalcLabel}
          </button>
        </div>
        {p.running ? (
          <div className="ls-prog" aria-hidden="true">
            <div className="ls-prog-fill" style={{ width: `${(p.progress * 100).toFixed(1)}%` }} />
          </div>
        ) : null}
      </section>
      <section className="card ls-checks">
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
        <div className="ls-actions-split">
          <ApiPill v={v} />
          <button type="button" className="btn b-black" data-action="publishFinal" disabled={p.running} onClick={h.publishFinal}>
            {c.publishNow}
          </button>
        </div>
      </section>
    </aside>
  );
}

/** 시안 L176–L253 */
function Sheet({ v, h }: { v: ListingView; h: ListingHandlers }) {
  const s = v.sheet;
  if (s === null) return null;
  const c = v.c;
  return (
    <>
      <div className="ls-scrim" aria-hidden="true" />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={c.sheetKicker}>
        <span className="ls-grab" aria-hidden="true" />
        <div className="ls-kicker">
          <AiChip />
          <span>{c.sheetKicker}</span>
        </div>
        {s.kind === 'running' ? (
          <>
            <div className="ls-an">
              <div className="ls-spin-wrap" aria-hidden="true">
                <svg className="spin" width="96" height="96" viewBox="0 0 96 96">
                  <circle cx="48" cy="48" r="40" className="ls-spin-track" strokeWidth="8" />
                  <path d="M48 8a40 40 0 0 1 40 40" className="ls-spin-arc" strokeWidth="8" strokeLinecap="round" />
                  <defs>
                    <linearGradient id="ls-spg" x1="48" y1="8" x2="88" y2="48" gradientUnits="userSpaceOnUse">
                      <stop offset="0" className="ls-spg-a" />
                      <stop offset="1" className="ls-spg-b" />
                    </linearGradient>
                  </defs>
                </svg>
                <svg className="pulse ls-pulse-ic" width="40" height="40" viewBox="0 0 24 24">
                  <path d="M4 18l5-6 4 3 7-9" className="ls-pulse-line" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="20" cy="6" r="2" className="ls-pulse-dot" />
                </svg>
              </div>
              <div className="ls-an-col">
                <b className="ls-an-t">{c.anT}</b>
                <span className="ls-an-s">{s.anS}</span>
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
              <span className="ls-run-t" data-progress={`${s.done}/${s.total}`} aria-live="polite">
                {s.runTxt}
              </span>
            </div>
          </>
        ) : (
          <div className="rise ls-result">
            <b className="ls-res-t">{c.resT}</b>
            <div className="ls-basis" aria-label={c.basisT}>
              {s.basis.map((b) => (
                <div key={b.k} className="ls-basis-cell">
                  <span className="ls-basis-k">{b.k}</span>
                  <b>{b.v}</b>
                  {b.chip ? <span className="chip ls-chip-peak">{b.chip}</span> : null}
                  {'assumption' in b && b.assumption ? <AssumptionBadge source={b.v} /> : null}
                </div>
              ))}
            </div>
            <div className="ls-hero">
              <div className="ls-hero-l">
                <span className="lab">{c.probL}</span>
                <span className="ls-hero-n" data-value="prob">
                  {s.prob}
                </span>
                <span className="ls-hero-sub">
                  {s.probSub} <AssumptionBadge />
                </span>
              </div>
              <div className="ls-hero-r">
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
            <div className="ls-top-block">
              <span className="lab">
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
                      <span className="ls-top-of">{t.of}</span>
                    </div>
                    <span className="ls-top-why">{t.why}</span>
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
                <div className="ls-bf-col">
                  <b>{c.bfT}</b>
                  <span>{c.bfB}</span>
                </div>
              </div>
            ) : null}
            <div className="ls-split">
              <div className="ls-fix-col">
                <span className="lab">{c.fixT}</span>
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
                  <span className="lab">{c.lossL}</span>
                  <b className="ls-loss" data-value="loss">
                    {s.loss} <AssumptionBadge />
                  </b>
                </div>
                <span className="ls-range">{s.lossRange}</span>
                <span className="ls-loss-how">{c.lossHow}</span>
                <span className="ls-loss-tip">{s.lossTip}</span>
              </div>
            </div>
            <div className="ls-sheet-actions">
              <button type="button" className="btn b-tint" data-action="publishAnyway" onClick={h.publishAnyway}>
                {c.publishAnyway}
              </button>
              <button type="button" className="btn b-ai" data-action="toDetail" onClick={h.toDetail}>
                {c.seeDetail} →
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/** 시안 L258–L270 */
function Done({ v, h }: { v: ListingView; h: ListingHandlers }) {
  const d = v.done;
  if (d === null) return null;
  return (
    <div className="ls-done-wrap">
      <section className="card rise ls-done">
        <span className="ls-done-ic" aria-hidden="true">
          ✓
        </span>
        <b className="ls-done-t">{v.c.doneT}</b>
        <span className="ls-done-s">{d.title}</span>
        <div className="ls-done-box">
          <b className={d.improved ? 'ls-done-prob good' : 'ls-done-prob'} data-value="doneProb">
            {d.prob} <AssumptionBadge />
          </b>
          <span className="ls-done-disp" data-value="doneLoss">
            {d.loss} · {d.disp}
          </span>
        </div>
        <span className="ls-done-note">{d.note}</span>
        <div className="ls-done-actions">
          <button type="button" className="btn b-tint" data-action="backEdit" onClick={h.backEdit}>
            {v.c.backEdit}
          </button>
          <button type="button" className="btn b-black" data-action="restart" onClick={h.restart}>
            {v.c.restart}
          </button>
        </div>
      </section>
    </div>
  );
}

export function ListingScreenView({
  view,
  handlers = NOOP,
  userPhotos = [],
}: {
  view: ListingView;
  handlers?: ListingHandlers;
  userPhotos?: string[];
}) {
  const showEditor = view.screen !== 'done';
  return (
    <Shell v={view}>
      {showEditor ? (
        <div className={view.screen === 'detail' ? 'ls-layout ls-layout-detail' : 'ls-layout'}>
          <Editor v={view} h={handlers} userPhotos={userPhotos} />
          <Panel v={view} h={handlers} />
        </div>
      ) : null}
      <Sheet v={view} h={handlers} />
      <Done v={view} h={handlers} />
    </Shell>
  );
}
