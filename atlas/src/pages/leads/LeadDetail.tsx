import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useUser } from "@/auth/AuthContext";
import { usePageChrome } from "@/components/shell/PageChrome";
import { useToast } from "@/components/ui/overlay";
import { BrandChip, EmptyState, SkeletonRows } from "@/components/ui/primitives";
import { COUNTRY_RULES } from "@/config/countryRules";
import { countryLabel, industryLabel, LIST_LABEL, STAGE_LABEL, STAGES, type Stage } from "@/config/leads";
import { SCORING, SIGNAL_LABEL } from "@/config/scoring";
import { AccessError, data, type Activity, type ActivityType, type LeadDetail as Detail, type User, type DealRow, DEAL_STAGE_LABEL } from "@/data";
import { localTime, tableDate, timelineDate } from "@/lib/format";
import { Forbidden } from "@/pages/StatusPages";
import EmailCompose from "@/components/EmailCompose";
import LinkedTasks from "@/components/LinkedTasks";
import OfferPrices from "@/components/OfferPrices";

/** Deals tab: this lead's deals, linking into the deal builder. */
const LeadDeals = ({ leadId }: { leadId: string }) => {
  const [rows, setRows] = useState<DealRow[] | null>(null);
  useEffect(() => {
    data
      .listDeals()
      .then((all) => setRows(all.filter((r) => r.lead.id === leadId)))
      .catch(() => setRows([]));
  }, [leadId]);
  if (!rows) return <SkeletonRows rows={2} />;
  return (
    <div className="flex flex-col gap-3">
      {rows.map((r) => (
        <Link key={r.deal.id} to={`/deals/${r.deal.id}`} className="card flex items-center justify-between gap-4 px-4 py-3 text-[13px] hover:bg-surface-2">
          <span className="flex items-center gap-3">
            <BrandChip brand={r.deal.brand} />
            {DEAL_STAGE_LABEL[r.deal.stage]}
            {r.deal.pilot ? " · pilot" : ""}
          </span>
          <span className="num text-text-2">
            {r.deal.currency === "USD" ? "$" : "€"}
            {Math.round(r.deal.setupMinor / 100).toLocaleString("en-US")} + {Math.round(r.deal.monthlyMinor / 100).toLocaleString("en-US")}/mo
          </span>
        </Link>
      ))}
      {rows.length ? null : <EmptyState title="No deals for this lead yet." />}
      <Link to={`/deals/new?lead=${leadId}`} className="btn-outline self-start text-[11px]">
        Create deal
      </Link>
    </div>
  );
};

const TABS = ["timeline", "contacts", "signals", "deals", "tasks", "files"] as const;
type Tab = (typeof TABS)[number];

const DOT: Record<ActivityType, string> = {
  call: "bg-cyan",
  email: "bg-cyan",
  linkedin: "bg-cyan",
  meeting: "bg-ice",
  sms: "bg-cyan",
  note: "bg-text-2",
  stage_change: "bg-lavender",
  owner_change: "bg-lavender",
  score_change: "bg-mint",
  signal: "bg-amber",
  created: "bg-text-3",
};

const TYPE_FILTERS: { label: string; types: ActivityType[] }[] = [
  { label: "All", types: [] },
  { label: "Calls", types: ["call"] },
  { label: "Notes", types: ["note"] },
  { label: "Changes", types: ["stage_change", "owner_change", "score_change"] },
  { label: "Created", types: ["created"] },
];

const SideCard = ({ title, children, surface }: { title: string; children: ReactNode; surface?: boolean }) => (
  <section aria-label={title} className={`flex flex-col gap-2.5 border border-line px-[18px] py-4 ${surface ? "bg-surface" : ""}`}>
    <span className="label-caps">{title}</span>
    {children}
  </section>
);

