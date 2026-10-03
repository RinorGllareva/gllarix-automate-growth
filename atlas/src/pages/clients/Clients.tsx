import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, Route, Routes, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useUser } from "@/auth/AuthContext";
import { usePageChrome } from "@/components/shell/PageChrome";
import { Modal, useToast } from "@/components/ui/overlay";
import { BrandChip, EmptyState, SkeletonRows } from "@/components/ui/primitives";
import { ONBOARDING_STEPS, STATUS_REASONS } from "@/config/clients";
import { data, type ClientCard, type ClientDetail, type ClientsOverview, type TicketRow } from "@/data";
import { DataTable } from "@/components/DataTable";
import RecordFiles from "@/components/RecordFiles";
import { CustomFieldsPanel } from "@/components/CustomFields";
import { ActivityTimeline, InlineSelect, NextStepCard, PropertyRow, RecordPage } from "@/components/record/Record";
import { RowMenu } from "@/components/ui/actions";
import { runJob } from "@/lib/jobs";
import { askAboutHref } from "@/lib/askAbout";
import { canAccess } from "@/lib/nav";
import NewTicket from "@/pages/support/NewTicket";
import { TicketList } from "@/pages/support/Support";
import { downloadText, tableDate } from "@/lib/format";
import { money, monthLabel } from "@/services/billing";

const STATUS_LABEL: Record<ClientCard["status"], string> = { live: "Live", onboarding: "Onboarding", paused: "Paused", churned: "Churned", proposal: "Proposal" };
const RISK = { low: { label: "Low", cls: "text-mint" }, medium: { label: "Medium", cls: "text-amber" }, high: { label: "High", cls: "text-coral" } } as const;

const shortDate = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(iso));
const mrrText = (mrr: ClientsOverview["mrr"]) =>
  mrr ? (Object.entries(mrr) as ["USD" | "EUR", number][]).map(([c, v]) => money(v, c, false)).join(" + ") || "$0" : null;

/** A client card (10_CLIENTS_AND_USAGE.md): name · status · plan · progress bar · mono line. The selected card is ice. */
const Card = ({ card, selected }: { card: ClientCard; selected: boolean }) => {
  const user = useUser();
  // Proposal cards open the deal; roles without Deals see the card without a link (no Forbidden page).
  const linked = card.status !== "proposal" || canAccess(user.role, "deals");
  const cls = `flex flex-col gap-2 border p-4 ${selected ? "border-ice bg-ice text-ice-ink" : "border-line bg-surface hover:border-line-strong"}`;
  const body = (
    <>
    <span className="flex items-center justify-between gap-3">
      <span className="truncate text-[15px]">{card.companyName}</span>
      <span className={`shrink-0 text-[12px] font-medium ${selected ? "" : card.status === "churned" ? "text-text-3" : card.status === "paused" ? "text-amber" : "text-text-2"}`}>{STATUS_LABEL[card.status]}</span>
    </span>
    <span className="truncate text-[12px] opacity-80">{card.plan}</span>
    <span className={`h-[3px] ${selected ? "bg-ice-ink/20" : "bg-line"}`}>
      <span className={`block h-[3px] ${selected ? "bg-ice-ink" : card.over ? "bg-amber" : "bg-cyan"}`} style={{ width: `${Math.round(card.progress * 100)}%` }} />
    </span>
    <span className="num truncate font-mono text-[11px] opacity-80">{card.line}</span>
    </>
  );
  return linked ? (
    <Link to={card.href} aria-current={selected ? "true" : undefined} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls} title="Waiting for the deposit">
      {body}
    </div>
  );
};

