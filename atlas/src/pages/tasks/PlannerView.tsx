import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useUser } from "@/auth/AuthContext";
import { useToast } from "@/components/ui/overlay";
import { EmptyState } from "@/components/ui/primitives";
import { OWNER_KEYS, OWNER_LABEL, type OwnerKey } from "@/config/ai";
import { PRIORITY_META } from "@/config/tasks";
import { data, type PlanLog, type PlannerSettings, type PlanView } from "@/data";
import { fmtRange } from "@/services/planner";
import { fmtH } from "@/services/scheduler";
import { useTasks } from "./shared";

const OWNER_COLOR: Record<OwnerKey, string> = { rinor: "var(--lavender)", cofounder: "var(--cyan)", bdr: "var(--amber)", codex: "var(--mint)", freelancer: "var(--text-3)" };
const CONTEXTS: [string, string][] = [["price_book", "Price book"], ["sales_plan", "Sales plan"], ["calendar", "Calendar"], ["country_rules", "Country rules"]];
const IDEA_EXAMPLE = "Launch a 3D showcase for developer outreach: one demo building with a unit picker, a landing page, and outreach to 20 Dubai developers. Done by 31 Oct.";
const NOTES_EXAMPLE = "Call with Artin, 1 Oct\n- Send the Stripe checklist @rinor\n- Ask Lena for the onboarding form draft\nTODO: Book the lawyer for UAE rules";
type Tab = "plan" | "notes" | "weekly" | "log";

