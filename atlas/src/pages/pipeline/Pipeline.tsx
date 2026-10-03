import { useCallback, useEffect, useMemo, useState, type DragEvent, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { useUser } from "@/auth/AuthContext";
import { usePageChrome } from "@/components/shell/PageChrome";
import { Modal, useToast } from "@/components/ui/overlay";
import { Avatar, EmptyState, Pill, SkeletonRows } from "@/components/ui/primitives";
import { BRAND_HUE, DEAL_STAGE_HUE, hueTint, hueVar } from "@/config/colors";
import { LOST_REASONS } from "@/config/targets";
import { BDR_MAX_STAGE, data, DEAL_STAGE_LABEL, DEAL_STAGES, type DealRow, type DealStage, type PipelineQuery, type User } from "@/data";
import { localHHMM } from "@/services/time";

const BOARD: DealStage[] = DEAL_STAGES.filter((s) => s !== "lost");
const STALE_DAYS = 14;

const money = (minor: number, currency: "USD" | "EUR") => `${currency === "USD" ? "$" : "€"}${Math.round(minor / 100).toLocaleString("en-US")}`;
const short = (minor: number, currency: "USD" | "EUR") => {
  const v = minor / 100;
  const sym = currency === "USD" ? "$" : "€";
  return v >= 1000 ? `${sym}${(v / 1000).toFixed(1)}K` : `${sym}${Math.round(v)}`;
};

/** Per-currency sum, e.g. "$3.0K + €3.3K". */
const sumText = (rows: DealRow[], field: "setupMinor" | "monthlyMinor", fmt = short) => {
  const by = { USD: 0, EUR: 0 };
  rows.forEach((r) => (by[r.deal.currency] += r.deal[field]));
  const parts = (["USD", "EUR"] as const).filter((c) => by[c] > 0).map((c) => fmt(by[c], c));
  return parts.length ? parts.join(" + ") : "—";
};

const daysIn = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

type PendingMove = { row: DealRow; stage: "won" | "lost" } | null;

const Pipeline = () => {
  const user = useUser();
  const toast = useToast();
  const canMove = ["admin", "bdr", "closer"].includes(user.role);
  const isAdmin = user.role === "admin";
  const [query, setQuery] = useState<PipelineQuery>({ brand: "both", ownerId: "all", allWon: false });
  const [rows, setRows] = useState<DealRow[] | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingMove>(null);
  const [reason, setReason] = useState<string>(LOST_REASONS[0]);
  const [note, setNote] = useState("");
  const [dragOver, setDragOver] = useState<DealStage | null>(null);

  const load = useCallback(() => {
    setError(null);
    data
      .pipeline(query)
      .then(setRows)
      .catch((e: Error) => setError(e.message));
  }, [query]);
  useEffect(load, [load]);
  useEffect(() => {
    data.listUsers().then(setUsers);
  }, []);

  const open = useMemo(() => (rows ?? []).filter((r) => r.deal.stage !== "won"), [rows]);
  usePageChrome({
    context: `Open pipeline · ${sumText(open, "setupMinor")} setup`,
    action: canMove ? { label: "New deal", to: "/deals/new" } : undefined,
  });

  const allowedTarget = (row: DealRow, stage: DealStage) => {
    if (!canMove) return false;
    if (isAdmin) return true;
    if (row.deal.ownerId !== user.id || row.deal.stage === "won") return false;
    return stage === "lost" || DEAL_STAGES.indexOf(stage) <= DEAL_STAGES.indexOf(BDR_MAX_STAGE);
  };

  const move = async (row: DealRow, stage: DealStage, extra: { lostReason?: string; lostNote?: string; overrideReason?: string } = {}) => {
    if (row.deal.stage === stage) return;
    if (!allowedTarget(row, stage)) {
      toast(stage === "won" || DEAL_STAGES.indexOf(stage) > DEAL_STAGES.indexOf(BDR_MAX_STAGE) ? "BDRs can move deals up to Proposal sent." : "You can't move this deal.", "error");
      return;
    }
    if (stage === "lost" && !extra.lostReason) return setPending({ row, stage: "lost" });
    if (stage === "won" && !row.deal.depositPaid && !extra.overrideReason) {
      if (!isAdmin) return toast("Won needs a paid deposit. An admin can override with a reason.", "error");
      return setPending({ row, stage: "won" });
    }
    try {
      await data.moveDeal(row.deal.id, { stage, ...extra });
      toast(`${row.company.name} → ${DEAL_STAGE_LABEL[stage]}`, "good");
      setPending(null);
      setNote("");
      load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const onDrop = (stage: DealStage) => (e: DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    const row = rows?.find((r) => r.deal.id === e.dataTransfer.getData("text/plain"));
    if (row) move(row, stage);
  };

  /** Arrows move focus between cards; Shift + ←/→ moves the card one stage. */
  const onCardKey = (row: DealRow) => (e: KeyboardEvent<HTMLElement>) => {
    const col = BOARD.indexOf(row.deal.stage);
    if (e.shiftKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      e.preventDefault();
      const next = BOARD[col + (e.key === "ArrowRight" ? 1 : -1)];
      if (next) move(row, next);
      return;
    }
    const focus = (selector: string) => document.querySelector<HTMLElement>(selector)?.focus();
    const cards = Array.from(document.querySelectorAll<HTMLElement>(`[data-col="${row.deal.stage}"] [data-card]`));
    const i = cards.findIndex((c) => c.dataset.card === row.deal.id);
    if (e.key === "ArrowDown") cards[i + 1]?.focus();
    else if (e.key === "ArrowUp") cards[i - 1]?.focus();
    else if (e.key === "ArrowRight" && BOARD[col + 1]) focus(`[data-col="${BOARD[col + 1]}"] [data-card]`);
    else if (e.key === "ArrowLeft" && BOARD[col - 1]) focus(`[data-col="${BOARD[col - 1]}"] [data-card]`);
    else return;
    e.preventDefault();
  };

  if (error) return <EmptyState title={error} action={<button className="btn-outline" type="button" onClick={load}>Retry</button>} />;
  if (!rows) return <SkeletonRows rows={8} />;

  const month = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: user.timezone }).format(new Date());
  const owners = users.filter((u) => ["admin", "bdr", "closer"].includes(u.role) && u.active);

  return (
    <div className="flex h-[calc(100vh-72px-4rem)] min-h-[480px] flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-4">
        <h1 className="page-title m-0">Pipeline</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div role="radiogroup" aria-label="Brand" className="flex border border-line-strong">
            {(["both", "gllarix", "arcadian"] as const).map((b) => (
              <button
                key={b}
                type="button"
                role="radio"
                aria-checked={query.brand === b}
                onClick={() => setQuery({ ...query, brand: b })}
                className={`h-8 px-3 text-[12px] font-medium ${query.brand === b ? "bg-ice text-ice-ink" : "text-text-2 hover:bg-surface-2 hover:text-text"}`}
              >
                {b === "both" ? "Both brands" : b}
              </button>
            ))}
          </div>
          {isAdmin || user.role === "viewer" ? (
            <select aria-label="Owner" className="input h-9 w-44" value={query.ownerId} onChange={(e) => setQuery({ ...query, ownerId: e.target.value })}>
              <option value="all">Every owner</option>
              {owners.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </div>
      {!canMove ? <span className="text-[12px] text-text-3">Read-only for your role.</span> : null}

      <div className="flex min-h-0 flex-1 gap-2.5 overflow-x-auto pb-1">
        {BOARD.map((stage) => {
          const cards = rows.filter((r) => r.deal.stage === stage).sort((a, b) => b.deal.setupMinor - a.deal.setupMinor);
          const won = stage === "won";
          const hue = DEAL_STAGE_HUE[stage];
          return (
            <section
              key={stage}
              data-col={stage}
              aria-label={DEAL_STAGE_LABEL[stage]}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(stage);
              }}
              onDragLeave={() => setDragOver((d) => (d === stage ? null : d))}
              onDrop={onDrop(stage)}
              className="flex h-full w-[216px] shrink-0 flex-col overflow-hidden rounded-lg bg-surface"
              style={{ borderTop: `3px solid ${hueVar(hue)}`, boxShadow: dragOver === stage ? `inset 0 0 0 1px ${hueVar(hue)}` : undefined }}
            >
              <div className="flex shrink-0 flex-col gap-0.5 px-3 py-2" style={{ background: hueTint(hue, 12) }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[12px] font-medium" style={{ color: hueVar(hue) }}>
                    {won ? `Won · ${query.allWon ? "all" : month}` : DEAL_STAGE_LABEL[stage]}
                  </span>
                  <span className="min-w-6 px-1.5 text-center font-mono text-[11px]" style={{ background: hueTint(hue, 22), color: hueVar(hue) }}>
                    {cards.length}
                  </span>
                </div>
                <span className="font-mono text-[11px] text-text-2">{won ? `MRR ${sumText(cards, "monthlyMinor", money)}` : sumText(cards, "setupMinor")}</span>
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-1.5">
                {cards.map((r) => {
                  const age = daysIn(r.deal.stageChangedAt);
                  const tz = r.company.timezone ?? user.timezone;
                  const stale = !won && !r.nextMeetingAt && age > STALE_DAYS;
                  const meta = won
                    ? r.deal.depositPaid
                      ? "Deposit paid"
                      : "No deposit"
                    : r.nextMeetingAt
                      ? `${new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: tz }).format(new Date(r.nextMeetingAt))} ${localHHMM(new Date(r.nextMeetingAt), tz)}`
                      : `${age}d in stage`;
                  return (
                    <article
                      key={r.deal.id}
                      data-card={r.deal.id}
                      tabIndex={0}
                      draggable={canMove && (isAdmin || (r.deal.ownerId === user.id && r.deal.stage !== "won"))}
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", r.deal.id)}
                      onKeyDown={onCardKey(r)}
                      aria-label={`${r.company.name}, ${DEAL_STAGE_LABEL[stage]}. Shift and arrow keys move it.`}
                      className="group flex shrink-0 flex-col gap-1.5 rounded-md bg-surface-2 px-2.5 py-2 shadow-card outline-none hover:bg-[color-mix(in_srgb,var(--surface-2)_70%,var(--line-strong))] focus-visible:outline focus-visible:outline-1 focus-visible:outline-cyan"
                    >
                      <Link to={`/deals/${r.deal.id}`} className="truncate text-[13px] font-medium leading-tight hover:text-cyan" draggable={false} title={r.company.name}>
                        {r.company.name}
                      </Link>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-mono text-[12px] text-text">{money(r.deal.setupMinor, r.deal.currency)}</span>
                        <span className="font-mono text-[11px] text-text-3">+{money(r.deal.monthlyMinor, r.deal.currency)}/mo</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Pill hue={BRAND_HUE[r.deal.brand]} className="h-[18px] px-1.5 text-[10px]">
                          {r.deal.brand === "gllarix" ? "Gllarix" : "Arcadian"}
                        </Pill>
                        {r.deal.pilot ? (
                          <Pill hue="lime" className="h-[18px] px-1.5 text-[10px]">
                            Pilot
                          </Pill>
                        ) : null}
                      </div>
                      <div className="flex items-center justify-between gap-2 pt-0.5 text-[11px]">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <Avatar id={r.deal.ownerId} name={r.ownerName ?? "Unassigned"} size={18} />
                          <span className={`truncate font-mono ${stale ? "text-amber" : r.nextMeetingAt ? "text-blue" : "text-text-3"}`}>{meta}</span>
                        </span>
                        {canMove && !won && allowedTarget(r, "lost") ? (
                          <button type="button" className="text-[11px] text-text-3 opacity-0 hover:text-coral focus:opacity-100 group-hover:opacity-100" onClick={() => move(r, "lost")}>
                            Lost
                          </button>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
                {!cards.length ? <span className="px-1 py-3 text-[12px] text-text-3">No deals</span> : null}
              </div>
              {won ? (
                <button type="button" className="btn-ghost m-3 shrink-0" onClick={() => setQuery({ ...query, allWon: !query.allWon })}>
                  {query.allWon ? "This month only" : "See earlier months"}
                </button>
              ) : null}
            </section>
          );
        })}
        {canMove ? (
          <section
            aria-label="Lost"
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver("lost");
            }}
            onDragLeave={() => setDragOver((d) => (d === "lost" ? null : d))}
            onDrop={onDrop("lost")}
            className="flex h-full w-[120px] shrink-0 items-center justify-center rounded-lg border border-dashed text-center text-[12px]"
            style={{ borderColor: hueVar("coral"), color: hueVar("coral"), background: dragOver === "lost" ? hueTint("coral", 18) : hueTint("coral", 6) }}
          >
            Drop here to mark lost
          </section>
        ) : null}
      </div>
      <span className="shrink-0 text-[11px] text-text-3">
        Drag cards between stages, or focus a card and press Shift + ← / →. Deals older than {STALE_DAYS} days in a stage show their age in amber. Values come from each deal's
        latest quote, or list prices from the price book until it has one.
      </span>

      <Modal open={pending?.stage === "lost"} onClose={() => setPending(null)} title={`Lost · ${pending?.row.company.name ?? ""}`}>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (pending) move(pending.row, "lost", { lostReason: reason, lostNote: note });
          }}
        >
          <label className="flex flex-col gap-2">
            <span className="field-label">Reason</span>
            <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
              {LOST_REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2">
            <span className="field-label">Note {reason === "Other" ? "" : "(optional)"}</span>
            <input className="input" value={note} required={reason === "Other"} onChange={(e) => setNote(e.target.value)} />
          </label>
          <button type="submit" className="btn-danger">
            Mark lost
          </button>
        </form>
      </Modal>

      <Modal open={pending?.stage === "won"} onClose={() => setPending(null)} title={`Won without a deposit · ${pending?.row.company.name ?? ""}`}>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (pending) move(pending.row, "won", { overrideReason: note });
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

export default Pipeline;
