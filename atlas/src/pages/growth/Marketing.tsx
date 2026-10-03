import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { usePageChrome } from "@/components/shell/PageChrome";
import { Modal, useToast } from "@/components/ui/overlay";
import { EmptyState, Icon, ICONS, KpiCard, Pill, SkeletonRows } from "@/components/ui/primitives";
import type { Hue } from "@/config/colors";
import { BANNED_PHRASES, checkClaims, MESSAGING_KIT, OBJECTIONS, OUTBOUND_LISTS, POSITIONING } from "@/config/marketing";
import { data, type ChannelStatus, type Experiment, type MarketingChannel, type MarketingKpis } from "@/data";
import { eurWhole } from "@/services/money";

const CHANNEL_STATUS: Record<ChannelStatus, { label: string; hue: Hue }> = {
  not_started: { label: "Not started", hue: "text-3" },
  in_progress: { label: "In progress", hue: "amber" },
  live: { label: "Live", hue: "mint" },
  paused: { label: "Paused", hue: "coral" },
};
const TEST_STATUS: Record<Experiment["status"], { label: string; hue: Hue }> = {
  planned: { label: "Planned", hue: "text-3" },
  running: { label: "Running", hue: "cyan" },
  won: { label: "Worked", hue: "mint" },
  stopped: { label: "Stopped", hue: "coral" },
};

const Card = ({ title, help, action, children }: { title: string; help?: string; action?: ReactNode; children: ReactNode }) => (
  <section aria-label={title} className="card flex min-w-0 flex-col gap-4 p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-[15px] font-semibold">{title}</span>
        {help ? <span className="text-[13px] text-text-3">{help}</span> : null}
      </div>
      {action}
    </div>
    {children}
  </section>
);

const today = () => new Date().toISOString().slice(0, 10);

