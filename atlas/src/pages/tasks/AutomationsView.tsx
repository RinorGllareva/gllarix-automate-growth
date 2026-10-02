import { useCallback, useEffect, useState } from "react";
import { useUser } from "@/auth/AuthContext";
import { Modal, useToast } from "@/components/ui/overlay";
import { EmptyState, SkeletonRows } from "@/components/ui/primitives";
import { DEFAULT_STATUSES, STATUS_META } from "@/config/tasks";
import { data, type Action, type Automation, type AutomationRun, type Condition, type GoalKpi, type GoalView, type TaskStatus, type TaskTemplate, type TriggerType } from "@/data";
import { KPI_LABEL } from "@/services/automations";
import { useTasks } from "./shared";

const TRIGGERS: Record<TriggerType, string> = { deal_won: "A deal is won", task_status_changed: "A task's status changes", task_created: "A task is created", due_date_passed: "A due date passes" };

const describeCondition = (c: Condition) => `${c.field} ${c.op === "eq" ? "is" : c.op === "neq" ? "isn't" : "is one of"} ${Array.isArray(c.value) ? c.value.join(", ") : String(c.value)}`;
const describeAction = (a: Action, templates: TaskTemplate[]) =>
  a.type === "create_tasks_from_template"
    ? `Create the "${templates.find((t) => t.id === a.templateId)?.name ?? "?"}" tasks in ${a.spaceName} › ${a.listName}, for ${a.assignee.replace("_", " ")}, linked to the ${a.link}`
    : a.type === "notify"
      ? `Notify ${a.to.replace("trigger_", "the task's ")}: "${a.text}"`
      : a.type === "set_status"
        ? `Set status to ${STATUS_META[a.status].label}`
        : a.type === "set_priority"
          ? `Set priority to ${a.priority}`
          : `Add the tag "${a.tag}"`;

