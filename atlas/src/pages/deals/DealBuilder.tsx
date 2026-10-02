import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useUser } from "@/auth/AuthContext";
import { usePageChrome } from "@/components/shell/PageChrome";
import { Modal, useToast } from "@/components/ui/overlay";
import { BrandChip, EmptyState, SkeletonRows } from "@/components/ui/primitives";
import { BRANDS, BY_ID, DISCOUNT_HARD_MAX, MARKETS, PRICE_BOOK_VERSION, type MarketId } from "@/config/priceBook";
import { AccessError, data, DEAL_STAGE_LABEL, type DealDetail, type Quote } from "@/data";
import { tableDate } from "@/lib/format";
import { compute, formatMoney, itemAvailable, itemIncluded, quoteSummary, type QuoteSelection } from "@/services/pricing";
import { Forbidden } from "@/pages/StatusPages";
import LinkedTasks from "@/components/LinkedTasks";

const MARKET_ORDER: MarketId[] = ["us", "we", "ch", "xk"];

const Picker = ({ open, sel, onChange, onClose }: { open: boolean; sel: QuoteSelection; onChange: (s: QuoteSelection) => void; onClose: () => void }) => (
  <Modal open={open} onClose={onClose} title="Add from price book" width={760}>
    <div className="flex max-h-[65vh] flex-col gap-5 overflow-y-auto pr-1">
      {BRANDS.map((b) => (
        <section key={b.id} aria-label={b.name} className="flex flex-col gap-3">
          <span className="label-caps">{b.name}</span>
          {b.groups.map((g) => (
            <div key={g.id} className="flex flex-col gap-1.5">
              <span className="text-[13px] text-text-2">
                {g.title} <span className="text-text-3">· {g.sub}</span>
              </span>
              {g.type === "tier"
                ? g.items!.map((it) => {
                    const on = sel.tiers[g.id] === it.id;
                    return (
                      <label key={it.id} className={`flex cursor-pointer items-start gap-3 border px-3 py-2.5 text-[13px] ${on ? "border-ice" : "border-line"}`}>
                        <input
                          type="radio"
                          name={g.id}
                          checked={on}
                          onChange={() => onChange({ ...sel, tiers: { ...sel.tiers, [g.id]: it.id } })}
                          className="mt-1 accent-[var(--cyan)]"
                        />
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span>
                            {it.name} {it.badge ? <span className="ml-1 text-[10px] uppercase tracking-[0.16em] text-cyan">{it.badge}</span> : null}
                          </span>
                          {it.note ? <span className="text-[12px] text-text-3">{it.note}</span> : null}
                        </span>
                        <span className="num shrink-0 text-text-2">
                          {it.setup.toLocaleString("en-US")} + {it.monthly}/mo
                        </span>
                      </label>
                    );
                  }).concat(
                    sel.tiers[g.id]
                      ? [
                          <button
                            key="clear"
                            type="button"
                            className="btn-ghost self-start"
                            onClick={() => {
                              const tiers = { ...sel.tiers };
                              delete tiers[g.id];
                              onChange({ ...sel, tiers });
                            }}
                          >
                            Remove {g.title.toLowerCase()}
                          </button>,
                        ]
                      : [],
                  )
                : g.type === "addon"
                  ? g.items!.map((it) => {
                      const avail = itemAvailable(sel, g.id, it.id);
                      const incl = itemIncluded(sel, it.id);
                      const q = sel.qty[it.id] ?? 0;
                      const max = it.max ?? 1;
                      return (
                        <div key={it.id} className={`flex items-center gap-3 border border-line px-3 py-2 text-[13px] ${!avail ? "opacity-50" : ""}`}>
                          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span>
                              {it.name}
                              {it.warn ? <span className="ml-2 text-[10px] uppercase tracking-[0.16em] text-amber">Check first</span> : null}
                            </span>
                            <span className="text-[12px] text-text-3">
                              {incl ? "Included with the chosen receptionist" : !avail ? `Needs ${(it.requires ?? g.requires) === "lp" ? "a landing page" : "a 3D product"}` : it.note ?? ""}
                            </span>
                          </span>
                          <span className="num shrink-0 text-text-2">
                            {it.setup.toLocaleString("en-US")} + {it.monthly}/mo
                          </span>
                          {incl ? (
                            <span className="w-24 text-right text-[11px] uppercase tracking-[0.16em] text-mint">Included</span>
                          ) : (
                            <span className="flex w-24 items-center justify-end gap-1">
                              <button type="button" aria-label={`Fewer ${it.name}`} className="btn-outline h-8 w-8 px-0" disabled={!avail || q === 0} onClick={() => onChange({ ...sel, qty: { ...sel.qty, [it.id]: q - 1 } })}>
                                −
                              </button>
                              <span className="num w-6 text-center">{q}</span>
                              <button type="button" aria-label={`More ${it.name}`} className="btn-outline h-8 w-8 px-0" disabled={!avail || q >= max} onClick={() => onChange({ ...sel, qty: { ...sel.qty, [it.id]: q + 1 } })}>
                                +
                              </button>
                            </span>
                          )}
                        </div>
                      );
                    })
                  : (
                      <label className="flex items-center gap-3 border border-line px-3 py-2 text-[13px]">
                        <span className="flex-1 text-text-2">{g.note}</span>
                        Build days
                        <input type="number" min={0} max={200} className="input h-9 w-20" value={sel.days} onChange={(e) => onChange({ ...sel, days: Math.max(0, Number(e.target.value) || 0) })} />
                      </label>
                    )}
            </div>
          ))}
        </section>
      ))}
    </div>
    <button type="button" className="btn-primary mt-4 w-full justify-between" onClick={onClose}>
      <span>Done</span>
      <span aria-hidden="true">→</span>
    </button>
  </Modal>
);

