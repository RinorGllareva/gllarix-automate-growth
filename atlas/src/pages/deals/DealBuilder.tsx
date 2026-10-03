import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useUser } from "@/auth/AuthContext";
import { usePageChrome } from "@/components/shell/PageChrome";
import { Modal, useToast } from "@/components/ui/overlay";
import { Avatar, BrandChip, EmptyState, Icon, ICONS, SkeletonRows, StageChip, Toggle } from "@/components/ui/primitives";
import { DEAL_STAGE_HUE } from "@/config/colors";
import { BRANDS, BY_ID, DISCOUNT_HARD_MAX, MARKETS, PRICE_BOOK_VERSION, type MarketId } from "@/config/priceBook";
import { LOST_REASONS } from "@/config/targets";
import { AccessError, BDR_MAX_STAGE, data, DEAL_STAGE_LABEL, DEAL_STAGES, type DealDetail, type DealStage, type Quote } from "@/data";
import { tableDate } from "@/lib/format";
import { compute, formatMoney, itemAvailable, itemIncluded, quoteSummary, type QuoteSelection } from "@/services/pricing";
import { Forbidden } from "@/pages/StatusPages";
import LinkedTasks from "@/components/LinkedTasks";
import RecordFiles from "@/components/RecordFiles";
import ContractPanel from "./ContractPanel";

const MARKET_ORDER: MarketId[] = ["us", "we", "ch", "xk"];