const dayLabel = (d: string | null) => (d ? new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`)) : "—");

/** The draft: summary cards, proposed tasks (inline edits re-run the scheduler, not the AI), flags, Accept. */
const Draft = ({ plan, setPlan, onAccepted }: { plan: PlanView; setPlan: (p: PlanView) => void; onAccepted: () => void }) => {
  const { home, refresh } = useTasks();
  const user = useUser();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState({ title: "", owner: "cofounder" as OwnerKey, hours: "1" });
  const s = plan.schedule;
  const isDraft = plan.status === "draft";
  const owners = plan.settings.people;
  const run = async (fn: () => Promise<PlanView>) => {
    try {
      setPlan(await fn());
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const after = (key: string) => {
    const r = plan.rows.find((x) => x.key === key)!;
    return r.dependsOn.map((d) => (plan.rows.some((x) => x.key === d) ? d : "↗")).join(", ") || "—";
  };

  return (
    <div className="flex flex-col gap-3.5">
      {plan.outcome ? <p className="m-0 text-[14px]">Outcome: {plan.outcome}</p> : null}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          { k: "TASKS", v: String(s.summary.tasks), c: "var(--text)" },
          { k: "Team hours", v: `${fmtH(s.summary.teamHours)} h`, c: "var(--cyan)" },
          { k: "FREELANCER", v: `${fmtH(s.summary.externalHours)} h`, c: "var(--text-3)" },
          { k: "FINISHES", v: s.summary.finish ? `${dayLabel(s.summary.finish)}${s.summary.beforeDeadline === false ? " · after deadline" : s.summary.beforeDeadline ? " ✓" : ""}` : "—", c: s.summary.beforeDeadline === false ? "var(--coral)" : "var(--mint)" },
        ].map((x) => (
          <div key={x.k} className="flex flex-col gap-1.5 border border-line rounded-lg bg-surface px-3.5 py-3">
            <span className="text-[10px] tracking-[0.2em] text-label">{x.k}</span>
            <span className="text-[22px] font-light" style={{ color: x.c }}>
              {x.v}
            </span>
          </div>
        ))}
      </div>

      <section aria-label="Proposed tasks" className="min-w-0 overflow-x-auto border border-line rounded-lg bg-surface">
        <div className="grid min-w-[720px] grid-cols-[28px_minmax(0,1fr)_130px_70px_120px_70px_28px] gap-2.5 border-b border-line px-3.5 py-2.5 text-[10px] tracking-[0.2em] text-text-3 bg-surface-2">
          <span>#</span>
          <span>TASK</span>
          <span>OWNER</span>
          <span>EST.</span>
          <span>SCHEDULED</span>
          <span>AFTER</span>
          <span />
        </div>
        {plan.rows.map((r) => {
          const sch = s.rows.find((x) => x.key === r.key);
          return (
            <div key={r.key} className="border-b border-line-soft last:border-b-0">
              <div className="grid min-w-[720px] grid-cols-[28px_minmax(0,1fr)_130px_70px_120px_70px_28px] items-center gap-2.5 px-3.5 text-[13px]" style={{ minHeight: 38 }}>
                <span className="font-mono text-text-3">{r.key}</span>
                {editing && isDraft ? (
                  <input aria-label="Title" className="input h-8" defaultValue={r.title} onBlur={(e) => e.target.value !== r.title && run(() => data.updatePlanRow(plan.id, r.key, { title: e.target.value }))} />
                ) : (
                  <button type="button" className="truncate text-left" onClick={() => setOpen(open === r.key ? null : r.key)} aria-expanded={open === r.key}>
                    {r.title}
                    {r.reusesTaskId ? <span className="text-text-3"> · existing</span> : null}
                  </button>
                )}
                {editing && isDraft ? (
                  <select aria-label="Owner" className="input h-8" value={r.owner} onChange={(e) => run(() => data.updatePlanRow(plan.id, r.key, { owner: e.target.value as OwnerKey }))}>
                    {owners.map((o) => (
                      <option key={o} value={o}>
                        {OWNER_LABEL[o]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span style={{ color: OWNER_COLOR[r.owner] }}>{OWNER_LABEL[r.owner]}</span>
                )}
                {editing && isDraft ? (
                  <input aria-label="Estimate hours" className="input h-8 font-mono" inputMode="decimal" defaultValue={r.estimateHours} onBlur={(e) => Number(e.target.value) !== r.estimateHours && run(() => data.updatePlanRow(plan.id, r.key, { estimateHours: Number(e.target.value) }))} />
                ) : (
                  <span className="font-mono text-text-2">
                    {fmtH(r.estimateHours)}h{r.owner === "codex" ? " rev" : ""}
                  </span>
                )}
                <span className="font-mono text-[12px] text-text-2">{fmtRange(sch?.start ?? null, sch?.finish ?? null)}</span>
                <span className="font-mono text-[12px] text-text-3">{after(r.key)}</span>
                {editing && isDraft ? (
                  <button type="button" aria-label={`Remove ${r.title}`} className="text-text-3 hover:text-coral" onClick={() => run(() => data.updatePlanRow(plan.id, r.key, { remove: true }))}>
                    ×
                  </button>
                ) : (
                  <span />
                )}
              </div>
              {open === r.key ? (
                <div className="flex flex-col gap-1.5 bg-bg-deep px-12 py-3 text-[13px] text-text-2">
                  <span>{r.description}</span>
                  <ul className="m-0 pl-5">
                    {r.acceptance.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                  <span className="text-[12px] text-text-3">
                    {r.category} · <span className={PRIORITY_META[r.priority].text}>{PRIORITY_META[r.priority].label}</span> · confidence {r.confidence}
                    {r.owner === "codex" ? ` · review by ${OWNER_LABEL[r.reviewer ?? "rinor"]}` : ""}
                    {r.subtasks.length ? ` · subtasks: ${r.subtasks.map((x) => x.title).join(", ")}` : ""}
                  </span>
                </div>
              ) : null}
            </div>
          );
        })}
        {editing && isDraft ? (
          <form
            className="grid min-w-[720px] grid-cols-[28px_minmax(0,1fr)_130px_70px_auto] items-center gap-2.5 px-3.5 py-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => data.addPlanRow(plan.id, { title: adding.title, owner: adding.owner, estimateHours: Number(adding.hours) })).then(() => setAdding({ ...adding, title: "" }));
            }}
          >
            <span className="text-text-3">+</span>
            <input className="input h-8" placeholder="Add a task" value={adding.title} onChange={(e) => setAdding({ ...adding, title: e.target.value })} />
            <select className="input h-8" value={adding.owner} onChange={(e) => setAdding({ ...adding, owner: e.target.value as OwnerKey })}>
              {owners.map((o) => (
                <option key={o} value={o}>
                  {OWNER_LABEL[o]}
                </option>
              ))}
            </select>
            <input className="input h-8 font-mono" value={adding.hours} onChange={(e) => setAdding({ ...adding, hours: e.target.value })} aria-label="Hours" />
            <button type="submit" className="btn-outline h-8 text-[11px]">
              Add
            </button>
          </form>
        ) : null}
      </section>

      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1fr)_250px]">
        <section aria-label="Checks" className="flex flex-col gap-1.5 border border-amber-line px-3.5 py-3 text-[12px]">
          <span className="text-[12px] font-medium text-amber">What the planner changed or flagged</span>
          {s.flags.length ? s.flags.map((f) => <span key={f} className="text-text-2">{f}</span>) : <span className="text-text-3">Nothing to flag: it fits.</span>}
          {plan.openQuestions.length ? <span className="mt-1 text-text-3">Open questions: {plan.openQuestions.join(" · ")}</span> : null}
        </section>
        <div className="flex flex-col gap-2">
          {isDraft ? (
            <>
              <label className="flex flex-col gap-1 text-[11px] text-text-3">
                Save to
                <select className="input h-9" value={plan.settings.targetListId ?? ""} onChange={(e) => run(() => data.updatePlanSettings(plan.id, { targetListId: e.target.value || null }))}>
                  <option value="">{plan.listName ?? "Default list"}</option>
                  {home.spaces.flatMap((x) =>
                    x.lists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {x.space.name} / {l.name}
                      </option>
                    )),
                  )}
                </select>
              </label>
              <button
                type="button"
                className="btn-primary h-11 justify-between"
                onClick={async () => {
                  try {
                    const r = await data.acceptPlan(plan.id);
                    toast(`${r.created} tasks created · labelled AI, accepted by ${user.name.split(" ")[0]}`, "good");
                    refresh();
                    onAccepted();
                  } catch (e) {
                    toast((e as Error).message, "error");
                  }
                }}
              >
                <span>Accept {plan.rows.length} tasks</span>
                <span aria-hidden="true">→</span>
              </button>
              <button type="button" className="btn-outline h-10 text-[11px]" aria-pressed={editing} onClick={() => setEditing((x) => !x)}>
                {editing ? "Done editing" : "Edit before saving"}
              </button>
              <button type="button" className="btn-ghost h-8 text-[11px]" onClick={() => data.rejectPlan(plan.id).then(onAccepted)}>
                Discard draft
              </button>
            </>
          ) : (
            <span className="text-[13px] text-text-2">
              {plan.status === "accepted" ? `Accepted · ${plan.createdTaskIds.length} tasks created.` : `This plan is ${plan.status}.`}
            </span>
          )}
          <span className="text-[11px] text-text-3">
            {plan.model} · {plan.attempts > 1 ? `${plan.attempts} attempts · ` : ""}${(plan.costMinor / 100).toFixed(3)}
          </span>
        </div>
      </div>
    </div>
  );
};

/** AI planner (screen 20): idea → draft → edit → Accept. Also tasks from notes, this week's picks, and the plans log. */
const PlannerView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useUser();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("plan");
  const [idea, setIdea] = useState(IDEA_EXAMPLE);
  const [notes, setNotes] = useState(NOTES_EXAMPLE);
  const ownKey = (Object.entries(OWNER_KEYS).find(([, v]) => v === user.id)?.[0] ?? null) as OwnerKey | null;
  const [settings, setSettings] = useState<PlannerSettings>({
    deadline: "2026-10-31", buffer: 0.3, people: user.role === "admin" ? ["rinor", "cofounder", "codex", "freelancer"] : ownKey ? [ownKey] : [], context: ["price_book", "sales_plan", "calendar"], targetListId: null,
  });
  const [plan, setPlan] = useState<PlanView | null>(null);
  const [weekly, setWeekly] = useState<PlanView | null>(null);
  const [log, setLog] = useState<PlanLog | null>(null);
  const [busy, setBusy] = useState(false);

  const loadLog = useCallback(() => data.planLog().then(setLog, () => setLog(null)), []);
  useEffect(() => {
    loadLog();
  }, [loadLog]);
  useEffect(() => {
    if (id) data.getPlan(id).then(setPlan, (e: Error) => toast(e.message, "error"));
    else setPlan(null);
  }, [id, toast]);

  const generate = async (source: "idea" | "notes") => {
    setBusy(true);
    try {
      const p = await data.createPlan({ idea: source === "notes" ? notes : idea, settings: { ...settings, source } });
      navigate(`/tasks/planner/${p.id}`);
      setPlan(p);
      loadLog();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const tabs: [Tab, string][] = [["plan", "Plan an idea"], ["notes", "Tasks from notes"], ["weekly", "This week"], ["log", "Log"]];
  const people: OwnerKey[] = user.role === "admin" ? ["rinor", "cofounder", "bdr", "codex", "freelancer"] : ownKey ? [ownKey] : [];
  if (!people.length) return <EmptyState title="The planner is for founders and the sales team." />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="page-title m-0">AI planner</h1>
        {log ? (
          <span className={`text-[12px] ${log.blocked ? "text-coral" : "text-text-3"}`}>
            AI this month €{(log.monthSpendEurMinor / 100).toFixed(2)} of €{(log.capEurMinor / 100).toFixed(0)}
            {log.blocked ? " · cap reached" : ""}
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1 border-b border-line">
        {tabs.map(([t, label]) => (
          <button key={t} type="button" onClick={() => setTab(t)} aria-pressed={tab === t} className={`-mb-px border-b px-3 pb-2.5 text-[13px] ${tab === t ? "border-ice text-text" : "border-transparent text-text-3 hover:text-text"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "plan" || tab === "notes" ? (
        <>
          <section aria-label={tab === "notes" ? "Notes" : "Your idea"} className="grid gap-3.5 lg:grid-cols-[minmax(0,1fr)_260px]">
            <label className="flex flex-col gap-2">
              <span className="label-caps">{tab === "notes" ? "Paste meeting or call notes" : "Your idea"}</span>
              <textarea className="input min-h-[96px] text-[14px] leading-relaxed" value={tab === "notes" ? notes : idea} onChange={(e) => (tab === "notes" ? setNotes(e.target.value) : setIdea(e.target.value))} />
              {tab === "notes" ? <span className="text-[11px] text-text-3">Lines starting with -, TODO or Action: become tasks; @name picks the owner.</span> : null}
            </label>
            <div className="flex flex-col gap-2 text-[12px] text-text-2">
              <span className="label-caps">Settings</span>
              <label className="flex items-center justify-between gap-2">
                Deadline
                <input type="date" className="input h-8 w-36" value={settings.deadline ?? ""} onChange={(e) => setSettings({ ...settings, deadline: e.target.value || null })} />
              </label>
              <label className="flex items-center justify-between gap-2">
                Buffer
                <select className="input h-8 w-36" value={settings.buffer === null ? "real" : String(settings.buffer)} onChange={(e) => setSettings({ ...settings, buffer: e.target.value === "real" ? null : Number(e.target.value) })}>
                  <option value="0.3">+30%</option>
                  <option value="0.2">+20%</option>
                  <option value="0.5">+50%</option>
                  <option value="real">Each person's real ratio</option>
                </select>
              </label>
              <span>People</span>
              <span className="flex flex-wrap gap-1">
                {people.map((p) => {
                  const on = settings.people.includes(p);
                  return (
                    <button key={p} type="button" aria-pressed={on} disabled={user.role !== "admin"} onClick={() => setSettings({ ...settings, people: on ? settings.people.filter((x) => x !== p) : [...settings.people, p] })} className={`h-7 border px-2 text-[11px] ${on ? "border-ice bg-ice text-ice-ink" : "border-line-strong text-text-3"}`}>
                      {OWNER_LABEL[p]}
                    </button>
                  );
                })}
              </span>
              <span>Uses</span>
              <span className="flex flex-wrap gap-1">
                {CONTEXTS.map(([k, label]) => {
                  const on = settings.context.includes(k);
                  return (
                    <button key={k} type="button" aria-pressed={on} onClick={() => setSettings({ ...settings, context: on ? settings.context.filter((x) => x !== k) : [...settings.context, k] })} className={`h-7 border px-2 text-[11px] ${on ? "border-cyan text-cyan" : "border-line-strong text-text-3"}`}>
                      {label}
                    </button>
                  );
                })}
              </span>
              <button type="button" className="btn-primary h-9 text-[11px]" disabled={busy || !settings.people.length} onClick={() => generate(tab === "notes" ? "notes" : "idea")}>
                {busy ? "Planning…" : plan ? "Regenerate plan" : "Plan it"}
              </button>
            </div>
          </section>
          {plan && plan.mode === "plan" ? (
            <Draft
              key={plan.id}
              plan={plan}
              setPlan={setPlan}
              onAccepted={() => {
                loadLog();
                data.getPlan(plan.id).then(setPlan);
              }}
            />
          ) : (
            <p className="m-0 text-[13px] text-text-3">The plan appears here as a draft. Nothing is saved until you accept it.</p>
          )}
        </>
      ) : tab === "weekly" ? (
        <section aria-label="This week" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[13px] text-text-2">What should we do this week? Picks that fit each person's free hours, highest value first. Nothing is changed.</span>
            <button
              type="button"
              className="btn-primary h-9 text-[11px]"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  setWeekly(await data.weeklyPicks());
                  loadLog();
                } catch (e) {
                  toast((e as Error).message, "error");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Thinking…" : "What should we do this week?"}
            </button>
          </div>
          {weekly ? (
            <div className="card flex flex-col">
              {weekly.rows.map((r) => (
                <Link key={r.key} to={`/tasks/${r.reusesTaskId}`} className="flex flex-wrap justify-between gap-3 border-b border-line-soft px-4 py-2.5 text-[13px] last:border-b-0 hover:bg-surface-2">
                  <span>
                    <span style={{ color: OWNER_COLOR[r.owner] }}>{OWNER_LABEL[r.owner]}</span> · {r.title}
                  </span>
                  <span className="text-text-3">
                    {fmtH(r.estimateHours)} h · {r.description}
                  </span>
                </Link>
              ))}
              {!weekly.rows.length ? <span className="px-4 py-3 text-[13px] text-text-3">Nothing fits this week's free hours.</span> : null}
            </div>
          ) : null}
        </section>
      ) : (
        <section aria-label="Plans log" className="card flex flex-col">
          {log?.plans.length ? (
            log.plans.map((p) => (
              <Link key={p.id} to={p.mode === "plan" ? `/tasks/planner/${p.id}` : "#"} onClick={() => p.mode === "plan" && setTab("plan")} className="grid grid-cols-[90px_minmax(0,1fr)_90px_120px_90px] gap-3 border-b border-line-soft px-4 py-2.5 text-[12px] last:border-b-0 hover:bg-surface-2">
                <span className="font-mono text-text-3">{p.createdAt.slice(5, 16).replace("T", " ")}</span>
                <span className="truncate">
                  <span className="text-text-3">{p.mode} · </span>
                  {p.idea}
                </span>
                <span className={p.status === "accepted" ? "text-mint" : p.status === "failed" ? "text-coral" : "text-text-2"}>{p.status}</span>
                <span className="truncate text-text-3">{p.model}</span>
                <span className="text-right font-mono text-text-2">${(p.costMinor / 100).toFixed(3)}</span>
              </Link>
            ))
          ) : (
            <span className="px-4 py-3 text-[13px] text-text-3">No plans yet.</span>
          )}
        </section>
      )}
      <p className="m-0 text-[11px] text-text-3">Demo mode uses a fake AI provider. In Supabase mode the planner runs in an Edge Function with the Anthropic API; your browser never holds the key or the prompt.</p>
    </div>
  );
};

export default PlannerView;