const QuoteTimeline = ({ q, market }: { q: Quote; market: MarketId }) => {
  const steps = [
    { label: "Quote sent", at: q.sentAt },
    { label: "Opened by client", at: q.openedAt },
    { label: `Terms accepted${q.acceptedByName ? ` · ${q.acceptedByName}` : ""}`, at: q.acceptedAt },
    { label: `Deposit paid · ${formatMoney(q.depositMinor / 100, market)}`, at: q.paidAt },
  ];
  return (
    <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
      {steps.map((st) => (
        <li key={st.label} className="flex items-center gap-3 text-[13px]">
          <span className={`h-2.5 w-2.5 border ${st.at ? "border-mint bg-mint" : "border-line-button"}`} aria-hidden="true" />
          <span className={st.at ? "text-text" : "text-text-3"}>{st.label}</span>
          <span className="ml-auto font-mono text-[11px] text-text-3">{st.at ? tableDate(st.at) : "—"}</span>
        </li>
      ))}
    </ol>
  );
};

const DealBuilder = () => {
  const { id = "" } = useParams();
  const user = useUser();
  const toast = useToast();
  const [detail, setDetail] = useState<DealDetail | null>(null);
  const [sel, setSel] = useState<QuoteSelection | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [picking, setPicking] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [requestPct, setRequestPct] = useState(15);
  const [requestNote, setRequestNote] = useState("");

  const load = useCallback(() => {
    data
      .getDeal(id)
      .then((d) => {
        setDetail(d);
        setSel(d.draft);
        setError(null);
      })
      .catch(setError);
  }, [id]);
  useEffect(load, [load]);

  usePageChrome(detail ? { context: `Deals / ${detail.row.company.name}` } : null);

  if (error instanceof AccessError && error.status === 403) return <Forbidden />;
  if (error) return <EmptyState title={error.message} action={<Link to="/deals" className="btn-outline">Back to deals →</Link>} />;
  if (!detail || !sel) return <SkeletonRows rows={8} />;

  const canEdit = detail.editable && (user.role === "admin" || ((user.role === "bdr" || user.role === "closer") && detail.row.deal.ownerId === user.id));
  const r = compute(sel);
  const market = MARKETS[sel.market];
  const latest = detail.quotes.find((q) => q.status !== "superseded") ?? null;
  const pendingApproval = detail.approval?.status === "pending" ? detail.approval : null;
  const fmt = (n: number) => formatMoney(n, sel.market);

  const update = async (next: QuoteSelection) => {
    setSel(next); // instant preview from the same compute()
    try {
      setDetail(await data.updateDraft(id, next));
    } catch (e) {
      toast((e as Error).message, "error");
      setSel(detail.draft);
    }
  };

  const run = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn();
      toast(msg, "good");
      load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex min-w-0 flex-col gap-6">
        <div className="flex flex-col gap-2.5">
          <span className="label-caps">
            {latest ? `Quote v${latest.version} · ${latest.status}` : "Quote v1"} · price book {PRICE_BOOK_VERSION} · {latest ? `valid until ${tableDate(latest.validUntil)}` : "not saved yet"}
          </span>
          <h1 className="m-0 text-[40px] font-light tracking-[-0.02em]">
            <Link to={`/leads/${detail.row.lead.id}`} className="hover:text-cyan">
              {detail.row.company.name}
            </Link>
          </h1>
          <span className="text-[13px] text-text-2">
            {DEAL_STAGE_LABEL[detail.row.deal.stage]} · owner {detail.row.ownerName ?? "Unassigned"}
            {!detail.editable ? " · locked: the quote was accepted or paid" : ""}
          </span>
        </div>

        <fieldset disabled={!canEdit} className="m-0 flex flex-col gap-4 border-0 p-0 disabled:opacity-60">
          <legend className="sr-only">Quote options</legend>
          <div role="radiogroup" aria-label="Market" className="flex flex-wrap border border-line-strong">
            {MARKET_ORDER.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={sel.market === m}
                onClick={() => update({ ...sel, market: m })}
                className={`h-10 flex-1 px-3 text-[12px] ${sel.market === m ? "bg-ice text-ice-ink" : "text-text-2 hover:text-text"}`}
              >
                {MARKETS[m].label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-[13px] text-text-2">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={sel.pilot} disabled={!sel.pilot && detail.pilotsLeft === 0} onChange={(e) => update({ ...sel, pilot: e.target.checked })} className="h-4 w-4 accent-[var(--cyan)]" />
              Pilot <span className="text-text-3">({detail.pilotsLeft} of 2 left)</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={sel.rush} onChange={(e) => update({ ...sel, rush: e.target.checked })} className="h-4 w-4 accent-[var(--cyan)]" />
              Rush +25%
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={sel.billing === "annual"} onChange={(e) => update({ ...sel, billing: e.target.checked ? "annual" : "monthly" })} className="h-4 w-4 accent-[var(--cyan)]" />
              Annual prepay
            </label>
            {user.role !== "bdr" ? (
              <label className="inline-flex items-center gap-2">
                Extra discount
                <input
                  type="number"
                  min={0}
                  max={detail.maxDiscount}
                  className="input h-9 w-20"
                  value={sel.disc}
                  onChange={(e) => update({ ...sel, disc: Math.max(0, Math.min(detail.maxDiscount, Number(e.target.value) || 0)) })}
                />
                % <span className="text-text-3">(up to {detail.maxDiscount}%)</span>
                <button type="button" className="btn-ghost" onClick={() => setRequesting(true)}>
                  Request more
                </button>
              </label>
            ) : null}
          </div>
        </fieldset>
        {pendingApproval ? (
          <div className="flex flex-wrap items-center gap-3 border border-amber/50 px-4 py-3 text-[13px] text-amber">
            {pendingApproval.pct}% extra discount waiting for the second founder{pendingApproval.note ? ` · "${pendingApproval.note}"` : ""}.
            {user.role === "admin" && pendingApproval.requestedBy !== user.id ? (
              <span className="ml-auto flex gap-2">
                <button type="button" className="btn-primary h-9 text-[11px]" onClick={() => run(() => data.decideDiscount(pendingApproval.id, true), "Discount approved")}>
                  Approve
                </button>
                <button type="button" className="btn-outline h-9 text-[11px]" onClick={() => run(() => data.decideDiscount(pendingApproval.id, false), "Discount rejected")}>
                  Reject
                </button>
              </span>
            ) : null}
          </div>
        ) : null}

        <section aria-label="Line items" className="card min-w-0">
          <div className="grid grid-cols-[96px_minmax(0,1fr)_44px_100px_100px] gap-3 border-b border-line px-4 py-3 text-[10px] uppercase tracking-[0.2em] text-text-3 bg-surface-2">
            <span>Brand</span>
            <span>Item</span>
            <span>Qty</span>
            <span className="text-right">Setup</span>
            <span className="text-right">Monthly</span>
          </div>
          {r.lines.map((l) => (
            <div key={l.id} className="grid grid-cols-[96px_minmax(0,1fr)_44px_100px_100px] items-center gap-3 border-b border-line-soft px-4 py-3 text-[13px]">
              <span>
                <BrandChip brand={l.brand === "gl" ? "gllarix" : "arcadian"} />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate">{l.name}</span>
                {BY_ID[l.id]?.note ? <span className="truncate text-[12px] text-text-3">{BY_ID[l.id].note}</span> : null}
              </span>
              <span className="num">{l.q}</span>
              <span className="num text-right">{fmt(l.setup)}</span>
              <span className="num text-right">{l.monthly ? fmt(l.monthly) : "—"}</span>
            </div>
          ))}
          {!r.lines.length ? <p className="m-0 px-4 py-5 text-[13px] text-text-2">No items yet. Add the offer from the price book.</p> : null}
          {canEdit ? (
            <button type="button" className="btn-ghost m-4" onClick={() => setPicking(true)}>
              + Add from price book
            </button>
          ) : null}
        </section>

        <section aria-label="Adjustments" className="card">
          {[
            { name: "List subtotal", ds: r.S0, dm: r.M0, sum: true },
            ...r.adj.map((a) => ({ ...a, sum: false })),
            { name: "Final · setup rounded to 10", ds: r.setup, dm: r.monthly, sum: true },
          ].map((a) => (
            <div key={a.name} className={`grid grid-cols-[minmax(0,1fr)_110px_110px] gap-3 border-b border-line-soft px-4 py-2.5 text-[13px] last:border-b-0 ${a.sum ? "text-text" : "text-text-2"}`}>
              <span>{a.name}</span>
              <span className="num text-right">{a.ds ? fmt(a.ds) : "—"}</span>
              <span className="num text-right">{a.dm ? fmt(a.dm) : "—"}</span>
            </div>
          ))}
        </section>
      </div>

      <aside className="flex flex-col gap-4">
        <section aria-label="Totals" className="card flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-1">
            <span className="label-caps">Setup fee</span>
            <span className="num text-[36px] font-light text-mint">{fmt(r.setup)}</span>
            <span className="text-[12px] text-text-3">50% now ({fmt(Math.round(r.setup / 2))}) · 50% at launch</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="label-caps">Monthly</span>
            <span className="num text-[28px] font-light text-cyan">{fmt(r.monthly)}</span>
            <span className="text-[12px] text-text-3">{sel.billing === "annual" ? `Billed ${fmt(r.monthly * 10)} per year` : sel.pilot && r.monthly ? "First month free" : "From launch"}</span>
          </div>
          <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-[13px]">
            <dt className="text-text-2">First-year value</dt>
            <dd className="num m-0">{fmt(r.firstYear)}</dd>
            {r.mins ? (
              <>
                <dt className="text-text-2">Minutes included</dt>
                <dd className="num m-0">{r.mins.toLocaleString("en-US")}/mo</dd>
                <dt className="text-text-2">Overage rate</dt>
                <dd className="num m-0">
                  {market.symbol}
                  {sel.overRate.toFixed(2)}/min
                </dd>
              </>
            ) : null}
            <dt className="text-text-2">{user.role === "closer" ? "Closer" : "BDR"} commission</dt>
            <dd className="num m-0">{fmt(r.comm)}</dd>
            <dt className="text-text-2">Extra discount</dt>
            <dd className="m-0">{r.dp ? `${r.dp}%` : "None"}</dd>
          </dl>
          {canEdit ? (
            <div className="flex flex-col gap-2">
              <button type="button" className="btn-outline justify-between" onClick={() => run(() => data.saveQuote(id), "Saved as a new quote version")}>
                <span>Save quote version</span>
                <span aria-hidden="true">↓</span>
              </button>
              {latest && (latest.status === "draft" || latest.status === "sent") ? (
                <button type="button" className="btn-primary justify-between" onClick={() => run(() => data.sendQuote(latest.id).then(() => data.runSender()), `Quote v${latest.version} sent to the client`)}>
                  <span>{latest.status === "sent" ? "Resend quote" : `Send quote v${latest.version}`}</span>
                  <span aria-hidden="true">→</span>
                </button>
              ) : null}
            </div>
          ) : null}
          <button
            type="button"
            className="btn-ghost self-start"
            onClick={async () => {
              await navigator.clipboard?.writeText(quoteSummary(r, sel, detail.row.company.name)).catch(() => undefined);
              toast("Quote text copied", "good");
            }}
          >
            Copy quote text
          </button>
          {latest && latest.status !== "draft" ? (
            <a href={`/q/${latest.token}?print=1`} target="_blank" rel="noopener" className="btn-ghost self-start">
              Download quote PDF ↗
            </a>
          ) : null}
        </section>

        {latest ? (
          <section aria-label="Quote status" className="card flex flex-col gap-3 p-5">
            <span className="label-caps">
              Quote v{latest.version} · {latest.status}
            </span>
            <QuoteTimeline q={latest} market={latest.selection.market} />
            {latest.status !== "draft" ? (
              <a href={`/q/${latest.token}`} target="_blank" rel="noopener" className="btn-ghost self-start">
                Open client page ↗
              </a>
            ) : null}
          </section>
        ) : null}
        <LinkedTasks type="deal" id={detail.row.deal.id} compact />

        {detail.payments.length ? (
          <section aria-label="Payments" className="card flex flex-col gap-2 p-5 text-[13px]">
            <span className="label-caps">Payments</span>
            {detail.payments.map((p) => (
              <span key={p.id} className="flex justify-between">
                <span className="text-text-2">{p.type.replace("_", " ")} · {tableDate(p.paidAt)}</span>
                <span className="num text-mint">{formatMoney(p.amountMinor / 100, sel.market)}</span>
              </span>
            ))}
          </section>
        ) : null}
      </aside>

      <Picker open={picking} sel={sel} onChange={update} onClose={() => setPicking(false)} />
      <Modal open={requesting} onClose={() => setRequesting(false)} title="Request a bigger discount">
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            await run(() => data.requestDiscount(id, requestPct, requestNote), "Sent to the other founder");
            setRequesting(false);
          }}
        >
          <p className="m-0 text-[14px] text-text-2">Above 10% needs both founders. The other admin approves or rejects; then you can apply it.</p>
          <label className="flex flex-col gap-2">
            <span className="field-label">Discount %</span>
            <input type="number" min={11} max={DISCOUNT_HARD_MAX} className="input" value={requestPct} onChange={(e) => setRequestPct(Number(e.target.value))} />
          </label>
          <label className="flex flex-col gap-2">
            <span className="field-label">Why</span>
            <input className="input" value={requestNote} onChange={(e) => setRequestNote(e.target.value)} required />
          </label>
          <button type="submit" className="btn-primary">
            Send request
          </button>
        </form>
      </Modal>
    </div>
  );
};

/** /deals/new?lead=… creates (or reuses) the deal and opens the builder. */
export const NewDeal = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const lead = params.get("lead");
    if (!lead) return setError("Open a lead and choose Create deal, or start from the call workspace.");
    data
      .createDeal(lead)
      .then((dealId) => navigate(`/deals/${dealId}`, { replace: true }))
      .catch((e: Error) => setError(e.message));
  }, [params, navigate]);
  return error ? <EmptyState title={error} action={<Link to="/leads" className="btn-outline">Go to leads →</Link>} /> : <SkeletonRows rows={4} />;
};

export default DealBuilder;