/** The price book, inline: tiers are radio cards, add-ons have − / + steppers, custom work takes build days. */
const PackageEditor = ({ sel, onChange }: { sel: QuoteSelection; onChange: (s: QuoteSelection) => void }) => {
  const [brand, setBrand] = useState(BRANDS[0].id);
  const b = BRANDS.find((x) => x.id === brand)!;
  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Brand" className="flex self-start rounded-lg bg-inset p-0.5">
        {BRANDS.map((x) => (
          <button key={x.id} type="button" role="tab" aria-selected={brand === x.id} onClick={() => setBrand(x.id)} className={`h-8 rounded-md px-3 text-[13px] ${brand === x.id ? "bg-surface-2 text-text shadow-card" : "text-text-2 hover:text-text"}`}>
            {x.name}
          </button>
        ))}
      </div>
      {b.groups.map((g) => (
        <div key={g.id} className="flex flex-col gap-2">
          <span className="text-[13px] font-medium">
            {g.title} <span className="font-normal text-text-3">· {g.sub}</span>
          </span>
          {g.type === "tier" ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {g.items!.map((it) => {
                const on = sel.tiers[g.id] === it.id;
                return (
                  <button
                    key={it.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      const tiers = { ...sel.tiers };
                      if (on) delete tiers[g.id];
                      else tiers[g.id] = it.id;
                      onChange({ ...sel, tiers });
                    }}
                    className={`flex flex-col gap-1 rounded-lg border px-3 py-2.5 text-left text-[13px] transition-colors ${on ? "border-cyan bg-cyan-tint" : "border-line hover:border-line-strong"}`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-medium">
                        {it.name} {it.badge ? <span className="ml-1 text-[11px] font-medium text-cyan">{it.badge}</span> : null}
                      </span>
                      {on ? <Icon d="M5 12l5 5L20 7" size={14} className="text-cyan" /> : null}
                    </span>
                    {it.note ? <span className="text-[12px] text-text-3">{it.note}</span> : null}
                    <span className="num text-[12px] text-text-2">
                      {it.setup.toLocaleString("en-US")} setup · {it.monthly}/mo
                    </span>
                  </button>
                );
              })}
            </div>
          ) : g.type === "addon" ? (
            <div className="flex flex-col gap-1.5">
              {g.items!.map((it) => {
                const avail = itemAvailable(sel, g.id, it.id);
                const incl = itemIncluded(sel, it.id);
                const q = sel.qty[it.id] ?? 0;
                const max = it.max ?? 1;
                return (
                  <div key={it.id} className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-[13px] ${q > 0 ? "border-cyan/60 bg-cyan-tint" : "border-line"} ${!avail ? "opacity-50" : ""}`}>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span>
                        {it.name}
                        {it.warn ? <span className="ml-2 text-[11px] font-medium text-amber">Check first</span> : null}
                      </span>
                      <span className="text-[12px] text-text-3">
                        {incl ? "Included with the chosen receptionist" : !avail ? `Needs ${(it.requires ?? g.requires) === "lp" ? "a landing page" : "a 3D product"} first` : it.note ?? ""}
                      </span>
                    </span>
                    <span className="num shrink-0 text-[12px] text-text-2">
                      {it.setup.toLocaleString("en-US")} · {it.monthly}/mo
                    </span>
                    {incl ? (
                      <span className="w-24 text-right text-[12px] font-medium text-mint">Included</span>
                    ) : (
                      <span className="flex w-24 items-center justify-end gap-1">
                        <button type="button" aria-label={`Fewer ${it.name}`} className="btn-outline h-7 w-7 px-0" disabled={!avail || q === 0} onClick={() => onChange({ ...sel, qty: { ...sel.qty, [it.id]: q - 1 } })}>
                          −
                        </button>
                        <span className="num w-6 text-center">{q}</span>
                        <button type="button" aria-label={`More ${it.name}`} className="btn-outline h-7 w-7 px-0" disabled={!avail || q >= max} onClick={() => onChange({ ...sel, qty: { ...sel.qty, [it.id]: q + 1 } })}>
                          +
                        </button>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <label className="flex items-center gap-3 rounded-lg border border-line px-3 py-2 text-[13px]">
              <span className="flex-1 text-text-2">{g.note}</span>
              Build days
              <input type="number" min={0} max={200} className="input h-8 w-20" value={sel.days} onChange={(e) => onChange({ ...sel, days: Math.max(0, Number(e.target.value) || 0) })} />
            </label>
          )}
        </div>
      ))}
    </div>
  );
};

/** Build → Sent → Opened → Accepted → Paid, with dates. */
const Stepper = ({ q, dirty }: { q: Quote | null; dirty: boolean }) => {
  const steps = [
    { label: q ? `Quote v${q.version} saved` : "Build the quote", at: q?.createdAt ?? null, done: Boolean(q) && !dirty },
    { label: "Sent", at: q?.sentAt ?? null, done: Boolean(q?.sentAt) },
    { label: "Opened", at: q?.openedAt ?? null, done: Boolean(q?.openedAt) },
    { label: q?.acceptedByName ? `Accepted by ${q.acceptedByName}` : "Accepted", at: q?.acceptedAt ?? null, done: Boolean(q?.acceptedAt) },
    { label: "Deposit paid", at: q?.paidAt ?? null, done: Boolean(q?.paidAt) },
  ];
  const current = steps.findIndex((s) => !s.done);
  return (
    <ol aria-label="Quote progress" className="m-0 grid list-none grid-cols-5 gap-2 p-0">
      {steps.map((s, i) => (
        <li key={s.label} aria-current={i === current ? "step" : undefined} className="flex min-w-0 flex-col gap-1.5">
          <span className="h-1 rounded-full" style={{ background: s.done ? "var(--mint)" : i === current ? "var(--cyan)" : "var(--line-strong)" }} />
          <span className={`truncate text-[12px] font-medium ${s.done ? "text-text" : i === current ? "text-cyan" : "text-text-3"}`}>{s.label}</span>
          <span className="num text-[11px] text-text-3">{s.at ? tableDate(s.at) : i === current ? "Next" : "—"}</span>
        </li>
      ))}
    </ol>
  );
};

const Section = ({ step, title, help, children, action }: { step?: string; title: string; help?: string; children: ReactNode; action?: ReactNode }) => (
  <section aria-label={title} className="card flex flex-col gap-4 p-5">
    <div className="flex items-start justify-between gap-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-[15px] font-semibold">
          {step ? <span className="mr-2 text-text-3">{step}</span> : null}
          {title}
        </span>
        {help ? <span className="text-[13px] text-text-3">{help}</span> : null}
      </div>
      {action}
    </div>
    {children}
  </section>
);

const Option = ({ title, help, children }: { title: string; help: string; children: ReactNode }) => (
  <div className="flex items-center justify-between gap-4 border-b border-line-soft py-3 last:border-b-0">
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[14px]">{title}</span>
      <span className="text-[12px] text-text-3">{help}</span>
    </div>
    {children}
  </div>
);

const DealBuilder = () => {
  const { id = "" } = useParams();
  const user = useUser();
  const toast = useToast();
  const [detail, setDetail] = useState<DealDetail | null>(null);
  const [sel, setSel] = useState<QuoteSelection | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [editingPackage, setEditingPackage] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [requestPct, setRequestPct] = useState(15);
  const [requestNote, setRequestNote] = useState("");
  const [tab, setTab] = useState<"history" | "contract" | "files" | "tasks" | "payments">("history");
  const [showMath, setShowMath] = useState(false);
  const [pending, setPending] = useState<"lost" | "won" | null>(null);
  const [lostReason, setLostReason] = useState<string>(LOST_REASONS[0]);
  const [note, setNote] = useState("");

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
  if (error) return <EmptyState title={error.message} action={<Link to="/deals" className="btn-outline">Back to deals</Link>} />;
  if (!detail || !sel) return <SkeletonRows rows={8} />;

  const deal = detail.row.deal;
  const isAdmin = user.role === "admin";
  const isSeller = user.role === "bdr" || user.role === "closer";
  const canEdit = detail.editable && (isAdmin || (isSeller && deal.ownerId === user.id));
  const canMove = isAdmin || (isSeller && deal.ownerId === user.id && deal.stage !== "won");
  const showInternal = user.role !== "viewer";
  const r = compute(sel);
  const market = MARKETS[sel.market];
  const latest = detail.quotes.find((q) => q.status !== "superseded") ?? null;
  const dirty = !latest || JSON.stringify(latest.selection) !== JSON.stringify(sel);
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

  const stageAllowed = (stage: DealStage) => isAdmin || stage === "lost" || DEAL_STAGES.indexOf(stage) <= DEAL_STAGES.indexOf(BDR_MAX_STAGE);
  const move = async (stage: DealStage, extra: { lostReason?: string; lostNote?: string; overrideReason?: string } = {}) => {
    if (stage === deal.stage) return;
    if (!stageAllowed(stage)) return toast("BDRs can move deals up to Proposal sent.", "error");
    if (stage === "lost" && !extra.lostReason) return setPending("lost");
    if (stage === "won" && !deal.depositPaid && !extra.overrideReason) {
      if (!isAdmin) return toast("Won needs a paid deposit. An admin can override with a reason.", "error");
      return setPending("won");
    }
    await run(() => data.moveDeal(deal.id, { stage, ...extra }), `Moved to ${DEAL_STAGE_LABEL[stage]}`);
    setPending(null);
    setNote("");
  };

  // One main action that follows the state of the quote.
  const primary = !canEdit
    ? null
    : dirty
      ? { label: latest ? `Save as quote v${latest.version + 1}` : "Save quote", help: "Saves a version you can send. Earlier versions stay in the history.", go: () => run(() => data.saveQuote(id), "Quote saved") }
      : latest && (latest.status === "draft" || latest.status === "sent")
        ? {
            label: latest.status === "sent" ? "Resend quote" : `Send quote v${latest.version}`,
            help: latest.status === "sent" ? "Emails the same link again." : "Emails the client a link to view, accept and pay the deposit.",
            go: () => run(() => data.sendQuote(latest.id).then(() => data.runSender()), `Quote v${latest.version} sent to the client`),
          }
        : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Header: who, where in the pipeline, and the one thing to do next. */}
      <div className="flex flex-col gap-4">
        <Link to="/deals" className="flex items-center gap-1 self-start text-[13px] text-text-3 hover:text-text">
          <Icon d={ICONS.chevronLeft} size={14} /> Deals
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="page-title m-0">
                <Link to={`/leads/${detail.row.lead.id}`} className="hover:text-cyan">
                  {detail.row.company.name}
                </Link>
              </h1>
              <BrandChip brand={deal.brand} />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-text-2">
              {detail.row.contactName ? <span>{detail.row.contactName}</span> : null}
              <span className="flex items-center gap-1.5">
                <Avatar id={deal.ownerId} name={detail.row.ownerName ?? "?"} size={20} />
                {detail.row.ownerName ?? "Unassigned"}
              </span>
              <label className="relative flex items-center gap-1.5">
                <span className="text-text-3">Stage</span>
                <StageChip hue={DEAL_STAGE_HUE[deal.stage]}>{DEAL_STAGE_LABEL[deal.stage]}</StageChip>
                {canMove ? (
                  <select aria-label="Move to stage" className="absolute inset-0 cursor-pointer opacity-0" value={deal.stage} onChange={(e) => move(e.target.value as DealStage)}>
                    {DEAL_STAGES.map((s) => (
                      <option key={s} value={s} disabled={!stageAllowed(s)}>
                        {DEAL_STAGE_LABEL[s]}
                        {!stageAllowed(s) ? " (admin)" : ""}
                      </option>
                    ))}
                  </select>
                ) : null}
              </label>
              {!detail.editable ? <span className="text-amber">Locked: the client accepted or paid this quote</span> : null}
            </div>
          </div>
          {primary ? (
            <div className="flex flex-col items-end gap-1">
              <button type="button" className="btn-primary" onClick={primary.go}>
                {primary.label}
                <Icon d={ICONS.arrow} size={15} />
              </button>
              <span className="max-w-[300px] text-right text-[12px] text-text-3">{primary.help}</span>
            </div>
          ) : null}
        </div>
        <div className="card px-5 py-4">
          <Stepper q={latest} dirty={dirty && canEdit} />
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          <fieldset disabled={!canEdit} className="m-0 flex min-w-0 flex-col gap-6 border-0 p-0 disabled:opacity-70">
            <legend className="sr-only">Build the offer</legend>
            <Section step="1" title="Market" help="Prices follow the client's market.">
              <div role="radiogroup" aria-label="Market" className="flex flex-wrap rounded-lg bg-inset p-0.5">
                {MARKET_ORDER.map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={sel.market === m}
                    onClick={() => update({ ...sel, market: m })}
                    className={`h-8 flex-1 rounded-md px-3 text-[13px] ${sel.market === m ? "bg-surface-2 text-text shadow-card" : "text-text-2 hover:text-text"}`}
                  >
                    {MARKETS[m].label}
                  </button>
                ))}
              </div>
            </Section>

            <Section
              step="2"
              title="Package"
              help={`From price book ${PRICE_BOOK_VERSION}. List prices before the options below.`}
              action={
                canEdit ? (
                  <button type="button" className="btn-outline" onClick={() => setEditingPackage((x) => !x)} aria-expanded={editingPackage}>
                    {editingPackage ? "Done" : r.lines.length ? "Change package" : "Choose package"}
                  </button>
                ) : null
              }
            >
              <div className="overflow-hidden rounded-lg border border-line">
                <div className="grid grid-cols-[minmax(0,1fr)_44px_100px_100px] gap-3 border-b border-line bg-surface-2/60 px-4 py-2 text-[12px] text-text-3">
                  <span>Item</span>
                  <span>Qty</span>
                  <span className="text-right">Setup</span>
                  <span className="text-right">Monthly</span>
                </div>
                {r.lines.map((l) => (
                  <div key={l.id} className="grid grid-cols-[minmax(0,1fr)_44px_100px_100px] items-center gap-3 border-b border-line-soft px-4 py-2.5 text-[13px] last:border-b-0">
                    <span className="flex min-w-0 items-center gap-2">
                      <BrandChip brand={l.brand === "gl" ? "gllarix" : "arcadian"} />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{l.name}</span>
                        {BY_ID[l.id]?.note ? <span className="truncate text-[12px] text-text-3">{BY_ID[l.id].note}</span> : null}
                      </span>
                    </span>
                    <span className="num">{l.q}</span>
                    <span className="num text-right">{fmt(l.setup)}</span>
                    <span className="num text-right">{l.monthly ? fmt(l.monthly) : "—"}</span>
                  </div>
                ))}
                {!r.lines.length ? <p className="m-0 px-4 py-5 text-[13px] text-text-2">Nothing in the quote yet. Choose a package to start.</p> : null}
              </div>
              {editingPackage && canEdit ? <PackageEditor sel={sel} onChange={update} /> : null}
            </Section>

            <Section step="3" title="Options" help="Each option changes the price on the right straight away.">
              <div className="flex flex-col">
                <Option title="Pilot" help={`Setup at 40%, monthly −25% for 12 months, first month free. ${detail.pilotsLeft} of 2 pilots left for this brand.`}>
                  <Toggle ariaLabel="Pilot" checked={sel.pilot} onChange={(v) => (!v || detail.pilotsLeft > 0 || sel.pilot ? update({ ...sel, pilot: v }) : toast("No pilots left for this brand.", "error"))} label={sel.pilot ? "On" : "Off"} />
                </Option>
                <Option title="Rush delivery" help="+25% on setup for a faster build.">
                  <Toggle ariaLabel="Rush delivery" checked={sel.rush} onChange={(v) => update({ ...sel, rush: v })} label={sel.rush ? "On" : "Off"} />
                </Option>
                <Option title="Annual prepay" help="The client pays the year up front and gets two months free.">
                  <Toggle ariaLabel="Annual prepay" checked={sel.billing === "annual"} onChange={(v) => update({ ...sel, billing: v ? "annual" : "monthly" })} label={sel.billing === "annual" ? "On" : "Off"} />
                </Option>
                {user.role !== "bdr" ? (
                  <Option title="Extra discount" help={`Up to ${detail.maxDiscount}% on your own. More needs the other founder's approval.`}>
                    <span className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={detail.maxDiscount}
                        aria-label="Extra discount %"
                        className="input h-8 w-20 text-right"
                        value={sel.disc}
                        onChange={(e) => update({ ...sel, disc: Math.max(0, Math.min(detail.maxDiscount, Number(e.target.value) || 0)) })}
                      />
                      <span className="text-text-3">%</span>
                      <button type="button" className="btn-ghost" onClick={() => setRequesting(true)}>
                        Ask for more
                      </button>
                    </span>
                  </Option>
                ) : null}
              </div>
            </Section>
          </fieldset>

          <section aria-label="History, contract, files, tasks and payments" className="card flex flex-col">
            <div role="tablist" className="flex gap-1 border-b border-line px-3 pt-2">
              {(
                [
                  ["history", `Quote history · ${detail.quotes.length}`],
                  ["contract", "Contract"],
                  ["files", "Files"],
                  ["tasks", "Tasks"],
                  ["payments", `Payments · ${detail.payments.length}`],
                ] as const
              ).map(([k, label]) => (
                <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`-mb-px border-b-2 px-3 py-2 text-[13px] font-medium ${tab === k ? "border-app text-text" : "border-transparent text-text-3 hover:text-text"}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="p-5">
              {tab === "history" ? (
                detail.quotes.length ? (
                  <div className="flex flex-col">
                    {detail.quotes.map((q) => (
                      <div key={q.id} className="grid grid-cols-[70px_110px_minmax(0,1fr)_auto] items-center gap-3 border-b border-line-soft py-2.5 text-[13px] last:border-b-0">
                        <span className="font-medium">v{q.version}</span>
                        <span className="capitalize text-text-2">{q.status === "superseded" ? "Replaced" : q.status}</span>
                        <span className="num truncate text-text-2">
                          {formatMoney(q.setupMinor / 100, q.selection.market)} + {formatMoney(q.monthlyMinor / 100, q.selection.market)}/mo
                        </span>
                        <span className="num text-[12px] text-text-3">{tableDate(q.sentAt ?? q.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-[13px] text-text-3">No saved quotes yet. Build the package, then save it.</span>
                )
              ) : tab === "contract" ? (
                <ContractPanel dealId={deal.id} canEdit={isAdmin || (isSeller && deal.ownerId === user.id)} contactEmail={detail.contactEmail ?? null} hasQuote={!!latest} />
              ) : tab === "files" ? (
                <RecordFiles entity="deal" id={deal.id} hint="Proposals, floor plans, the client's brief" />
              ) : tab === "tasks" ? (
                <LinkedTasks type="deal" id={deal.id} compact />
              ) : detail.payments.length ? (
                <div className="flex flex-col">
                  {detail.payments.map((p) => (
                    <div key={p.id} className="flex justify-between border-b border-line-soft py-2.5 text-[13px] last:border-b-0">
                      <span className="capitalize text-text-2">
                        {p.type.replace("_", " ")} · {tableDate(p.paidAt)}
                      </span>
                      <span className="num text-mint">{formatMoney(p.amountMinor / 100, sel.market)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-[13px] text-text-3">No payments yet. The deposit arrives when the client pays from the quote page.</span>
              )}
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-4 xl:sticky xl:top-6">
          <section aria-label="What the client pays" className="card flex flex-col gap-4 p-5">
            <span className="text-[15px] font-semibold">What the client pays</span>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-[12px] text-text-3">Setup, once</span>
                <span className="num text-[26px] font-semibold leading-none text-text">{fmt(r.setup)}</span>
                <span className="text-[12px] text-text-3">{fmt(Math.round(r.setup / 2))} now · rest at launch</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[12px] text-text-3">Every month</span>
                <span className="num text-[26px] font-semibold leading-none text-cyan">{fmt(r.monthly)}</span>
                <span className="text-[12px] text-text-3">{sel.billing === "annual" ? `${fmt(r.monthly * 10)} billed yearly` : sel.pilot && r.monthly ? "First month free" : "From launch"}</span>
              </div>
            </div>
            <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 border-t border-line-soft pt-3 text-[13px]">
              <dt className="text-text-2">First-year value</dt>
              <dd className="num m-0 font-medium">{fmt(r.firstYear)}</dd>
              {r.mins ? (
                <>
                  <dt className="text-text-2">Minutes included</dt>
                  <dd className="num m-0">{r.mins.toLocaleString("en-US")}/mo</dd>
                  <dt className="text-text-2">Extra minutes</dt>
                  <dd className="num m-0">
                    {market.symbol}
                    {sel.overRate.toFixed(2)}/min
                  </dd>
                </>
              ) : null}
            </dl>
            <button type="button" className="flex items-center gap-1.5 self-start text-[13px] text-text-3 hover:text-text" aria-expanded={showMath} onClick={() => setShowMath((x) => !x)}>
              <Icon d={ICONS.chevronRight} size={14} className={`transition-transform ${showMath ? "rotate-90" : ""}`} />
              How the price is built
            </button>
            {showMath ? (
              <div className="overflow-hidden rounded-lg border border-line text-[12px]">
                <div className="grid grid-cols-[minmax(0,1fr)_84px_84px] gap-2 border-b border-line bg-surface-2/60 px-3 py-1.5 text-text-3">
                  <span>Step</span>
                  <span className="text-right">Setup</span>
                  <span className="text-right">Monthly</span>
                </div>
                {[
                  { name: "List prices", ds: r.S0, dm: r.M0, sum: true },
                  ...r.adj.map((a) => ({ ...a, sum: false })),
                  { name: "Client pays (setup rounded to the nearest 10)", ds: r.setup, dm: r.monthly, sum: true },
                ].map((a) => (
                  <div key={a.name} className={`grid grid-cols-[minmax(0,1fr)_84px_84px] gap-2 border-b border-line-soft px-3 py-1.5 last:border-b-0 ${a.sum ? "font-medium text-text" : "text-text-2"}`}>
                    <span>{a.name}</span>
                    <span className="num text-right">{a.ds ? fmt(a.ds) : "—"}</span>
                    <span className="num text-right">{a.dm ? fmt(a.dm) : "—"}</span>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2 border-t border-line-soft pt-3">
              <button
                type="button"
                className="btn-outline"
                onClick={async () => {
                  await navigator.clipboard?.writeText(quoteSummary(r, sel, detail.row.company.name)).catch(() => undefined);
                  toast("Quote text copied", "good");
                }}
              >
                Copy as text
              </button>
              {latest && latest.status !== "draft" ? (
                <>
                  <a href={`/q/${latest.token}?print=1`} target="_blank" rel="noopener" className="btn-outline">
                    PDF ↗
                  </a>
                  <a href={`/q/${latest.token}`} target="_blank" rel="noopener" className="btn-outline">
                    Client page ↗
                  </a>
                </>
              ) : null}
            </div>
            {latest ? <span className="text-[12px] text-text-3">Valid until {tableDate(latest.validUntil)}.</span> : null}
          </section>

          {showInternal ? (
            <section aria-label="Internal only" className="flex flex-col gap-3 rounded-xl border border-dashed border-line-strong p-5 text-[13px]">
              <span className="flex items-center gap-2 text-[13px] font-semibold">
                <Icon d="M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z" size={15} className="text-text-3" />
                Internal only · the client never sees this
              </span>
              <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2">
                <dt className="text-text-2">{user.role === "closer" ? "Closer" : "BDR"} commission</dt>
                <dd className="num m-0">{fmt(r.comm)}</dd>
                {r.hours ? (
                  <>
                    <dt className="text-text-2">Build effort</dt>
                    <dd className="num m-0">{Math.round(r.hours)} h</dd>
                  </>
                ) : null}
                {r.mins ? (
                  <>
                    <dt className="text-text-2">Gross margin on the monthly</dt>
                    <dd className={`num m-0 ${r.margin < 0.5 ? "text-amber" : ""}`}>{Math.round(r.margin * 100)}%</dd>
                  </>
                ) : null}
                <dt className="text-text-2">Extra discount</dt>
                <dd className="m-0">{r.dp ? `${r.dp}%` : "None"}</dd>
              </dl>
              {pendingApproval ? (
                <div className="flex flex-col gap-2 rounded-lg bg-amber-tint px-3 py-2.5 text-amber">
                  <span>
                    {pendingApproval.pct}% extra discount is waiting for the other founder{pendingApproval.note ? `: "${pendingApproval.note}"` : "."}
                  </span>
                  {isAdmin && pendingApproval.requestedBy !== user.id ? (
                    <span className="flex gap-2">
                      <button type="button" className="btn-primary h-8" onClick={() => run(() => data.decideDiscount(pendingApproval.id, true), "Discount approved")}>
                        Approve
                      </button>
                      <button type="button" className="btn-outline h-8" onClick={() => run(() => data.decideDiscount(pendingApproval.id, false), "Discount rejected")}>
                        Reject
                      </button>
                    </span>
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : null}
        </aside>
      </div>

      <Modal open={requesting} onClose={() => setRequesting(false)} title="Ask for a bigger discount">
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

      <Modal open={pending === "lost"} onClose={() => setPending(null)} title={`Mark lost · ${detail.row.company.name}`}>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            move("lost", { lostReason, lostNote: note });
          }}
        >
          <label className="flex flex-col gap-2">
            <span className="field-label">Reason</span>
            <select className="input" value={lostReason} onChange={(e) => setLostReason(e.target.value)}>
              {LOST_REASONS.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2">
            <span className="field-label">Note {lostReason === "Other" ? "" : "(optional)"}</span>
            <input className="input" value={note} required={lostReason === "Other"} onChange={(e) => setNote(e.target.value)} />
          </label>
          <button type="submit" className="btn-danger">
            Mark lost
          </button>
        </form>
      </Modal>

      <Modal open={pending === "won"} onClose={() => setPending(null)} title={`Won without a deposit · ${detail.row.company.name}`}>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            move("won", { overrideReason: note });
          }}
        >
          <p className="m-0 text-[14px] text-text-2">No deposit has been paid. As an admin you can still mark it won; the reason goes in the audit log.</p>
          <label className="flex flex-col gap-2">
            <span className="field-label">Override reason</span>
            <input className="input" required value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Paid by bank transfer, Stripe link not used" />
          </label>
          <button type="submit" className="btn-primary" disabled={!note.trim()}>
            Mark won
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
  return error ? <EmptyState title={error} action={<Link to="/leads" className="btn-outline">Go to leads</Link>} /> : <SkeletonRows rows={4} />;
};

export default DealBuilder;