/** Growth › Marketing: KPIs, positioning and the claim check, inbound channels, tests with stop rules, outbound lists and the messaging kit. */
const Marketing = () => {
  const toast = useToast();
  const [home, setHome] = useState<{ channels: MarketingChannel[]; experiments: Experiment[]; kpis: MarketingKpis; canEdit: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copy, setCopy] = useState("");
  const [test, setTest] = useState<Partial<Experiment> | null>(null);
  usePageChrome({ context: "Growth · marketing" });

  const load = useCallback(() => data.marketingHome().then(setHome, (e: Error) => setError(e.message)), []);
  useEffect(() => {
    load();
  }, [load]);
  const issues = useMemo(() => checkClaims(copy), [copy]);

  if (error) return <EmptyState title={error} />;
  if (!home) return <SkeletonRows rows={8} />;
  const { kpis, canEdit } = home;
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      if (ok) toast(ok, "good");
      await load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const moving = home.channels.filter((c) => c.status === "live" || c.status === "in_progress").length;
  const share = kpis.referralInboundShare;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="page-title m-0">Marketing</h1>
        <p className="m-0 max-w-3xl text-[14px] text-text-2">
          Two outbound lists and the inbound channels to build. Budget is €0 until a test is approved, and no paid ads before the first case study.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard title="Meetings booked this week" value={String(kpis.meetingsThisWeek)} caption="Trades target: 4+ a week" tone={kpis.meetingsThisWeek >= 4 ? "mint" : "amber"} />
        <KpiCard title="Approved meetings" value={String(kpis.approved30d)} caption="Last 30 days" tone="cyan" />
        <KpiCard title="Inbound leads" value={String(kpis.inboundLeadsMonth)} caption="This month · target 5 a month by Jan" />
        <KpiCard title="From referrals + inbound" value={share === null ? "—" : `${Math.round(share * 100)}%`} caption="Of meetings, last 90 days · 30% by June" tone={share !== null && share >= 0.3 ? "mint" : "text"} />
        <KpiCard title="Cost per approved meeting" value={kpis.costPerApprovedMeetingEur === null ? "—" : eurWhole(kpis.costPerApprovedMeetingEur)} caption="Sales + marketing cost, 30 days" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card title="Positioning" help="What we say, to whom, and the proof we use.">
          <div className="grid gap-3 md:grid-cols-2">
            {POSITIONING.map((p) => (
              <div key={p.brand} className="flex flex-col gap-2 rounded-lg bg-surface-2/50 p-4 text-[13px]">
                <Pill hue={p.brand === "gllarix" ? "cyan" : "amber"} className="self-start">
                  {p.name}
                </Pill>
                <span className="text-[15px] font-semibold leading-snug">“{p.promise}”</span>
                <span className="text-text-2">
                  <span className="text-text-3">For </span>
                  {p.for}
                </span>
                <span className="text-text-2">
                  <span className="text-text-3">Proof </span>
                  {p.proof}
                </span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            <span className="text-text-3">Words we don't use:</span>
            {BANNED_PHRASES.map((b) => (
              <span key={b} className="rounded-md bg-coral-tint px-2 py-0.5 text-coral line-through">
                {b}
              </span>
            ))}
            <span className="text-text-3">· or any claim without client data.</span>
          </div>
        </Card>

        <Card title="Check copy before it goes out" help="Paste website, post or email text. Atlas flags banned words and claims that need client data.">
          <textarea aria-label="Copy to check" className="input min-h-[120px] py-2" placeholder="e.g. Never miss a call again: our AI answers 100% of calls and saves you 30+ hours saved a week." value={copy} onChange={(e) => setCopy(e.target.value)} />
          {copy.trim() ? (
            issues.length ? (
              <div className="flex flex-col gap-1.5">
                {issues.map((i, k) => (
                  <span key={k} className="flex items-start gap-2 text-[13px]">
                    <span style={{ color: i.severity === "banned" ? "var(--coral)" : "var(--amber)" }} className="mt-px shrink-0">
                      <Icon d="M12 8v5M12 16h.01" size={15} />
                    </span>
                    <span>
                      <span className="font-medium">“{i.text}”</span> <span className="text-text-2">· {i.reason}</span>
                    </span>
                  </span>
                ))}
              </div>
            ) : (
              <span className="flex items-center gap-2 text-[13px] text-mint">
                <Icon d="M5 12l5 5L20 7" size={15} /> No banned words or unproven claims found.
              </span>
            )
          ) : null}
        </Card>
      </div>

      <Card title="Inbound channels" help={`${moving} of ${home.channels.length} in progress or live.`}>
        <div className="overflow-x-auto">
          <div className="grid min-w-[900px] grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_110px_96px_minmax(0,0.9fr)_140px] gap-3 border-b border-line px-1 pb-2 text-[12px] text-text-3">
            <span>Channel</span>
            <span>What to build</span>
            <span>Owner</span>
            <span>Due</span>
            <span>KPI</span>
            <span>Status</span>
          </div>
          {home.channels.map((c) => (
            <div key={c.id} className="grid min-w-[900px] grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_110px_96px_minmax(0,0.9fr)_140px] items-center gap-3 border-b border-line-soft px-1 py-2.5 text-[13px] last:border-b-0">
              <span className="font-medium">{c.name}</span>
              <span className="text-text-2">{c.build}</span>
              <span className="text-text-2">{c.owner}</span>
              <span className={`num text-[12px] ${/^\d/.test(c.due) && c.due < today() && c.status !== "live" ? "text-coral" : "text-text-2"}`}>{c.due}</span>
              <span className="text-[12px] text-text-3">{c.kpi}</span>
              {canEdit ? (
                <label className="relative">
                  <Pill hue={CHANNEL_STATUS[c.status].hue} dot>
                    {CHANNEL_STATUS[c.status].label}
                  </Pill>
                  <select aria-label={`${c.name} status`} className="absolute inset-0 cursor-pointer opacity-0" value={c.status} onChange={(e) => run(() => data.updateChannel(c.id, { status: e.target.value as ChannelStatus }), `${c.name}: ${CHANNEL_STATUS[e.target.value as ChannelStatus].label}`)}>
                    {(Object.keys(CHANNEL_STATUS) as ChannelStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {CHANNEL_STATUS[s].label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <Pill hue={CHANNEL_STATUS[c.status].hue} dot>
                  {CHANNEL_STATUS[c.status].label}
                </Pill>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card
        title="Tests"
        help="Every test has a budget and a stop rule. Check whether it's worth it in Money › ROI first."
        action={
          canEdit ? (
            <span className="flex gap-2">
              <Link to="/roi" className="btn-outline">
                Check ROI
              </Link>
              <button type="button" className="btn-primary" onClick={() => setTest({ name: "", channel: "", budgetEur: 200, stopRule: "", goal: 2, status: "planned", startDate: today() })}>
                <Icon d={ICONS.plus} size={15} /> New test
              </button>
            </span>
          ) : null
        }
      >
        <div className="grid gap-3 md:grid-cols-2">
          {home.experiments.map((x) => (
            <div key={x.id} className="flex flex-col gap-2.5 rounded-lg border border-line p-4 text-[13px]">
              <span className="flex items-start justify-between gap-2">
                <span className="font-semibold">{x.name}</span>
                <Pill hue={TEST_STATUS[x.status].hue} dot>
                  {TEST_STATUS[x.status].label}
                </Pill>
              </span>
              <span className="text-text-2">
                {x.channel} · stop rule: {x.stopRule}
              </span>
              <div className="flex flex-col gap-1">
                <span className="flex justify-between text-[12px] text-text-3">
                  <span>
                    Spent {eurWhole(x.spentEur)} of {eurWhole(x.budgetEur)}
                  </span>
                  <span>
                    {x.qualifiedLeads} of {x.goal} qualified leads
                  </span>
                </span>
                <span className="h-1.5 rounded-full bg-line">
                  <span className="block h-1.5 rounded-full bg-app" style={{ width: `${Math.min(100, (x.spentEur / x.budgetEur) * 100)}%` }} />
                </span>
              </div>
              {x.note ? <span className="text-[12px] text-text-3">{x.note}</span> : null}
              {canEdit ? (
                <button type="button" className="btn-ghost self-start" onClick={() => setTest(x)}>
                  Update
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Outbound lists" help="Both brands on every call: two lists, each with one lead offer.">
          {OUTBOUND_LISTS.map((l) => (
            <div key={l.name} className="flex flex-col gap-1.5 border-b border-line-soft pb-3 text-[13px] last:border-b-0 last:pb-0">
              <span className="font-semibold">{l.name}</span>
              <span className="text-text-2">
                <span className="text-text-3">Who calls </span>
                {l.who}
              </span>
              <span className="text-text-2">
                <span className="text-text-3">Lead offer </span>
                {l.offer}
              </span>
              <span className="text-text-2">
                <span className="text-text-3">Cross-sell </span>
                {l.crossSell}
              </span>
              <span className="text-text-2">
                <span className="text-text-3">Channels </span>
                {l.channels}
              </span>
              <span className="text-text-2">
                <span className="text-text-3">Cadence </span>
                {l.cadence}
              </span>
            </div>
          ))}
          {canEdit ? (
            <Link to="/admin/cadences" className="btn-ghost self-start">
              Edit the cadences ↗
            </Link>
          ) : null}
        </Card>

        <Card title="Messaging kit" help="What every call says. Updated monthly from real calls.">
          {MESSAGING_KIT.map((m) => (
            <div key={m.key} className="flex items-start justify-between gap-3 border-b border-line-soft pb-3 text-[13px] last:border-b-0 last:pb-0">
              <span className="flex flex-col gap-1">
                <span className="text-[12px] font-medium text-text-3">{m.label}</span>
                <span>{m.text}</span>
              </span>
              <button
                type="button"
                aria-label={`Copy ${m.label}`}
                className="btn-outline h-7 shrink-0 px-2 text-[12px]"
                onClick={async () => {
                  await navigator.clipboard?.writeText(m.text).catch(() => undefined);
                  toast(`${m.label} copied`, "good");
                }}
              >
                Copy
              </button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            <span className="text-text-3">Top objections:</span>
            {OBJECTIONS.map((o) => (
              <span key={o} className="rounded-md bg-surface-2 px-2 py-0.5 text-text-2">
                {o}
              </span>
            ))}
          </div>
        </Card>
      </div>

      <Modal open={!!test} onClose={() => setTest(null)} title={test?.id ? "Update test" : "New test"} width={620}>
        {test ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              await run(() => data.saveExperiment({ ...test, name: test.name ?? "" }), test.id ? "Test updated" : "Test added");
              setTest(null);
            }}
          >
            <label className="flex flex-col gap-2">
              <span className="field-label">Test</span>
              <input className="input" required value={test.name ?? ""} onChange={(e) => setTest({ ...test, name: e.target.value })} />
            </label>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="flex flex-col gap-2">
                <span className="field-label">Channel</span>
                <input className="input" value={test.channel ?? ""} onChange={(e) => setTest({ ...test, channel: e.target.value })} />
              </label>
              <label className="flex flex-col gap-2">
                <span className="field-label">Budget (€)</span>
                <input type="number" min={1} className="input" value={test.budgetEur ?? 0} onChange={(e) => setTest({ ...test, budgetEur: Number(e.target.value) || 0 })} />
              </label>
              <label className="flex flex-col gap-2">
                <span className="field-label">Spent so far (€)</span>
                <input type="number" min={0} className="input" value={test.spentEur ?? 0} onChange={(e) => setTest({ ...test, spentEur: Number(e.target.value) || 0 })} />
              </label>
            </div>
            <label className="flex flex-col gap-2">
              <span className="field-label">Stop rule</span>
              <input className="input" required placeholder="e.g. At least 2 qualified leads within the budget, or stop" value={test.stopRule ?? ""} onChange={(e) => setTest({ ...test, stopRule: e.target.value })} />
            </label>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="flex flex-col gap-2">
                <span className="field-label">Qualified leads needed</span>
                <input type="number" min={1} className="input" value={test.goal ?? 1} onChange={(e) => setTest({ ...test, goal: Number(e.target.value) || 1 })} />
              </label>
              <label className="flex flex-col gap-2">
                <span className="field-label">Qualified leads so far</span>
                <input type="number" min={0} className="input" value={test.qualifiedLeads ?? 0} onChange={(e) => setTest({ ...test, qualifiedLeads: Number(e.target.value) || 0 })} />
              </label>
              <label className="flex flex-col gap-2">
                <span className="field-label">Status</span>
                <select className="input" value={test.status ?? "planned"} onChange={(e) => setTest({ ...test, status: e.target.value as Experiment["status"] })}>
                  {(Object.keys(TEST_STATUS) as Experiment["status"][]).map((s) => (
                    <option key={s} value={s}>
                      {TEST_STATUS[s].label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="flex flex-col gap-2">
              <span className="field-label">Note</span>
              <input className="input" value={test.note ?? ""} onChange={(e) => setTest({ ...test, note: e.target.value })} />
            </label>
            <button type="submit" className="btn-primary">
              Save test
            </button>
          </form>
        ) : null}
      </Modal>
    </div>
  );
};

export default Marketing;