const Timeline = ({ detail, users, tz, onNote }: { detail: Detail; users: User[]; tz: string; onNote: (text: string) => Promise<void> }) => {
  const [filter, setFilter] = useState(0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const types = TYPE_FILTERS[filter].types;
  const items = detail.activities.filter((a) => !types.length || types.includes(a.type));
  const who = (a: Activity) => users.find((u) => u.id === a.userId)?.name;

  return (
    <section aria-label="Timeline" className="flex flex-col">
      <form
        className="flex flex-col gap-2 pb-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!note.trim()) return;
          setBusy(true);
          await onNote(note);
          setNote("");
          setBusy(false);
        }}
      >
        <label className="sr-only" htmlFor="lead-note">
          Add a note
        </label>
        <textarea
          id="lead-note"
          rows={2}
          placeholder="Add a note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="input h-auto min-h-[60px] resize-y py-2.5"
        />
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by type">
            {TYPE_FILTERS.map((f, i) => (
              <button
                key={f.label}
                type="button"
                aria-pressed={filter === i}
                onClick={() => setFilter(i)}
                className={`h-7 border px-2.5 text-[12px] ${filter === i ? "border-ice bg-ice text-ice-ink" : "border-line-strong text-text-2 hover:text-text"}`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button type="submit" className="btn-outline h-9 text-[11px]" disabled={busy || !note.trim()}>
            Add note
          </button>
        </div>
      </form>
      {items.length ? (
        items.map((a) => (
          <div key={a.id} className="grid grid-cols-[70px_18px_1fr] gap-3 border-b border-line-soft py-3">
            <span className="font-mono text-[12px] text-text-3">{timelineDate(a.at, tz)}</span>
            <span className={`mt-[5px] h-2 w-2 ${DOT[a.type]}`} aria-hidden="true" />
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[14px]">{a.title}</span>
              {a.detail || who(a) ? (
                <span className="whitespace-pre-line text-[12px] text-text-2">
                  {[a.detail, a.type !== "note" ? who(a) : null].filter(Boolean).join(" · ")}
                </span>
              ) : null}
            </div>
          </div>
        ))
      ) : (
        <p className="m-0 py-4 text-[14px] text-text-2">Nothing of this type yet.</p>
      )}
    </section>
  );
};

const Contacts = ({ detail, onChanged }: { detail: Detail; onChanged: () => void }) => {
  const toast = useToast();
  const act = async (fn: () => Promise<void>, msg: string) => {
    try {
      await fn();
      toast(msg, "good");
      onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  if (!detail.contacts.length) return <EmptyState title="No contacts yet. Contacts come from imports and enrichment." />;
  const cols = "grid-cols-[1.2fr_1.2fr_1.6fr_1.1fr_90px_150px]";
  return (
    <div className="card overflow-x-auto">
      <div className={`grid ${cols} min-w-[820px] gap-3 border-b border-line px-4 py-3 text-[10px] uppercase tracking-[0.2em] text-text-3 bg-surface-2`}>
        <span>Name</span>
        <span>Role</span>
        <span>Email</span>
        <span>Phone</span>
        <span>Decides</span>
        <span />
      </div>
      {detail.contacts.map((c) => {
        const primary = c.id === detail.lead.primaryContactId;
        return (
          <div key={c.id} className={`grid ${cols} min-w-[820px] items-center gap-3 border-b border-line-soft px-4 py-3 text-[13px] last:border-b-0`}>
            <span>
              {c.firstName} {c.lastName}
              {primary ? <span className="ml-2 text-[10px] uppercase tracking-[0.18em] text-cyan">Primary</span> : null}
              {detail.lead.suppressed ? <span className="ml-2 text-[10px] uppercase tracking-[0.18em] text-coral">Opt-out</span> : null}
            </span>
            <span className="text-text-2">{c.title ?? "—"}</span>
            <span className="flex min-w-0 flex-col">
              <span className={`truncate ${c.emailStatus === "invalid" ? "text-text-3 line-through" : ""}`}>{c.email ?? "—"}</span>
              {c.email ? <span className={`text-[11px] ${c.emailStatus === "valid" ? "text-mint" : c.emailStatus === "invalid" ? "text-coral" : "text-text-3"}`}>{c.emailStatus === "valid" ? "Verified" : c.emailStatus === "invalid" ? "Invalid" : "Not verified"}</span> : null}
            </span>
            <span className="flex flex-col">
              <span className={`font-mono text-[12px] ${c.phoneInvalid ? "text-text-3 line-through" : ""}`}>{c.phone ?? detail.company.phone ?? "—"}</span>
              <span className="text-[11px] text-text-3">
                {c.phone ? c.phoneType : "Company line"}
                {c.phoneVerified ? " · verified" : ""}
              </span>
            </span>
            <span className={c.isDecisionMaker ? "text-mint" : "text-text-3"}>{c.isDecisionMaker ? "Yes" : "No"}</span>
            <span className="flex flex-wrap gap-x-3 gap-y-1">
              {!primary ? (
                <button type="button" className="btn-ghost" onClick={() => act(() => data.setPrimaryContact(detail.lead.id, c.id), "Primary contact changed")}>
                  Make primary
                </button>
              ) : null}
              {c.email ? (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => act(() => data.markContact(c.id, { emailInvalid: c.emailStatus !== "invalid" }), c.emailStatus === "invalid" ? "Email restored" : "Email marked invalid")}
                >
                  {c.emailStatus === "invalid" ? "Email OK" : "Email bad"}
                </button>
              ) : null}
              <button
                type="button"
                className="btn-ghost"
                onClick={() => act(() => data.markContact(c.id, { phoneInvalid: !c.phoneInvalid }), c.phoneInvalid ? "Phone restored" : "Phone marked invalid")}
              >
                {c.phoneInvalid ? "Phone OK" : "Phone bad"}
              </button>
            </span>
          </div>
        );
      })}
    </div>
  );
};

/** Admin: GDPR access (export) and erasure for this lead's people. */
const GdprActions = ({ leadId, erased, onDone }: { leadId: string; erased: boolean; onDone: () => void }) => {
  const toast = useToast();
  const exportData = async () => {
    try {
      const json = await data.exportPersonalData(leadId);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
      a.download = `atlas-personal-data-${leadId}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const erase = async () => {
    const reason = window.prompt("Erase this lead's personal data? Names, emails, phones, notes and email bodies are removed for good; the identifiers go on the opt-out list. Record the request (date and channel):");
    if (!reason?.trim()) return;
    try {
      await data.erasePersonalData(leadId, reason);
      toast("Personal data erased", "good");
      onDone();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      <button type="button" className="btn-ghost h-8 text-[12px]" onClick={exportData}>
        Export personal data
      </button>
      {!erased ? (
        <button type="button" className="btn-ghost h-8 text-[12px] text-coral" onClick={erase}>
          Erase personal data
        </button>
      ) : null}
    </div>
  );
};

/** Lead detail › Re-enrich: audits the website now (M8) and rescores. */
const ReEnrich = ({ detail, onChanged }: { detail: Detail; onChanged: () => void }) => {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!detail.company.domain) return <span className="text-[12px] text-text-3">No website on file, so there's nothing to audit.</span>;
  return (
    <button
      type="button"
      className="btn-outline h-9 self-start text-[11px]"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const r = await data.enrichLead(detail.lead.id);
          toast(`Website audited · ${r.summary}`, "good");
          onChanged();
        } catch (e) {
          toast((e as Error).message, "error");
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Auditing…" : `Re-enrich · audit ${detail.company.domain}`}
    </button>
  );
};

const Signals = ({ detail, onChanged }: { detail: Detail; onChanged: () => void }) => (
  <div className="flex flex-col gap-3">
    <ReEnrich detail={detail} onChanged={onChanged} />
    <SignalsTable detail={detail} />
  </div>
);

const SignalsTable = ({ detail }: { detail: Detail }) => {
  if (!detail.signals.length) return <EmptyState title="No signals yet. Re-enrich audits the website and adds them." />;
  const rules = SCORING.models[detail.lead.listType];
  const fired = new Set(detail.lead.scoreBreakdown.map((l) => l.ruleId));
  const cols = "grid-cols-[1.8fr_80px_1fr_100px_100px_60px]";
  return (
    <div className="card overflow-x-auto">
      <div className={`grid ${cols} min-w-[680px] gap-3 border-b border-line px-4 py-3 text-[10px] uppercase tracking-[0.2em] text-text-3 bg-surface-2`}>
        <span>Signal</span>
        <span>Value</span>
        <span>Source</span>
        <span>Observed</span>
        <span>Expires</span>
        <span>Points</span>
      </div>
      {detail.signals.map((g) => {
        const rule = rules.find((r) => "signal" in r.when && r.when.signal === g.key);
        const expiresAt = g.expiresAt ?? (rule?.expiresDays ? new Date(new Date(g.observedAt).getTime() + rule.expiresDays * 86_400_000).toISOString() : null);
        const expired = expiresAt ? new Date(expiresAt) < new Date() : false;
        const counts = rule && fired.has(rule.id);
        return (
          <div key={g.id} className={`grid ${cols} min-w-[680px] items-center gap-3 border-b border-line-soft px-4 py-3 text-[13px] last:border-b-0 ${expired ? "opacity-50" : ""}`}>
            <span>{SIGNAL_LABEL[g.key] ?? g.key}</span>
            <span className="font-mono text-[12px]">{typeof g.value === "boolean" ? (g.value ? "Yes" : "No") : String(g.value)}</span>
            <span className="text-text-2">{g.source}</span>
            <span className="num text-[12px] text-text-2">{tableDate(g.observedAt)}</span>
            <span className="num text-[12px] text-text-2">{expiresAt ? tableDate(expiresAt) : "—"}</span>
            <span className={`num ${counts ? ((rule?.points ?? 0) < 0 ? "text-coral" : "text-mint") : "text-text-3"}`}>
              {counts && rule?.points ? `${rule.points > 0 ? "+" : ""}${rule.points}` : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
};

const LeadDetailPage = () => {
  const { id = "" } = useParams();
  const user = useUser();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const tab: Tab = (TABS as readonly string[]).includes(params.get("tab") ?? "") ? (params.get("tab") as Tab) : "timeline";
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<AccessError | Error | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [composing, setComposing] = useState(false);

  const [dealCount, setDealCount] = useState<number | undefined>(undefined);
  const load = useCallback(() => {
    data
      .getLead(id)
      .then((d) => {
        setDetail(d);
        setError(null);
      })
      .catch(setError);
    data
      .listDeals()
      .then((all) => setDealCount(all.filter((r) => r.lead.id === id).length))
      .catch(() => setDealCount(undefined));
  }, [id]);

  useEffect(load, [load]);
  useEffect(() => {
    data.listUsers().then(setUsers);
  }, []);

  usePageChrome(detail ? { context: `Leads / ${detail.company.name}`, action: { label: "Create deal", to: `/deals/new?lead=${detail.lead.id}` } } : null);

  if (error instanceof AccessError && error.status === 403) return <Forbidden />;
  if (error instanceof AccessError && error.status === 404)
    return <EmptyState title="This lead doesn't exist, or it was removed by an undone import." action={<Link className="btn-outline" to="/leads">Back to leads →</Link>} />;
  if (error)
    return (
      <div className="flex items-center gap-4 text-[14px] text-coral">
        {error.message}
        <button type="button" className="btn-outline h-9" onClick={load}>
          Retry
        </button>
      </div>
    );
  if (!detail) return <SkeletonRows rows={6} />;

  const { lead, company } = detail;
  const isAdmin = user.role === "admin";
  const rule = company.country ? COUNTRY_RULES[company.country] : undefined;
  const owners = users.filter((u) => ["admin", "bdr", "closer"].includes(u.role) && u.active);

  const update = async (patch: { stage?: Stage; ownerId?: string | null }, msg: string) => {
    try {
      await data.updateLead(lead.id, patch);
      toast(msg, "good");
      load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const tabCount: Partial<Record<Tab, number>> = { contacts: detail.contacts.length, signals: detail.signals.length, deals: dealCount };

  return (
    <div className="flex flex-col gap-[22px]">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-2.5">
          <div className="flex flex-wrap gap-2">
            {company.brandInterest.map((b) => (
              <BrandChip key={b} brand={b} />
            ))}
            <span className="chip border-line-strong text-text-2">List · {LIST_LABEL[lead.listType]}</span>
            {lead.suppressed ? <span className="chip border-coral text-coral">Opt-out · never queued</span> : null}
          </div>
          <h1 className="m-0 text-[44px] font-light leading-tight tracking-[-0.02em]">{company.name}</h1>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-text-2">
            <span>{industryLabel(company.industry)}</span>·
            <span>
              {[company.city, company.region].filter(Boolean).join(", ")}, {countryLabel(company.country)}
            </span>
            ·<span>
              local <span className="num text-text">{localTime(company.timezone)}</span>
            </span>
            ·
            <label className="inline-flex items-center gap-1.5">
              owner
              {isAdmin ? (
                <select
                  aria-label="Owner"
                  value={lead.ownerId ?? "none"}
                  onChange={(e) => update({ ownerId: e.target.value === "none" ? null : e.target.value }, "Owner changed")}
                  className="h-7 border border-line-strong bg-bg px-1.5 text-[13px] text-text"
                >
                  {owners.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                  <option value="none">Unassigned</option>
                </select>
              ) : (
                <span className="text-text">{detail.ownerName ?? "Unassigned"}</span>
              )}
            </label>
            ·
            <label className="inline-flex items-center gap-1.5">
              stage
              <select
                aria-label="Stage"
                value={lead.stage}
                onChange={(e) => update({ stage: e.target.value as Stage }, "Stage changed")}
                className="h-7 border border-line-strong bg-bg px-1.5 text-[13px] text-text"
              >
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {STAGE_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={`/call/${lead.id}`} className="btn-outline h-10 text-[11px]">
            Call
          </Link>
          <button type="button" className="btn-outline h-10 text-[11px]" onClick={() => setComposing(true)}>
            Email
          </button>
          <Link to={`/call/${lead.id}?book=1`} className="btn-outline h-10 text-[11px]">
            Book meeting
          </Link>
        </div>
      </div>

      <EmailCompose open={composing} leadId={lead.id} listType={lead.listType} companyName={company.name} onClose={() => setComposing(false)} onQueued={load} />

      <div role="tablist" aria-label="Lead sections" className="flex gap-7 overflow-x-auto border-b border-line text-[13px]">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tab === t}
            onClick={() => setParams(t === "timeline" ? {} : { tab: t }, { replace: true })}
            className={`-mb-px whitespace-nowrap border-b pb-3 capitalize ${tab === t ? "border-ice text-text" : "border-transparent text-text-3 hover:text-text-2"}`}
          >
            {t}
            {tabCount[t] !== undefined ? ` · ${tabCount[t]}` : ""}
          </button>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_340px_300px]">
        <div role="tabpanel" aria-label={tab} className="min-w-0">
          {tab === "timeline" ? (
            <Timeline
              detail={detail}
              users={users}
              tz={user.timezone}
              onNote={async (text) => {
                await data.addNote(lead.id, text);
                load();
              }}
            />
          ) : tab === "contacts" ? (
            <Contacts detail={detail} onChanged={load} />
          ) : tab === "signals" ? (
            <Signals detail={detail} onChanged={load} />
          ) : tab === "deals" ? (
            <LeadDeals leadId={id} />
          ) : tab === "tasks" ? (
            <LinkedTasks type="lead" id={id} spaceHint="Sales" />
          ) : (
            <EmptyState title="No files yet. Uploads (proposals, floor plans, recordings) arrive with Supabase Storage." />
          )}
        </div>

        <section aria-label="Score" className="flex flex-col gap-2.5 self-start border border-line bg-surface px-5 py-[18px]">
          <div className="flex items-baseline justify-between">
            <span className="label-caps">Score · {lead.listType === "trades" ? "trades" : "developer"} model</span>
            <span className={`font-mono text-[26px] ${lead.tier === "A" ? "text-mint" : lead.tier === "B" ? "text-cyan" : lead.tier === "C" ? "text-lavender" : "text-text-3"}`}>
              {lead.tier} {lead.score}
            </span>
          </div>
          {lead.scoreBreakdown.length ? (
            lead.scoreBreakdown.map((l) => (
              <div key={l.ruleId} className="flex justify-between border-b border-line-soft py-1.5 text-[13px]">
                <span className="text-text-2">{l.label}</span>
                <span className={`num ${l.points < 0 ? "text-coral" : "text-mint"}`}>
                  {l.points > 0 ? "+" : ""}
                  {l.points}
                </span>
              </div>
            ))
          ) : (
            <span className="text-[13px] text-text-2">No scoring rule fired yet.</span>
          )}
          {lead.excluded ? <span className="text-[12px] text-coral">Excluded from every queue: on the opt-out list.</span> : null}
          <span className="text-[11px] text-text-3">
            Model {lead.scoreModelVersion} · rescored {timelineDate(lead.scoredAt, user.timezone).toLowerCase()}
          </span>
          {detail.scoreHistory?.length ? (
            <div className="flex flex-col gap-1 border-t border-line-soft pt-2.5">
              <span className="label-caps">History</span>
              {detail.scoreHistory.slice(0, 5).map((h) => (
                <div key={h.id} className="flex justify-between text-[12px]">
                  <span className="text-text-2">
                    {h.prevTier ? `${h.prevTier} ${h.prevScore} → ` : ""}
                    {h.tier} {h.score}
                    <span className="text-text-3"> · {h.reason}</span>
                  </span>
                  <span className="text-text-3">{timelineDate(h.at, user.timezone).toLowerCase()}</span>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <div className="flex flex-col gap-4 xl:col-span-2 xl:grid xl:grid-cols-3 2xl:col-span-1 2xl:flex">
          <SideCard title="Contacts">
            {detail.contacts.slice(0, 2).map((c) => (
              <div key={c.id} className="flex flex-col gap-0.5">
                <span className="text-[14px]">
                  {c.firstName} {c.lastName}
                </span>
                <span className="text-[12px] text-text-2">
                  {c.title ?? "—"} · {c.emailStatus === "valid" ? "email verified" : c.email ? "email not verified" : "phone only"}
                </span>
              </div>
            ))}
            {!detail.contacts.length ? <span className="text-[12px] text-text-2">No contacts yet.</span> : null}
          </SideCard>
          <SideCard title={`Compliance now · ${countryLabel(company.country)}`}>
            {detail.compliance
              ? (["call", "email", "sms"] as const).map((ch) => {
                  const r = detail.compliance![ch];
                  return (
                    <div key={ch} className="flex flex-col gap-0.5">
                      <span className={`text-[12px] ${r.allowed ? "text-mint" : "text-coral"}`}>
                        {r.allowed ? "✓" : "✗"} {ch === "sms" ? "Text" : ch === "call" ? "Call" : "Email"} {r.allowed ? "allowed" : "blocked"}
                      </span>
                      <span className="text-[11px] text-text-3">{r.reasons.join(" · ")}</span>
                    </div>
                  );
                })
              : null}
            {rule ? <span className="text-[12px] text-text-2">{rule.notes}</span> : <span className="text-[12px] text-text-2">No rule for this market yet.</span>}
            {rule && !rule.verified ? <span className="text-[12px] text-amber">Rules for this market aren't confirmed by counsel yet.</span> : null}
            <span className="text-[12px] text-text-2">Lawful basis: {lead.lawfulBasis}</span>
            <span className="text-[12px] text-text-2">Source: {detail.source?.name ?? "—"}</span>
            {lead.erasedAt ? <span className="text-[12px] text-coral">Personal data erased {timelineDate(lead.erasedAt, user.timezone).toLowerCase()}.</span> : null}
            {user.role === "admin" ? <GdprActions leadId={lead.id} erased={!!lead.erasedAt} onDone={load} /> : null}
          </SideCard>
          <SideCard title="Suggested offer" surface>
            <OfferPrices listType={lead.listType} country={company.country} />
            <Link to={`/deals/new?lead=${lead.id}`} className="btn-outline h-9 justify-between text-[11px]">
              <span>Create quote</span>
              <span aria-hidden="true">→</span>
            </Link>
          </SideCard>
        </div>
      </div>
    </div>
  );
};

export default LeadDetailPage;