/** Contact (founders and the implementer), owner and plan (founders). */
const AccountModal = ({ d, onClose, onSaved }: { d: ClientDetail; onClose: () => void; onSaved: () => void }) => {
  const user = useUser();
  const toast = useToast();
  const admin = user.role === "admin";
  const sub = d.finance?.subscription ?? null;
  const [contact, setContact] = useState(d.contact ?? { firstName: "", lastName: "", title: null, email: null, phone: null });
  const [ownerId, setOwnerId] = useState(d.deal.ownerId ?? "");
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [plan, setPlan] = useState(sub ? { monthly: String(sub.monthlyMinor / 100), included: String(sub.includedMinutes), overage: String(sub.overageRateMinor / 100) } : null);
  useEffect(() => {
    if (admin) data.listUsers().then((u) => setPeople(u.filter((x) => x.active && x.role !== "viewer").map((x) => ({ id: x.id, name: x.name }))), () => setPeople([]));
  }, [admin]);
  return (
    <Modal open onClose={onClose} title={`Account · ${d.companyName}`} width={600}>
      <form
        className="flex flex-col gap-5 text-[13px]"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const planPatch =
              admin && plan && sub
                ? { monthlyMinor: Math.round(Number(plan.monthly) * 100), includedMinutes: Math.round(Number(plan.included)), overageRateMinor: Math.round(Number(plan.overage) * 100) }
                : undefined;
            const planChanged = planPatch && sub && (planPatch.monthlyMinor !== sub.monthlyMinor || planPatch.includedMinutes !== sub.includedMinutes || planPatch.overageRateMinor !== sub.overageRateMinor);
            await data.updateClientAccount(d.client.id, {
              contact,
              ...(admin && ownerId && ownerId !== d.deal.ownerId ? { ownerId } : {}),
              ...(planChanged ? { plan: planPatch } : {}),
            });
            toast(planChanged ? "Saved · the new plan applies from the next invoice" : "Saved", "good");
            onClose();
            onSaved();
          } catch (err) {
            toast((err as Error).message, "error");
          }
        }}
      >
        <fieldset className="grid gap-3 border-0 p-0 sm:grid-cols-2">
          <legend className="mb-2 text-[14px] font-semibold">Main contact</legend>
          <label className="flex flex-col gap-1.5">
            <span className="field-label">First name</span>
            <input className="input" required value={contact.firstName} onChange={(e) => setContact({ ...contact, firstName: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="field-label">Last name</span>
            <input className="input" value={contact.lastName} onChange={(e) => setContact({ ...contact, lastName: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="field-label">Role</span>
            <input className="input" value={contact.title ?? ""} onChange={(e) => setContact({ ...contact, title: e.target.value || null })} placeholder="Owner, office manager…" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="field-label">Phone</span>
            <input className="input" value={contact.phone ?? ""} onChange={(e) => setContact({ ...contact, phone: e.target.value || null })} />
          </label>
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="field-label">Email (reports and support replies go here)</span>
            <input className="input" type="email" value={contact.email ?? ""} onChange={(e) => setContact({ ...contact, email: e.target.value || null })} />
          </label>
        </fieldset>
        {admin ? (
          <label className="flex flex-col gap-1.5">
            <span className="field-label">Account owner</span>
            <select className="input" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              {(people.some((p) => p.id === ownerId) ? people : [{ id: ownerId, name: d.ownerName ?? "Current owner" }, ...people]).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {admin && plan && sub ? (
          <fieldset className="grid gap-3 border-0 p-0 sm:grid-cols-3">
            <legend className="mb-1 text-[14px] font-semibold">Plan</legend>
            <span className="text-[12px] text-text-3 sm:col-span-3">Upgrades and downgrades apply from the next invoice. This month stays on the current terms.</span>
            <label className="flex flex-col gap-1.5">
              <span className="field-label">Monthly ({sub.currency})</span>
              <input className="input" type="number" min={0} step={1} value={plan.monthly} onChange={(e) => setPlan({ ...plan, monthly: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="field-label">Included minutes</span>
              <input className="input" type="number" min={0} step={50} value={plan.included} onChange={(e) => setPlan({ ...plan, included: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="field-label">Per extra minute</span>
              <input className="input" type="number" min={0} step={0.01} value={plan.overage} onChange={(e) => setPlan({ ...plan, overage: e.target.value })} />
            </label>
          </fieldset>
        ) : null}
        <button type="submit" className="btn-primary" disabled={!contact.firstName.trim()}>
          Save
        </button>
      </form>
    </Modal>
  );
};

/** Minutes per day for the month; bars turn amber from the day cumulative use passes the included minutes. */
const UsageChart = ({ d }: { d: ClientDetail }) => {
  const [y, m] = d.period.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const byDate = new Map(d.days.map((x) => [x.date, x.minutes]));
  const bars = Array.from({ length: daysInMonth }, (_, i) => {
    const date = `${d.period}-${String(i + 1).padStart(2, "0")}`;
    return { date, minutes: byDate.get(date) ?? null };
  });
  const max = Math.max(10, ...bars.map((b) => b.minutes ?? 0));
  return (
    <section aria-label="Minutes per day" className="card flex flex-col gap-3 px-5 py-[18px]">
      <div className="flex flex-wrap justify-between gap-2 text-[11px] tracking-[0.22em] text-label">
        <span>Minutes per day</span>
        <span className="num">
          {d.usage.used.toLocaleString("en-US")} USED · {d.usage.included.toLocaleString("en-US")} INCLUDED
        </span>
      </div>
      <div className="flex h-[150px] items-end gap-[3px] border-b border-line" role="img" aria-label={`${d.usage.used} minutes used of ${d.usage.included} included${d.usage.overFrom ? `, over the limit from ${shortDate(d.usage.overFrom)}` : ""}`}>
        {bars.map((b) => (
          <div
            key={b.date}
            title={b.minutes === null ? `${b.date} · no data yet` : `${b.date} · ${b.minutes} min`}
            className={`min-w-0 flex-1 ${b.minutes === null ? "bg-line-soft" : d.usage.overFrom && b.date >= d.usage.overFrom ? "bg-amber" : "bg-cyan"}`}
            style={{ height: b.minutes === null ? 2 : `${Math.max(2, Math.round((b.minutes / max) * 140))}px` }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-5 text-[12px] text-text-2">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 bg-cyan" />
          Included
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 bg-amber" />
          Over the limit{d.usage.overFrom ? ` (from ${shortDate(d.usage.overFrom)})` : ""}
        </span>
      </div>
    </section>
  );
};

const Row = ({ label, value, tone }: { label: string; value: string; tone?: string }) => (
  <div className="flex justify-between gap-4">
    <span className="text-text-2">{label}</span>
    <span className={`num text-right font-mono ${tone ?? ""}`}>{value}</span>
  </div>
);

const StatusModal = ({ d, to, onClose, onDone }: { d: ClientDetail; to: "paused" | "live" | "churned" | null; onClose: () => void; onDone: () => void }) => {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  useEffect(() => {
    setReason("");
    setNote("");
    setError(null);
  }, [to]);
  if (!to) return null;
  const options = to === "churned" ? STATUS_REASONS.churned : to === "paused" ? STATUS_REASONS.paused : [];
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const text = [reason, note.trim()].filter(Boolean).join(" · ");
    try {
      await data.setClientStatus(d.client.id, to, text);
      toast(to === "churned" ? "Client cancelled · final invoice sent" : to === "paused" ? "Client paused · billing stops next period" : "Client resumed");
      onDone();
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const title = to === "churned" ? `Cancel ${d.companyName}` : to === "paused" ? `Pause ${d.companyName}` : `Resume ${d.companyName}`;
  return (
    <Modal open onClose={onClose} title={title}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="m-0 text-[14px] text-text-2">
          {to === "churned"
            ? "Sends a final invoice for this month's overage, stops the subscription, and creates tasks to release the number and export their data. Unearned commissions are clawed back."
            : to === "paused"
              ? "Keeps all data. Billing stops from the next period; usage isn't imported while paused."
              : "Billing restarts from the next period."}
        </p>
        {options.length ? (
          <label className="flex flex-col gap-2">
            <span className="field-label">Reason</span>
            <select className="input" required value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">Choose…</option>
              {options.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="flex flex-col gap-2">
          <span className="field-label">Note{options.length ? " (optional)" : ""}</span>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} required={!options.length} />
        </label>
        {error ? (
          <p role="alert" className="m-0 text-[13px] text-coral">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Back
          </button>
          <button type="submit" className={to === "churned" ? "btn-danger" : "btn-primary"}>
            {to === "churned" ? "Cancel client" : to === "paused" ? "Pause" : "Resume"}
          </button>
        </div>
      </form>
    </Modal>
  );
};

const Onboarding = ({ d, onChange, large = false }: { d: ClientDetail; onChange: () => void; large?: boolean }) => {
  const toast = useToast();
  const user = useUser();
  const nameOf = (id: string | null) => (id === user.id ? "you" : id ? "team" : "automation");
  return (
    <section aria-label={`Onboarding · ${d.companyName}`} className={`flex flex-col gap-2.5 rounded-xl border border-line ${large ? "p-5" : "p-4"}`}>
      <span className="label-caps">Onboarding · {d.companyName}</span>
      {ONBOARDING_STEPS.map((st) => {
        const step = d.onboarding.find((x) => x.key === st.key)!;
        const toggle = async () => {
          try {
            await data.setOnboardingStep(d.client.id, st.key, !step.done);
            if (st.key === "go_live") toast(`${d.companyName} is live · billing started`);
            onChange();
          } catch (err) {
            toast((err as Error).message, "error");
          }
        };
        const label = (
          <>
            <span className="w-4 font-mono">{step.done ? "✓" : "○"}</span>
            <span className="flex-1">
              {st.label}
              {st.auto ? <span className="text-text-3"> · automatic</span> : null}
            </span>
            <span className="num text-[11px] text-text-3">{step.doneAt ? `${shortDate(step.doneAt)} · ${nameOf(step.doneBy)}` : ""}</span>
          </>
        );
        return d.can.onboard && !(st.key === "go_live" && step.done) ? (
          <button key={st.key} type="button" onClick={toggle} className={`flex items-center gap-2.5 text-left text-[13px] hover:text-text ${step.done ? "text-text" : "text-text-2"}`}>
            {label}
          </button>
        ) : (
          <div key={st.key} className={`flex items-center gap-2.5 text-[13px] ${step.done ? "text-text" : "text-text-2"}`}>
            {label}
          </div>
        );
      })}
    </section>
  );
};

/** Support tickets for this client: the open ones lower its health score. */
const ClientTickets = ({ clientId }: { clientId: string }) => {
  const [rows, setRows] = useState<TicketRow[] | null>(null);
  const [creating, setCreating] = useState(false);
  const load = useCallback(() => data.listTickets(clientId).then((r) => setRows(r.tickets), () => setRows([])), [clientId]);
  useEffect(() => {
    load();
  }, [load]);
  if (!rows) return null;
  const open = rows.filter((r) => r.status !== "resolved");
  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-center justify-between">
        <span className="text-[15px] font-semibold">
          Support · {open.length} open{rows.length > open.length ? ` · ${rows.length - open.length} resolved` : ""}
        </span>
        <button type="button" className="btn-outline h-8 text-[12px]" onClick={() => setCreating(true)}>
          + New ticket
        </button>
      </span>
      {rows.length ? <TicketList rows={rows.slice(0, 6)} showClient={false} /> : <span className="text-[13px] text-text-3">No tickets. A quiet client is a happy client, or one who isn't using it: check usage.</span>}
      <NewTicket open={creating} clientId={clientId} onClose={() => setCreating(false)} onCreated={load} />
    </div>
  );
};

const ClientMain = ({ d, onChange, setPeriod }: { d: ClientDetail; onChange: () => void; setPeriod: (p: string) => void }) => {
  const toast = useToast();
  const user = useUser();
  const navigate = useNavigate();
  const [statusTo, setStatusTo] = useState<"paused" | "live" | "churned" | null>(null);
  const [editing, setEditing] = useState(false);
  const f = d.finance;
  const fmt = (minor: number) => (f ? money(minor, f.currency) : "—");
  const sub = f?.subscription ?? null;
  const pilotRate = sub?.pilot && sub.pilotUntil && new Date(sub.pilotUntil).getTime() > Date.now();
  const headline =
    d.client.status === "live"
      ? `Live since ${shortDate(d.client.liveAt!)}${pilotRate || (!f && d.deal.pilot) ? " · pilot rate" : ""}`
      : d.client.status === "paused"
        ? `Paused · live since ${shortDate(d.client.liveAt!)}`
        : d.client.status === "churned"
          ? `Churned ${shortDate(d.client.churnedAt!)} · ${d.client.churnReason ?? ""}`
          : `Onboarding · step ${d.onboarding.filter((x) => x.done).length + 1} of ${ONBOARDING_STEPS.length}`;

  const sendReport = async () => {
    try {
      await data.sendClientReport(d.client.id, d.period);
      toast(`${monthLabel(d.period)} report queued to ${d.contactEmail ?? "the client"}`);
      onChange();
    } catch (err) {
      toast((err as Error).message, "error");
    }
  };

  // The one thing to do on this client now: the next onboarding step, or what the health score flags.
  const nextOnboarding = ONBOARDING_STEPS.find((st) => !d.onboarding.find((x) => x.key === st.key)?.done);
  const step =
    d.client.status === "onboarding"
      ? nextOnboarding
        ? `Onboarding: ${nextOnboarding.label}.`
        : "Every onboarding step is done: go live."
      : d.health && d.health.risk !== "low"
        ? `Churn risk ${RISK[d.health.risk].label.toLowerCase()}: ${d.health.reason}. Call them this week.`
        : null;

  return (
    <section aria-label={`${d.companyName} usage`} className="flex min-w-0 flex-col gap-4">
      <RecordPage
        sideFrom="2xl"
        breadcrumb={[{ label: "Clients", to: "/clients" }, { label: d.companyName }]}
        status={
          <>
            <BrandChip brand={d.deal.brand} />
            <span className="chip border-line-strong text-text-2">{STATUS_LABEL[d.client.status]}</span>
            {d.health ? <span className={`text-[13px] ${RISK[d.health.risk].cls}`}>{RISK[d.health.risk].label} churn risk</span> : null}
          </>
        }
        title={d.companyName}
        actions={
          <>
            {d.can.report && d.client.status !== "onboarding" ? (
              <button type="button" className="btn-outline h-9" onClick={sendReport}>
                Send monthly report
              </button>
            ) : null}
            {user.role === "admin" || user.role === "implementer" ? (
              <button type="button" className="btn-outline h-9" onClick={() => setEditing(true)}>
                Edit account
              </button>
            ) : null}
            <RowMenu
              label="More client actions"
              items={[
                { label: "Ask the AI co-founder about this client", hidden: !canAccess(user.role, "advisor"), onSelect: () => navigate(askAboutHref(`How is ${d.companyName} doing? Look at usage, health, open tickets and invoices, and tell me what to do this month.`)) },
                { label: "Pause", hidden: !(d.can.status && d.client.status === "live"), onSelect: () => setStatusTo("paused") },
                { label: "Resume", hidden: !(d.can.status && d.client.status === "paused"), onSelect: () => setStatusTo("live") },
                { label: "Cancel the client", danger: true, hidden: !d.can.status, onSelect: () => setStatusTo("churned") },
              ]}
            />
          </>
        }
        properties={
          <PropertyRow
            items={[
              { label: "Status", value: headline },
              { label: "Plan", value: d.plan },
              { label: "Sold by", value: d.ownerName ?? "—" },
              { label: "Contact", value: d.contactName ? `${d.contactName}${d.contactEmail ? ` · ${d.contactEmail}` : ""}` : <span className="text-text-3">No contact yet</span> },
              {
                label: "Month",
                hidden: d.client.status === "onboarding",
                value:
                  d.periods.length > 1 ? (
                    <InlineSelect label="Month" value={d.period} options={d.periods.map((p) => ({ value: p, label: monthLabel(p, "long") }))} onChange={setPeriod} />
                  ) : (
                    monthLabel(d.period, "long")
                  ),
              },
            ]}
          />
        }
        tabs={[
          {
            id: "overview",
            label: "Overview",
            content: (
              <div className="flex min-w-0 flex-col gap-4">
      {d.client.status === "onboarding" ? (
        <>
          <Onboarding d={d} onChange={onChange} large />
          <p className="m-0 text-[13px] text-text-2">
            Usage, invoices and health start when the client goes live. The last step starts the Stripe subscription
            {d.deal.pilot ? " with the pilot's first month free" : ""}.
          </p>
        </>
      ) : (
        <>
          {d.usage.metered ? (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  { label: "Calls answered", v: d.kpis.callsAnswered, cls: "text-text" },
                  { label: "After-hours captured", v: d.kpis.afterHours, cls: "text-cyan" },
                  { label: "Jobs booked", v: d.kpis.jobsBooked, cls: "text-mint" },
                  { label: "Missed", v: d.kpis.missed, cls: "text-lavender" },
                ].map((k) => (
                  <div key={k.label} className="card flex flex-col gap-2 p-4">
                    <span className="text-[12px] text-text-3">{k.label}</span>
                    <span className={`num text-[30px] font-light ${k.cls}`}>{k.v.toLocaleString("en-US")}</span>
                  </div>
                ))}
              </div>
              <UsageChart d={d} />
            </>
          ) : (
            <p className="m-0 rounded-xl border border-line p-4 text-[13px] text-text-2">No usage metering for this plan (no AI receptionist minutes). Invoices cover the monthly fee only.</p>
          )}

          <div className="grid gap-3 lg:grid-cols-2">
            {f ? (
              <div className="flex flex-col gap-2 rounded-xl border border-line px-[18px] py-4 text-[13px]">
                {f.next ? (
                  <>
                    <span className="label-caps">Next invoice · {shortDate(f.next.date)}</span>
                    {f.next.lines.length ? f.next.lines.map((l) => <Row key={l.description} label={l.description.replace(/ · [A-Z][a-z]+ \d{4}$/, "")} value={fmt(l.amountMinor)} />) : <span className="text-text-3">Nothing to bill yet.</span>}
                    <div className="flex justify-between border-t border-line pt-2">
                      <span>Total</span>
                      <span className="num font-mono text-cyan">{fmt(f.next.totalMinor)}</span>
                    </div>
                    <span className="text-[11px] text-text-3">Overage so far this month; final at month end.</span>
                  </>
                ) : (
                  <>
                    <span className="label-caps">Invoice · {monthLabel(d.period, "short")}</span>
                    {(() => {
                      const inv = f.invoices.find((i) => i.period === d.period);
                      return inv ? (
                        <>
                          {inv.lines.map((l) => (
                            <Row key={l.description} label={l.description} value={fmt(l.amountMinor)} />
                          ))}
                          <div className="flex justify-between border-t border-line pt-2">
                            <span>Total · {inv.status}</span>
                            <span className="num font-mono text-cyan">{fmt(inv.totalMinor)}</span>
                          </div>
                        </>
                      ) : (
                        <span className="text-text-3">No invoice for this month.</span>
                      );
                    })()}
                  </>
                )}
              </div>
            ) : null}
            <div className="flex flex-col gap-2 rounded-xl border border-line px-[18px] py-4 text-[13px]">
              <span className="label-caps">Health</span>
              {d.costs ? (
                <>
                  <Row label="Our usage cost (est.)" value={money(d.costs.usageCostMinor, f?.currency ?? "USD", false)} />
                  <Row
                    label="Margin after usage"
                    value={d.costs.marginPct === null ? "—" : `${d.costs.marginPct}%`}
                    tone={d.costs.marginPct === null ? "" : d.costs.marginPct >= 60 ? "text-mint" : d.costs.marginPct >= 30 ? "text-amber" : "text-coral"}
                  />
                </>
              ) : null}
              {d.health ? (
                <>
                  <div className="flex justify-between gap-4">
                    <span className="text-text-2">Churn risk</span>
                    <span className={`text-right ${RISK[d.health.risk].cls}`}>
                      {RISK[d.health.risk].label} · {d.health.reason}
                    </span>
                  </div>
                  <span className="num text-[11px] text-text-3">
                    Score {d.health.score} · usage {d.health.parts.usage}/40 · bookings {d.health.parts.bookings}/30 · payment {d.health.parts.payment}/20 · tickets {d.health.parts.tickets}/10
                  </span>
                </>
              ) : (
                <span className="text-text-3">No health score for a {d.client.status} client.</span>
              )}
            </div>
          </div>
        </>
      )}

              </div>
            ),
          },
          ...(canAccess(user.role, "support") && d.client.status !== "onboarding" ? [{ id: "support", label: "Support", content: <ClientTickets clientId={d.client.id} /> }] : []),
          ...(f?.invoices.length || d.reports.length
            ? [
                {
                  id: "billing",
                  label: "Invoices and reports",
                  content: (
                    <>
      {f?.invoices.length || d.reports.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {f?.invoices.length ? (
            <section aria-label="Invoices" className="flex flex-col overflow-hidden rounded-xl border border-line">
              <span className="label-caps border-b border-line px-[18px] py-3">Invoices · Stripe test mode</span>
              {f.invoices.slice(0, 8).map((i) => (
                <div key={i.id} className="flex justify-between gap-3 border-b border-line-soft px-[18px] py-2 text-[13px] last:border-b-0">
                  <span className="text-text-2">
                    {shortDate(i.issuedAt)} · {i.period === "go-live" ? "go-live" : monthLabel(i.period, "short")}
                  </span>
                  <span className="flex gap-3">
                    <span className="num font-mono">{fmt(i.totalMinor)}</span>
                    <span className={i.status === "paid" ? "text-mint" : "text-amber"}>{i.status}</span>
                  </span>
                </div>
              ))}
            </section>
          ) : null}
          {d.reports.length ? (
            <section aria-label="Monthly reports" className="flex flex-col overflow-hidden rounded-xl border border-line">
              <span className="label-caps border-b border-line px-[18px] py-3">Reports sent</span>
              {d.reports.slice(0, 8).map((r) => (
                <div key={r.id} className="flex justify-between gap-3 border-b border-line-soft px-[18px] py-2 text-[13px] last:border-b-0">
                  <span className="text-text-2">
                    {monthLabel(r.period)} · {r.sentBy ? "by hand" : "month-end job"}
                  </span>
                  <a href={`/r/${r.token}`} target="_blank" rel="noopener">
                    Open ↗
                  </a>
                </div>
              ))}
            </section>
          ) : null}
        </div>
      ) : null}
                    </>
                  ),
                },
              ]
            : []),
          {
            id: "tasks",
            label: "Tasks",
            count: d.tasks.filter((t) => !t.doneAt).length || undefined,
            content: d.tasks.length ? (
              <>
      {d.tasks.length ? (
        <section aria-label="Client tasks" className="flex flex-col overflow-hidden rounded-xl border border-line">
          <span className="label-caps border-b border-line px-[18px] py-3">Tasks</span>
          {d.tasks.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-[18px] py-2.5 text-[13px] last:border-b-0">
              <Link to={`/tasks/${t.id}`} className={t.doneAt ? "text-text-3 line-through" : "text-text hover:text-cyan"}>
                {t.title}
              </Link>
              <span className="flex items-center gap-3">
                <span className="num text-[12px] text-text-3">{t.doneAt ? `done ${shortDate(t.doneAt)}` : `due ${tableDate(t.dueAt)}`}</span>
                {!t.doneAt && (user.role === "admin" || t.assigneeId === user.id) ? (
                  <button
                    type="button"
                    className="btn-ghost h-8 text-[11px]"
                    onClick={async () => {
                      await data.completeClientTask(t.id);
                      onChange();
                    }}
                  >
                    Done
                  </button>
                ) : null}
                {!t.doneAt && t.type === "export_data" && (user.role === "admin" || user.role === "implementer") ? (
                  <button
                    type="button"
                    className="btn-ghost h-8 text-[11px]"
                    onClick={async () => downloadText(`${d.companyName.replace(/\W+/g, "-").toLowerCase()}-usage.csv`, await data.exportClientUsage(d.client.id))}
                  >
                    Export CSV
                  </button>
                ) : null}
              </span>
            </div>
          ))}
        </section>
      ) : null}
              </>
            ) : (
              <EmptyState title="No client tasks. Onboarding and automations add them here." />
            ),
          },
          { id: "files", label: "Files", content: <RecordFiles entity="client" id={d.client.id} hint="Signed contracts, onboarding notes, call flows, logos" /> },
          { id: "activity", label: "Activity", content: <ActivityTimeline entity="client" id={d.client.id} reloadKey={d} /> },
        ]}
        side={
          <>
            {step ? <NextStepCard text={step} /> : null}
            <CustomFieldsPanel entity="client" id={d.client.id} canEdit={user.role === "admin" || user.role === "implementer"} title="Client fields" />
          </>
        }
      />
      {editing ? <AccountModal d={d} onClose={() => setEditing(false)} onSaved={onChange} /> : null}

      <StatusModal
        d={d}
        to={statusTo}
        onClose={() => setStatusTo(null)}
        onDone={() => {
          setStatusTo(null);
          onChange();
        }}
      />
    </section>
  );
};

/** /clients and /clients/:id (10_CLIENTS_AND_USAGE.md, mockup Clients.dc.html). */
const ClientsPage = () => {
  const { id } = useParams();
  const user = useUser();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const onlyOnboarding = params.get("status") === "onboarding";
  const [overview, setOverview] = useState<ClientsOverview | null>(null);
  const [detail, setDetail] = useState<ClientDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<string | undefined>(undefined);

  const [q, setQ] = useState("");
  const [asTable, setAsTable] = useState(false);
  const needle = q.trim().toLowerCase();
  const cards = overview?.cards.filter((c) => (!onlyOnboarding || c.status === "onboarding") && (!needle || `${c.companyName} ${c.plan}`.toLowerCase().includes(needle))) ?? [];
  const selectedId = id ?? cards.find((c) => c.status !== "proposal")?.id ?? null;

  const loadOverview = useCallback(async () => {
    try {
      // Billing (usage import, invoices) runs as a job at most every 10 minutes, not on every visit.
      await runJob("billing", 10 * 60_000, () => data.runBillingJobs());
      setOverview(await data.clientsOverview());
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  // The left column shows the next onboarding checklist when another client is selected (mockup).
  const sideId = overview?.cards.find((c) => c.status === "onboarding" && c.id !== selectedId)?.id ?? null;
  const [sideOnboarding, setSideOnboarding] = useState<ClientDetail | null>(null);
  useEffect(() => {
    if (!sideId || (detail && detail.client.status === "onboarding")) return setSideOnboarding(null);
    data.getClient(sideId).then(setSideOnboarding, () => setSideOnboarding(null));
  }, [sideId, overview, detail]);

  const loadDetail = useCallback(async () => {
    if (!selectedId) return setDetail(null);
    try {
      setDetail(await data.getClient(selectedId, period));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [selectedId, period]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);
  useEffect(() => {
    if (overview) loadDetail();
  }, [overview, loadDetail]);
  useEffect(() => setPeriod(undefined), [selectedId]);

  const mrr = mrrText(overview?.mrr ?? null);
  usePageChrome({
    context: overview
      ? [`${overview.count} clients`, mrr ? `MRR ${mrr}` : null, overview.nextInvoiceAt && mrr ? `Next invoice ${shortDate(overview.nextInvoiceAt)}` : null].filter(Boolean).join(" · ")
      : "Clients",
    action: { label: "Onboarding", to: "/clients?status=onboarding" },
  });

  const refresh = () => {
    loadOverview();
  };

  if (error) return <EmptyState title={error} />;
  if (!overview) return <SkeletonRows rows={8} />;

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <section aria-label="Clients" className="flex min-w-0 flex-col gap-3">
        <h1 className="page-title m-0 mb-1.5">Clients</h1>
        <div className="flex items-center gap-2">
          <input type="search" className="input h-9 min-w-0 flex-1" placeholder="Find a client" aria-label="Find a client" value={q} onChange={(e) => setQ(e.target.value)} />
          <button type="button" className="btn-ghost h-9 text-[12px]" aria-pressed={asTable} onClick={() => setAsTable((x) => !x)}>
            {asTable ? "Cards" : "Table"}
          </button>
        </div>
        {onlyOnboarding ? (
          <button type="button" className="btn-ghost self-start text-[11px]" onClick={() => setParams({})}>
            Onboarding only · show all
          </button>
        ) : null}
        {cards.length && asTable ? (
          <DataTable<ClientCard>
            id="clients"
            label="Clients"
            variant="plain"
            rows={cards}
            rowKey={(c) => c.id}
            onOpen={(c) => (c.status !== "proposal" || canAccess(user.role, "deals") ? navigate(c.href) : undefined)}
            focusedKey={selectedId ?? undefined}
            columns={[
              { key: "name", header: "Client", width: "minmax(0,1.4fr)", sortValue: (c) => c.companyName, render: (c) => <span className="block truncate">{c.companyName}</span> },
              { key: "status", header: "Status", width: "92px", sortValue: (c) => c.status, render: (c) => <span className="text-[12px] text-text-2">{STATUS_LABEL[c.status]}</span> },
              { key: "use", header: "Use", width: "56px", align: "right", sortValue: (c) => c.progress, render: (c) => <span className={`num text-[12px] ${c.over ? "text-amber" : ""}`}>{Math.round(c.progress * 100)}%</span> },
            ]}
          />
        ) : cards.length ? cards.map((c) => <Card key={c.id} card={c} selected={c.id === selectedId} />) : needle ? <EmptyState title="No client matches." /> : <EmptyState title={onlyOnboarding ? "Nobody is onboarding right now." : "No clients yet. A paid deposit turns a won deal into a client."} />}
        {sideOnboarding ? <Onboarding d={sideOnboarding} onChange={refresh} /> : null}
      </section>
      {detail && detail.client.id === selectedId ? (
        <ClientMain
          d={detail}
          onChange={() => {
            refresh();
          }}
          setPeriod={setPeriod}
        />
      ) : selectedId ? (
        <SkeletonRows rows={6} />
      ) : null}
    </div>
  );
};

const ClientsModule = () => (
  <Routes>
    <Route index element={<ClientsPage />} />
    <Route path=":id" element={<ClientsPage />} />
  </Routes>
);

export default ClientsModule;
