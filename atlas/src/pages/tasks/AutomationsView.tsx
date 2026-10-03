import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useUser } from "@/auth/AuthContext";
import { Modal, useToast } from "@/components/ui/overlay";
import { EmptyState, SkeletonRows } from "@/components/ui/primitives";
import { DEFAULT_STATUSES, STATUS_META } from "@/config/tasks";
import { data, type Action, type Automation, type AutomationRun, type Condition, type GoalKpi, type GoalView, type TaskStatus, type TaskTemplate, type TemplateItem, type TriggerType } from "@/data";
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
const AutomationEditor = ({ templates, existing, onClose, onSaved }: { templates: TaskTemplate[]; existing?: Automation; onClose: () => void; onSaved: () => void }) => {
  const toast = useToast();
  const first = existing?.actions[0];
  const cond = existing?.conditions[0];
  const [name, setName] = useState(existing?.name ?? "");
  const [trigger, setTrigger] = useState<TriggerType>(existing?.trigger.type ?? "task_status_changed");
  const [condField, setCondField] = useState(cond?.field ?? (existing ? "" : "to"));
  const [condValue, setCondValue] = useState(cond ? String(cond.value) : existing ? "" : "done");
  const [actionType, setActionType] = useState<Action["type"]>(first?.type ?? "notify");
  const [notifyTo, setNotifyTo] = useState(first?.type === "notify" ? first.to : "trigger_creator");
  const [text, setText] = useState(first?.type === "notify" ? first.text : first?.type === "add_tag" ? first.tag : "Done: {{task}}");
  const [templateId, setTemplateId] = useState(first?.type === "create_tasks_from_template" ? first.templateId : (templates[0]?.id ?? ""));
  const [status, setStatus] = useState<string>(first?.type === "set_status" ? first.status : "review");
  const [target, setTarget] = useState(
    first?.type === "create_tasks_from_template"
      ? { spaceName: first.spaceName, listName: first.listName, assignee: first.assignee, link: first.link }
      : { spaceName: "Delivery", listName: "Onboarding", assignee: "implementer", link: "deal" as "client" | "deal" | "lead" | "none" },
  );
  const [spaces, setSpaces] = useState<{ name: string; lists: string[] }[]>([]);
  useEffect(() => {
    data.tasksHome().then(
      (h) => setSpaces(h.spaces.map((x) => ({ name: x.space.name, lists: x.lists.map((l) => l.name) }))),
      () => setSpaces([]),
    );
  }, []);
  const fields: Record<TriggerType, string[]> = { deal_won: ["brand", "pilot"], task_status_changed: ["to", "from", "priority", "category"], task_created: ["priority", "category"], due_date_passed: ["priority", "category"] };

  const save = async () => {
    const conditions: Condition[] = condValue.trim() ? [{ field: condField, op: "eq", value: condField === "pilot" ? condValue === "true" : condValue.trim() }] : [];
    const action: Action =
      actionType === "notify"
        ? { type: "notify", to: notifyTo, text }
        : actionType === "create_tasks_from_template"
          ? { type: "create_tasks_from_template", templateId, spaceName: target.spaceName, listName: target.listName, assignee: target.assignee, link: target.link }
          : actionType === "set_status"
            ? { type: "set_status", status: status as TaskStatus }
            : { type: "add_tag", tag: text.trim() || "flagged" };
    try {
      await data.saveAutomation({ ...(existing ? { id: existing.id, active: existing.active } : {}), name, trigger: { type: trigger }, conditions, actions: [action] });
      toast("Automation saved", "good");
      onSaved();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  return (
    <Modal open onClose={onClose} title={existing ? `Edit · ${existing.name}` : "New automation"} width={600}>
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
            <div className="grid gap-2 sm:grid-cols-2">
              <select className="input sm:col-span-2" aria-label="Template" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <select className="input" aria-label="Space" value={target.spaceName} onChange={(e) => setTarget({ ...target, spaceName: e.target.value, listName: spaces.find((x) => x.name === e.target.value)?.lists[0] ?? "" })}>
                {(spaces.some((x) => x.name === target.spaceName) ? spaces : [{ name: target.spaceName, lists: [target.listName] }, ...spaces]).map((x) => (
                  <option key={x.name} value={x.name}>
                    {x.name}
                  </option>
                ))}
              </select>
              <select className="input" aria-label="List" value={target.listName} onChange={(e) => setTarget({ ...target, listName: e.target.value })}>
                {(spaces.find((x) => x.name === target.spaceName)?.lists ?? [target.listName]).map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
              <select className="input" aria-label="Assign to" value={target.assignee} onChange={(e) => setTarget({ ...target, assignee: e.target.value })}>
                <option value="implementer">the implementer</option>
                <option value="deal_owner">the deal owner</option>
                <option value="trigger_assignees">the task's owners</option>
                <option value="admin">a founder</option>
              </select>
              <select className="input" aria-label="Link the tasks to" value={target.link} onChange={(e) => setTarget({ ...target, link: e.target.value as typeof target.link })}>
                <option value="client">linked to the client</option>
                <option value="deal">linked to the deal</option>
                <option value="lead">linked to the lead</option>
                <option value="none">not linked</option>
              </select>
            </div>
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

const ROLES: { value: TemplateItem["role"]; label: string }[] = [
  { value: "assignee", label: "Whoever the rule assigns" },
  { value: "implementer", label: "The implementer" },
  { value: "deal_owner", label: "The deal owner" },
  { value: "admin", label: "A founder" },
];

/** Create or edit a task template: the checklist of tasks an automation (or a person) creates in one go. */
const TemplateEditor = ({ template, onClose, onSaved }: { template: TaskTemplate | null; onClose: () => void; onSaved: () => void }) => {
  const toast = useToast();
  const blank: TemplateItem = { title: "", estimateHours: 1, dueOffsetDays: 1, category: null, priority: "normal", role: "assignee" };
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [items, setItems] = useState<TemplateItem[]>(template?.items.length ? template.items : [blank]);
  const set = (i: number, patch: Partial<TemplateItem>) => setItems(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <Modal open onClose={onClose} title={template ? `Edit · ${template.name}` : "New task template"} width={760}>
      <form
        className="flex flex-col gap-4 text-[13px]"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await data.saveTaskTemplate({ ...(template ? { id: template.id } : {}), name, description, items: items.filter((x) => x.title.trim()) });
            toast("Template saved", "good");
            onSaved();
          } catch (err) {
            toast((err as Error).message, "error");
          }
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="field-label">Name</span>
            <input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Gllarix onboarding" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="field-label">What it's for</span>
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
        </div>
        <div className="flex flex-col gap-2">
          <span className="field-label">Tasks, in order</span>
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_80px_80px_170px_32px] items-center gap-2">
              <input className="input h-9" aria-label={`Task ${i + 1} title`} value={it.title} onChange={(e) => set(i, { title: e.target.value })} placeholder="Task title" />
              <input className="input h-9" type="number" min={0} aria-label="Due after (days)" title="Due this many days after the trigger" value={it.dueOffsetDays} onChange={(e) => set(i, { dueOffsetDays: Number(e.target.value) || 0 })} />
              <input className="input h-9" type="number" min={0} step={0.5} aria-label="Estimate (hours)" title="Estimate in hours" value={it.estimateHours ?? ""} onChange={(e) => set(i, { estimateHours: e.target.value === "" ? null : Number(e.target.value) })} />
              <select className="input h-9" aria-label="Who" value={it.role} onChange={(e) => set(i, { role: e.target.value as TemplateItem["role"] })}>
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <button type="button" aria-label={`Remove task ${i + 1}`} className="btn-ghost h-8 px-2 text-text-3 hover:text-coral" onClick={() => setItems(items.filter((_, j) => j !== i))} disabled={items.length === 1}>
                ×
              </button>
            </div>
          ))}
          <span className="text-[11px] text-text-3">Columns: title · due after N days · estimate in hours · who gets it.</span>
          <button type="button" className="btn-outline self-start h-8 text-[12px]" onClick={() => setItems([...items, blank])}>
            + Task
          </button>
        </div>
        <button type="submit" className="btn-primary" disabled={!name.trim() || !items.some((x) => x.title.trim())}>
          Save template
        </button>
      </form>
    </Modal>
  );
};