/** A small builder: one trigger, up to one condition, one action. */
const AutomationEditor = ({ templates, onClose, onSaved }: { templates: TaskTemplate[]; onClose: () => void; onSaved: () => void }) => {
  const toast = useToast();
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState<TriggerType>("task_status_changed");
  const [condField, setCondField] = useState("to");
  const [condValue, setCondValue] = useState("done");
  const [actionType, setActionType] = useState<Action["type"]>("notify");
  const [notifyTo, setNotifyTo] = useState("trigger_creator");
  const [text, setText] = useState("Done: {{task}}");
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [status, setStatus] = useState("review");
  const fields: Record<TriggerType, string[]> = { deal_won: ["brand", "pilot"], task_status_changed: ["to", "from", "priority", "category"], task_created: ["priority", "category"], due_date_passed: ["priority", "category"] };

  const save = async () => {
    const conditions: Condition[] = condValue.trim() ? [{ field: condField, op: "eq", value: condField === "pilot" ? condValue === "true" : condValue.trim() }] : [];
    const action: Action =
      actionType === "notify"
        ? { type: "notify", to: notifyTo, text }
        : actionType === "create_tasks_from_template"
          ? { type: "create_tasks_from_template", templateId, spaceName: "Delivery", listName: "Onboarding", assignee: "implementer", link: "deal" }
          : actionType === "set_status"
            ? { type: "set_status", status: status as TaskStatus }
            : { type: "add_tag", tag: text.trim() || "flagged" };
    try {
      await data.saveAutomation({ name, trigger: { type: trigger }, conditions, actions: [action] });
      toast("Automation saved", "good");
      onSaved();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  return (
    <Modal open onClose={onClose} title="New automation" width={600}>
      <div className="flex flex-col gap-4 text-[13px]">
        <label className="flex flex-col gap-1.5">
          <span className="field-label">Name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Done tasks → tell the creator" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="field-label">When</span>
          <select className="input" value={trigger} onChange={(e) => (setTrigger(e.target.value as TriggerType), setCondField(fields[e.target.value as TriggerType][0]))}>
            {Object.entries(TRIGGERS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="field-label">Only if (optional)</span>
          <div className="flex gap-2">
            <select className="input w-40" value={condField} onChange={(e) => setCondField(e.target.value)}>
              {fields[trigger].map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
            <span className="self-center text-text-3">is</span>
            {condField === "to" || condField === "from" ? (
              <select className="input flex-1" value={condValue} onChange={(e) => setCondValue(e.target.value)}>
                <option value="">any</option>
                {DEFAULT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_META[s].label}
                  </option>
                ))}
              </select>
            ) : (
              <input className="input flex-1" value={condValue} onChange={(e) => setCondValue(e.target.value)} placeholder={condField === "brand" ? "gllarix or arcadian" : condField === "priority" ? "urgent, high, normal, low" : ""} />
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="field-label">Then</span>
          <select className="input" value={actionType} onChange={(e) => setActionType(e.target.value as Action["type"])}>
            <option value="notify">Notify someone</option>
            <option value="create_tasks_from_template" disabled={!templates.length}>
              Create tasks from a template
            </option>
            <option value="set_status">Set the task's status</option>
            <option value="add_tag">Tag the task</option>
          </select>
          {actionType === "notify" ? (
            <div className="flex gap-2">
              <select className="input w-48" value={notifyTo} onChange={(e) => setNotifyTo(e.target.value)}>
                <option value="trigger_creator">the task's creator</option>
                <option value="trigger_assignees">the task's owners</option>
                <option value="deal_owner">the deal owner</option>
                <option value="admins">admins</option>
              </select>
              <input className="input flex-1" value={text} onChange={(e) => setText(e.target.value)} aria-label="Message" />
            </div>
          ) : actionType === "create_tasks_from_template" ? (
            <select className="input" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          ) : actionType === "set_status" ? (
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              {DEFAULT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s].label}
                </option>
              ))}
            </select>
          ) : (
            <input className="input" value={text} onChange={(e) => setText(e.target.value)} aria-label="Tag" />
          )}
          <span className="text-[11px] text-text-3">Messages can use {"{{task}}"} and {"{{company}}"}. Actions never trigger other automations.</span>
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={save}>
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
};

/** Automations ("when X then Y"), task templates and the run log (A15). */
export const AutomationsView = () => {
  const user = useUser();
  const [d, setD] = useState<{ automations: Automation[]; templates: TaskTemplate[]; runs: AutomationRun[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [openTpl, setOpenTpl] = useState<string | null>(null);
  const load = useCallback(() => data.listAutomations().then(setD, (e: Error) => setError(e.message)), []);
  useEffect(() => {
    load();
  }, [load]);
  if (error) return <EmptyState title={error} />;
  if (!d) return <SkeletonRows rows={6} />;
  const admin = user.role === "admin";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="m-0 text-[34px] font-light tracking-[-0.02em]">Automations</h1>
        {admin ? (
          <button type="button" className="btn-primary h-9 text-[11px]" onClick={() => setCreating(true)}>
            + AUTOMATION
          </button>
        ) : null}
      </div>
      <section aria-label="Automations" className="card flex flex-col">
        {d.automations.map((a) => (
          <div key={a.id} className="flex flex-wrap items-start justify-between gap-3 border-b border-line-soft px-4 py-3 text-[13px] last:border-b-0">
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className={a.active ? "" : "text-text-3"}>{a.name}</span>
              <span className="text-[12px] text-text-2">
                When {TRIGGERS[a.trigger.type].toLowerCase()}
                {a.conditions.length ? ` and ${a.conditions.map(describeCondition).join(" and ")}` : ""}: {a.actions.map((x) => describeAction(x, d.templates)).join("; ")}.
              </span>
              <span className="text-[11px] text-text-3">
                {a.runs} run{a.runs === 1 ? "" : "s"}
                {a.lastRunAt ? ` · last ${a.lastRunAt.slice(0, 16).replace("T", " ")}` : ""}
              </span>
            </span>
            {admin ? (
              <span className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-[12px] text-text-2">
                  <input type="checkbox" checked={a.active} onChange={async (e) => (await data.setAutomationActive(a.id, e.target.checked), load())} className="accent-[var(--cyan)]" />
                  Active
                </label>
                <button type="button" className="text-[12px] text-coral" onClick={async () => window.confirm(`Delete "${a.name}"?`) && (await data.deleteAutomation(a.id), load())}>
                  Delete
                </button>
              </span>
            ) : null}
          </div>
        ))}
      </section>

      <section aria-label="Task templates" className="card flex flex-col">
        <span className="label-caps border-b border-line px-4 py-3">Task templates</span>
        {d.templates.map((t) => (
          <div key={t.id} className="border-b border-line-soft last:border-b-0">
            <button type="button" className="flex w-full justify-between gap-3 px-4 py-3 text-left text-[13px] hover:bg-surface-2" onClick={() => setOpenTpl(openTpl === t.id ? null : t.id)} aria-expanded={openTpl === t.id}>
              <span>
                {t.name} <span className="text-text-3">· {t.description}</span>
              </span>
              <span className="text-text-3">{t.items.length} tasks</span>
            </button>
            {openTpl === t.id ? (
              <ol className="m-0 flex flex-col gap-1 bg-bg-deep px-10 py-3 text-[12px] text-text-2">
                {t.items.map((it, i) => (
                  <li key={i}>
                    {it.title} · due +{it.dueOffsetDays} days · {it.estimateHours ?? "—"} h · {it.role.replace("_", " ")}
                    {it.dependsOnPrevious ? " · after the previous one" : ""}
                    {it.checklist?.length ? ` · checklist: ${it.checklist.join(", ")}` : ""}
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
        ))}
      </section>

      <section aria-label="Run log" className="card flex flex-col">
        <span className="label-caps border-b border-line px-4 py-3">Run log</span>
        {d.runs.map((r) => (
          <div key={r.id} className="grid grid-cols-[120px_minmax(0,1fr)_minmax(0,1.4fr)] gap-3 border-b border-line-soft px-4 py-2 text-[12px] last:border-b-0">
            <span className="font-mono text-text-3">{r.at.slice(5, 16).replace("T", " ")}</span>
            <span className="truncate">{d.automations.find((a) => a.id === r.automationId)?.name ?? r.automationId}</span>
            <span className={`truncate ${r.ok ? "text-text-2" : "text-coral"}`}>
              {r.subject} · {r.result}
            </span>
          </div>
        ))}
        {!d.runs.length ? <span className="px-4 py-3 text-[13px] text-text-3">Nothing has run yet. Win a deal or move a task to Review to see one.</span> : null}
      </section>
      {creating ? (
        <AutomationEditor
          templates={d.templates}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            load();
          }}
        />
      ) : null}
    </div>
  );
};

/** Goals linked to Reports KPIs, with the tasks attached to them. */
export const GoalsView = () => {
  const user = useUser();
  const { home } = useTasks();
  const toast = useToast();
  const [goals, setGoals] = useState<GoalView[] | null>(null);
  const [form, setForm] = useState<{ title: string; kpi: GoalKpi; target: string; dueAt: string; ownerId: string } | null>(null);
  const load = useCallback(() => data.listGoals().then(setGoals), []);
  useEffect(() => {
    load();
  }, [load]);
  if (!goals) return <SkeletonRows rows={4} />;
  const tone = { done: "var(--mint)", on_track: "var(--cyan)", behind: "var(--amber)", overdue: "var(--coral)" } as const;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="m-0 text-[34px] font-light tracking-[-0.02em]">Goals</h1>
        {user.role === "admin" ? (
          <button type="button" className="btn-primary h-9 text-[11px]" onClick={() => setForm({ title: "", kpi: "mrr_eur", target: "", dueAt: "", ownerId: user.id })}>
            + GOAL
          </button>
        ) : null}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {goals.map((g) => (
          <section key={g.goal.id} aria-label={g.goal.title} className="card flex flex-col gap-2.5 p-5">
            <div className="flex justify-between gap-3">
              <span className="text-[15px]">{g.goal.title}</span>
              <span className="text-[11px] uppercase tracking-[0.2em]" style={{ color: tone[g.status] }}>
                {g.status.replace("_", " ")}
              </span>
            </div>
            <span className="num text-[28px] font-light">
              {KPI_LABEL[g.goal.kpi].unit}
              {g.current.toLocaleString("en-US")} <span className="text-[14px] text-text-3">/ {KPI_LABEL[g.goal.kpi].unit}{g.goal.target.toLocaleString("en-US")}</span>
            </span>
            <span className="relative h-[3px] bg-line">
              <span className="absolute left-0 top-0 h-[3px]" style={{ width: `${Math.round(g.pct * 100)}%`, background: tone[g.status] }} />
              <span className="absolute -top-1 h-[11px] w-px bg-text-3" style={{ left: `${Math.round(g.elapsed * 100)}%` }} title="Where it should be today" />
            </span>
            <span className="text-[12px] text-text-3">
              {KPI_LABEL[g.goal.kpi].label} · due {g.goal.dueAt} · {g.ownerName ?? "no owner"} · {g.tasks.open} open / {g.tasks.done} done linked tasks
            </span>
            {user.role === "admin" ? (
              <button type="button" className="self-start text-[11px] text-coral" onClick={async () => window.confirm(`Delete "${g.goal.title}"?`) && (await data.deleteGoal(g.goal.id), load())}>
                Delete
              </button>
            ) : null}
          </section>
        ))}
      </div>
      <p className="m-0 text-[12px] text-text-3">Values come from the same data as Reports. Link a task to a goal from the task's Fields card.</p>
      {form ? (
        <Modal open onClose={() => setForm(null)} title="New goal">
          <form
            className="flex flex-col gap-3 text-[13px]"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await data.saveGoal({ title: form.title, kpi: form.kpi, target: Number(form.target), dueAt: form.dueAt, ownerId: form.ownerId || null });
                setForm(null);
                load();
              } catch (err) {
                toast((err as Error).message, "error");
              }
            }}
          >
            <input className="input" placeholder="Title, e.g. €10k MRR by June 2027" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <select className="input" value={form.kpi} onChange={(e) => setForm({ ...form, kpi: e.target.value as GoalKpi })}>
              {(Object.keys(KPI_LABEL) as GoalKpi[]).map((k) => (
                <option key={k} value={k}>
                  {KPI_LABEL[k].label}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <input className="input flex-1" placeholder="Target" inputMode="decimal" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} />
              <input type="date" className="input w-44" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} />
            </div>
            <select className="input" value={form.ownerId} onChange={(e) => setForm({ ...form, ownerId: e.target.value })}>
              {home.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-3">
              <button type="button" className="btn-ghost" onClick={() => setForm(null)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Save goal
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
};