/** Automations ("when X then Y"), task templates and the run log (A15). */
/** `intro` renders under the title (Growth › Automations puts "Runs by itself" there). */
export const AutomationsView = ({ intro }: { intro?: ReactNode }) => {
  const user = useUser();
  const [d, setD] = useState<{ automations: Automation[]; templates: TaskTemplate[]; runs: AutomationRun[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [openTpl, setOpenTpl] = useState<string | null>(null);
  const [editing, setEditing] = useState<Automation | null>(null);
  const [tpl, setTpl] = useState<TaskTemplate | "new" | null>(null);
  const toast = useToast();
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
        <h1 className="page-title m-0">Automations</h1>
        {admin ? (
          <button type="button" className="btn-primary h-9 text-[11px]" onClick={() => setCreating(true)}>
            New automation
          </button>
        ) : null}
      </div>
      {intro}
      {intro ? <span className="-mb-2 text-[15px] font-semibold">Your rules</span> : null}
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
                <button type="button" className="text-[12px] text-text-2 hover:text-text" onClick={() => setEditing(a)}>
                  Edit
                </button>
                <button type="button" className="text-[12px] text-coral" onClick={async () => window.confirm(`Delete "${a.name}"?`) && (await data.deleteAutomation(a.id), load())}>
                  Delete
                </button>
              </span>
            ) : null}
          </div>
        ))}
      </section>

      <section aria-label="Task templates" className="card flex flex-col">
        <span className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <span className="label-caps">Task templates</span>
          {admin ? (
            <button type="button" className="btn-outline h-8 text-[12px]" onClick={() => setTpl("new")}>
              + Template
            </button>
          ) : null}
        </span>
        {d.templates.map((t) => (
          <div key={t.id} className="border-b border-line-soft last:border-b-0">
            <button type="button" className="flex w-full justify-between gap-3 px-4 py-3 text-left text-[13px] hover:bg-surface-2" onClick={() => setOpenTpl(openTpl === t.id ? null : t.id)} aria-expanded={openTpl === t.id}>
              <span>
                {t.name} <span className="text-text-3">· {t.description}</span>
              </span>
              <span className="text-text-3">{t.items.length} tasks</span>
            </button>
            {openTpl === t.id ? (
              <div className="flex flex-col gap-2 bg-bg-deep px-10 py-3">
                <ol className="m-0 flex flex-col gap-1 text-[12px] text-text-2">
                  {t.items.map((it, i) => (
                    <li key={i}>
                      {it.title} · due +{it.dueOffsetDays} days · {it.estimateHours ?? "—"} h · {it.role.replace("_", " ")}
                      {it.dependsOnPrevious ? " · after the previous one" : ""}
                      {it.checklist?.length ? ` · checklist: ${it.checklist.join(", ")}` : ""}
                    </li>
                  ))}
                </ol>
                {admin ? (
                  <span className="flex gap-2">
                    <button type="button" className="btn-outline h-8 text-[12px]" onClick={() => setTpl(t)}>
                      Edit template
                    </button>
                    <button
                      type="button"
                      className="btn-ghost h-8 text-[12px] text-coral"
                      onClick={async () => {
                        if (!window.confirm(`Delete the "${t.name}" template?`)) return;
                        try {
                          await data.deleteTaskTemplate(t.id);
                          load();
                        } catch (e) {
                          toast((e as Error).message, "error");
                        }
                      }}
                    >
                      Delete
                    </button>
                  </span>
                ) : null}
              </div>
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
      {creating || editing ? (
        <AutomationEditor
          templates={d.templates}
          existing={editing ?? undefined}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            load();
          }}
        />
      ) : null}
      {tpl ? (
        <TemplateEditor
          template={tpl === "new" ? null : tpl}
          onClose={() => setTpl(null)}
          onSaved={() => {
            setTpl(null);
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
        <h1 className="page-title m-0">Goals</h1>
        {user.role === "admin" ? (
          <button type="button" className="btn-primary h-9 text-[11px]" onClick={() => setForm({ title: "", kpi: "mrr_eur", target: "", dueAt: "", ownerId: user.id })}>
            New goal
          </button>
        ) : null}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {goals.map((g) => (
          <section key={g.goal.id} aria-label={g.goal.title} className="card flex flex-col gap-2.5 p-5">
            <div className="flex justify-between gap-3">
              <span className="text-[15px]">{g.goal.title}</span>
              <span className="text-[12px] font-medium " style={{ color: tone[g.status] }}>
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
