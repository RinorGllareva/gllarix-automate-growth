import { useCallback, useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useUser } from "@/auth/AuthContext";
import { useToast } from "@/components/ui/overlay";
import { Avatar, EmptyState, Icon, ICONS, SkeletonRows } from "@/components/ui/primitives";
import { MAX_ATTACHMENT_BYTES, PRIORITY_META, STATUS_META } from "@/config/tasks";
import { data, type GoalView, type LinkType, type PlanView, type TaskDetail, type TaskPatch, type TaskPriority, type TaskRow, type TaskStatus } from "@/data";
import { Modal } from "@/components/ui/overlay";
import { hours, isOpen } from "@/services/tasks";
import { CategoryChip, PriorityText, StatusBox, StatusPill, dueLabel, taskEmoji, todayKey, useTasks } from "./shared";

const DESCRIPTION_TEMPLATE = "## Background\n\n## Scope\n\n## Out of scope\n\n## Acceptance criteria\n- [ ] \n";

/** Minimal Markdown preview: headings, bullet and check lists, paragraphs. Text only (no HTML). */
const Markdown = ({ text }: { text: string }) => {
  const out: ReactNode[] = [];
  let list: ReactNode[] = [];
  const flush = () => {
    if (list.length) out.push(<ul key={`u${out.length}`} className="m-0 flex list-disc flex-col gap-1 pl-5">{list}</ul>);
    list = [];
  };
  text.split("\n").forEach((line, i) => {
    const h = line.match(/^(#{1,3})\s+(.*)/);
    const sizes = ["text-[24px]", "text-[20px]", "text-[16px]"];
    const li = line.match(/^\s*[-*]\s+(\[( |x)\]\s+)?(.*)/i);
    if (h) {
      flush();
      const Tag = (["h2", "h3", "h4"] as const)[h[1].length - 1];
      out.push(<Tag key={i} className={`m-0 mt-4 font-bold leading-snug tracking-[-0.01em] text-text first:mt-0 ${sizes[h[1].length - 1]}`}>{h[2]}</Tag>);
    } else if (li) list.push(<li key={i}>{li[1] ? `${li[2].toLowerCase() === "x" ? "☑" : "☐"} ` : ""}{li[3]}</li>);
    else if (line.trim()) {
      flush();
      out.push(<p key={i} className="m-0">{line}</p>);
    } else flush();
  });
  flush();
  return <div className="flex flex-col gap-2.5 text-[15px] leading-relaxed text-text-2">{out.length ? out : <span className="text-text-3">No description yet. Double-click to write one.</span>}</div>;
};

const Card = ({ label, children, accent }: { label: ReactNode; children: ReactNode; accent?: boolean }) => (
  <section className={`flex flex-col gap-2.5 rounded-xl px-[18px] py-4 text-[13px] ${accent ? "border border-cyan-line" : "bg-surface"}`}>
    <span className={`label-caps ${accent ? "text-cyan" : ""}`}>{label}</span>
    {children}
  </section>
);

const Field = ({ k, children }: { k: string; children: ReactNode }) => (
  <div className="grid min-h-9 grid-cols-[140px_minmax(0,1fr)] items-center gap-3 rounded-md px-1 text-[13px] hover:bg-surface-2/50">
    <span className="text-text-3">{k}</span>
    <span className="min-w-0">{children}</span>
  </div>
);

/** One property in the page's top row: small label above, value below (Notion style). */
const Prop = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex min-w-0 flex-col gap-1">
    <span className="text-[12px] text-text-3">{label}</span>
    {children}
  </div>
);

const elapsed = (from: string) => {
  const s = Math.max(0, Math.floor((Date.now() - new Date(from).getTime()) / 1000));
  return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

const TaskSearch = ({ exclude, onPick, placeholder }: { exclude: string[]; onPick: (r: TaskRow) => void; placeholder: string }) => {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<TaskRow[]>([]);
  useEffect(() => {
    const t = window.setTimeout(() => (q.trim().length >= 2 ? data.searchTasks(q).then((r) => setHits(r.filter((x) => !exclude.includes(x.task.id)))) : setHits([])), 150);
    return () => window.clearTimeout(t);
  }, [q, exclude]);
  return (
    <div className="flex flex-col gap-1">
      <input className="input h-8" placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} />
      {hits.map((h) => (
        <button key={h.task.id} type="button" className="truncate text-left text-[12px] text-text-2 hover:text-text" onClick={() => (onPick(h), setQ(""))}>
          + {h.task.title} <span className="text-text-3">· {h.listName}</span>
        </button>
      ))}
    </div>
  );
};

const LinkPicker = ({ onPick }: { onPick: (l: { type: LinkType; id: string }) => void }) => {
  const [type, setType] = useState<LinkType>("lead");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ id: string; label: string }[]>([]);
  useEffect(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return setHits([]);
    const t = window.setTimeout(async () => {
      try {
        if (type === "lead") {
          const page = await data.listLeads({ tiers: [], lists: [], countries: [], stages: [], owners: [], sources: [], brands: [], q, sort: "score", dir: "desc", page: 1 });
          setHits(page.rows.slice(0, 6).map((r) => ({ id: r.lead.id, label: r.company.name })));
        } else if (type === "deal") {
          const deals = await data.listDeals();
          setHits(deals.filter((d) => d.company.name.toLowerCase().includes(needle)).slice(0, 6).map((d) => ({ id: d.deal.id, label: `${d.company.name} · ${d.deal.stage}` })));
        } else if (type === "client") {
          const o = await data.clientsOverview();
          setHits(o.cards.filter((c) => c.status !== "proposal" && c.companyName.toLowerCase().includes(needle)).slice(0, 6).map((c) => ({ id: c.id, label: c.companyName })));
        } else {
          const w = await data.listMeetings();
          setHits(w.rows.filter((m) => m.company.name.toLowerCase().includes(needle)).slice(0, 6).map((m) => ({ id: m.meeting.id, label: `${m.company.name} · ${m.meeting.scheduledAt.slice(0, 10)}` })));
        }
      } catch {
        setHits([]);
      }
    }, 150);
    return () => window.clearTimeout(t);
  }, [q, type]);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <select aria-label="Link type" className="input h-8 w-28" value={type} onChange={(e) => setType(e.target.value as LinkType)}>
          <option value="lead">Lead</option>
          <option value="deal">Deal</option>
          <option value="client">Client</option>
          <option value="meeting">Meeting</option>
        </select>
        <input className="input h-8 flex-1" placeholder="Company name" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {hits.map((h) => (
        <button key={h.id} type="button" className="truncate text-left text-[12px] text-text-2 hover:text-text" onClick={() => onPick({ type, id: h.id })}>
          + {h.label}
        </button>
      ))}
    </div>
  );
};

/** Task detail (17_TASK_DETAIL.md), as a full page or in the side panel. Every field saves on change. */
const TaskDetailView = ({ id, panel = false, onChanged }: { id: string; panel?: boolean; onChanged?: () => void }) => {
  const { home, refresh, openTask } = useTasks();
  const user = useUser();
  const toast = useToast();
  const navigate = useNavigate();
  const [d, setD] = useState<TaskDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState(false);
  const [desc, setDesc] = useState("");
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const [newSub, setNewSub] = useState("");
  const [newCheck, setNewCheck] = useState("");
  const [timeForm, setTimeForm] = useState<{ h: string; date: string; note: string } | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [details, setDetails] = useState(false);
  const [linking, setLinking] = useState(false);
  const [tagText, setTagText] = useState("");
  const [, tick] = useState(0);
  const dragSub = useRef<string | null>(null);
  const [fit, setFit] = useState<{ text: string; risks: string[] } | null>(null);
  const [goals, setGoals] = useState<GoalView[]>([]);
  const [splitDraft, setSplitDraft] = useState<PlanView | null>(null);
  const [splitting, setSplitting] = useState<"idle" | "loading">("idle");
  useEffect(() => {
    data.listGoals().then(setGoals, () => setGoals([]));
  }, []);
  useEffect(() => {
    if (d) data.taskFit(id).then(setFit, () => setFit(null));
    // Re-check when dates, owners or estimates change.
  }, [id, d?.task.dueAt, d?.task.startAt, d?.task.estimateMinutes, d?.task.assigneeIds.join(), d?.task.status]); // eslint-disable-line react-hooks/exhaustive-deps
  const startSplit = async () => {
    setSplitting("loading");
    try {
      setSplitDraft(await data.splitTask(id));
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSplitting("idle");
    }
  };

  const load = useCallback(
    () =>
      data.getTask(id).then(
        (x) => {
          setD(x);
          setTitle(x.task.title);
          setDesc(x.task.descriptionMd);
        },
        (e: Error) => setError(e.message),
      ),
    [id],
  );
  useEffect(() => {
    setD(null);
    load();
  }, [load]);
  useEffect(() => {
    if (!d?.timer) return;
    const t = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, [d?.timer]);

  const after = () => {
    load();
    refresh();
    onChanged?.();
  };
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      if (ok) toast(ok, "good");
    } catch (e) {
      toast((e as Error).message, "error");
    }
    after();
  };
  const patch = async (p: TaskPatch) => {
    if (!d) return;
    setD({ ...d, task: { ...d.task, ...p } });
    try {
      await data.updateTask(id, p);
    } catch (e) {
      const msg = (e as Error).message;
      if (/open subtask/.test(msg) && window.confirm(`${msg}`)) await data.updateTask(id, { ...p, completeSubtasks: true });
      else toast(msg, "error");
    }
    after();
  };

  if (error) return <EmptyState title={error} />;
  if (!d) return <SkeletonRows rows={8} />;
  const t = d.task;
  const myTimer = d.timer;
  const runningHere = myTimer?.taskId === t.id;
  const waitingOpen = d.waitingOn.filter((r) => isOpen(r.task.status));

  const onDropFiles = async (e: DragEvent) => {
    e.preventDefault();
    for (const file of Array.from(e.dataTransfer.files)) await attach(file);
  };
  const attach = async (file: File) => {
    if (file.size > MAX_ATTACHMENT_BYTES) return toast(`${file.name} is over 2 MB (demo limit).`, "error");
    const url = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = rej;
      r.readAsDataURL(file);
    });
    await run(() => data.addAttachment(t.id, { fileName: file.name, contentType: file.type || "application/octet-stream", size: file.size, url }), `Attached ${file.name}`);
  };

  const where = { space: d.space };
  const listName = d.list.name;
  const overdue = !!t.dueAt && t.dueAt < todayKey() && isOpen(t.status);

  return (
    <div className={`grid gap-10 ${panel ? "" : "xl:grid-cols-[minmax(0,1fr)_320px]"}`}>
      <div className={`flex min-w-0 flex-col gap-5 ${panel ? "" : "mx-auto w-full max-w-[860px]"}`}>
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-text-3">
          {where ? (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: `var(--${where.space.color})` }} aria-hidden="true" />
              {where.space.name}
              {listName ? <span>/ {listName}</span> : null}
            </span>
          ) : null}
          {d.parent ? (
            <button type="button" className="text-cyan hover:underline" onClick={() => openTask(d.parent!.id)}>
              / {d.parent.title}
            </button>
          ) : null}
          {t.createdByAi ? <span className="rounded-full bg-cyan-tint px-2 py-0.5 text-[10px] tracking-[0.16em] text-cyan">AI</span> : null}
          {panel ? (
            <Link to={`/tasks/${t.id}`} className="ml-auto text-cyan">
              Open full page ↗
            </Link>
          ) : null}
        </div>

        {/* Notion-style page header: big icon, big bold title. */}
        <div className="flex flex-col gap-3">
          <span className="text-[52px] leading-none" aria-hidden="true">
            {taskEmoji(t)}
          </span>
          <textarea
            aria-label="Title"
            rows={1}
            className="m-0 w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-[34px] font-bold leading-tight tracking-[-0.02em] text-text [field-sizing:content] focus:outline-none"
            value={title}
            onChange={(e) => setTitle(e.target.value.replace(/\n/g, ""))}
            onBlur={() => title.trim() && title !== t.title && patch({ title })}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), (e.target as HTMLTextAreaElement).blur())}
          />
          {waitingOpen.length ? <span className="text-[12px] text-amber">Waiting on {waitingOpen.length} unfinished task{waitingOpen.length > 1 ? "s" : ""}: {waitingOpen.map((w) => w.task.title).join(", ")}</span> : null}
        </div>

        {/* Property row: the few that matter at a glance. */}
        <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
          <Prop label="Team">
            <span className="flex h-7 items-center gap-1.5 text-[13px]">{where ? where.space.name : "—"}</span>
          </Prop>
          <Prop label="Owner">
            <span className="flex h-7 items-center gap-1.5 text-[13px]">
              {d.assignees?.length ? (
                <>
                  <span className="flex -space-x-1.5">
                    {d.assignees.slice(0, 4).map((a) => (
                      <Avatar key={a.id} id={a.id} name={a.name} size={22} />
                    ))}
                  </span>
                  <span className="truncate">{d.assignees.map((a) => a.name.split(" ")[0]).join(", ")}</span>
                </>
              ) : (
                <span className="text-text-3">Nobody</span>
              )}
            </span>
          </Prop>
          <Prop label="Status">
            <span className="relative flex h-7 items-center">
              <StatusPill s={t.status} />
              <select aria-label="Status" value={t.status} onChange={(e) => patch({ status: e.target.value as TaskStatus })} className="absolute inset-0 cursor-pointer opacity-0">
                {(Object.keys(STATUS_META) as TaskStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_META[s].label}
                  </option>
                ))}
              </select>
            </span>
          </Prop>
          <Prop label="Priority">
            <span className="relative flex h-7 items-center">
              <PriorityText p={t.priority} />
              <select aria-label="Priority" value={t.priority} onChange={(e) => patch({ priority: e.target.value as TaskPriority })} className="absolute inset-0 cursor-pointer opacity-0">
                {(Object.keys(PRIORITY_META) as TaskPriority[]).map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_META[p].label}
                  </option>
                ))}
              </select>
            </span>
          </Prop>
          <Prop label="Due">
            <span className={`flex h-7 items-center font-mono text-[13px] ${overdue ? "text-coral" : ""}`}>{t.dueAt ? dueLabel(t.dueAt) : <span className="text-text-3">—</span>}</span>
          </Prop>
          <Prop label="Category">
            <span className="relative flex h-7 items-center">
              <CategoryChip c={t.category} />
              <select aria-label="Category" value={t.category ?? ""} onChange={(e) => patch({ category: e.target.value || null })} className="absolute inset-0 cursor-pointer opacity-0">
                <option value="">No category</option>
                {home.categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </span>
          </Prop>
        </div>

        <button type="button" className="flex items-center gap-1.5 self-start rounded-md px-1 py-0.5 text-[13px] text-text-3 hover:bg-surface-2 hover:text-text" aria-expanded={details} onClick={() => setDetails((x) => !x)}>
          <Icon d={details ? ICONS.chevronLeft : ICONS.chevronRight} size={14} className={details ? "-rotate-90" : ""} />
          {details ? "Hide details" : "View details"}
        </button>
        {details ? <div className="flex flex-col gap-0.5 rounded-lg bg-surface px-3 py-2">
          <Field k="Owners">
            <span className="flex flex-wrap gap-1">
              {home.users.map((u) => {
                const on = t.assigneeIds.includes(u.id);
                return (
                  <button key={u.id} type="button" aria-pressed={on} onClick={() => patch({ assigneeIds: on ? t.assigneeIds.filter((a) => a !== u.id) : [...t.assigneeIds, u.id] })} className={`h-6 border px-1.5 text-[11px] ${on ? "border-ice bg-ice text-ice-ink" : "border-line-strong text-text-3 hover:text-text"}`}>
                    {u.name.split(" ")[0]}
                  </button>
                );
              })}
            </span>
          </Field>
          <Field k="Start">
            <input type="date" aria-label="Start date" className="border-0 bg-transparent font-mono text-[12px] text-text" value={t.startAt ?? ""} onChange={(e) => patch({ startAt: e.target.value || null })} />
          </Field>
          <Field k="Due">
            <input type="date" aria-label="Due date" className={`border-0 bg-transparent font-mono text-[12px] ${t.dueAt && t.dueAt < todayKey() && isOpen(t.status) ? "text-coral" : "text-text"}`} value={t.dueAt ?? ""} onChange={(e) => patch({ dueAt: e.target.value || null })} />
          </Field>
          <Field k="Estimate">
            <input
              aria-label="Estimate in hours"
              className="w-20 border-0 bg-transparent font-mono text-[12px] text-text"
              defaultValue={t.estimateMinutes ? String(t.estimateMinutes / 60) : ""}
              placeholder="hours"
              onBlur={(e) => {
                const v = e.target.value.trim() === "" ? null : Math.round(Number(e.target.value) * 60);
                if (v === null || Number.isFinite(v)) if (v !== t.estimateMinutes) patch({ estimateMinutes: v });
              }}
            />
          </Field>
          <Field k="List">
            <select aria-label="List" className="max-w-[190px] border-0 bg-transparent text-[13px] text-text" value={t.listId} onChange={(e) => patch({ listId: e.target.value })}>
              {home.spaces.flatMap((x) =>
                x.lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {x.space.name} / {l.name}
                  </option>
                )),
              )}
            </select>
          </Field>
          <Field k="Linked">
            {d.linked ? (
              <span className="flex items-center gap-2">
                <Link to={d.linked.href}>{d.linked.label}</Link>
                <button type="button" aria-label="Remove link" className="text-text-3 hover:text-coral" onClick={() => patch({ linked: null })}>
                  ×
                </button>
              </span>
            ) : (
              <button type="button" className="text-cyan" onClick={() => setLinking((x) => !x)}>
                {linking ? "Cancel" : "+ Link a record"}
              </button>
            )}
          </Field>
          {linking ? (
            <LinkPicker
              onPick={(l) => {
                setLinking(false);
                patch({ linked: l });
              }}
            />
          ) : null}
          <Field k="Tags">
            <span className="flex flex-wrap gap-1">
              {t.tags.map((g) => (
                <button key={g} type="button" className="border border-line-strong px-1.5 text-[11px] text-text-2 hover:text-coral" onClick={() => patch({ tags: t.tags.filter((x) => x !== g) })} title="Remove tag">
                  {g} ×
                </button>
              ))}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = tagText.trim().toLowerCase();
                  if (v && !t.tags.includes(v)) patch({ tags: [...t.tags, v] });
                  setTagText("");
                }}
              >
                <input aria-label="Add tag" className="w-16 border-0 bg-transparent text-[12px] text-text" placeholder="+ tag" value={tagText} onChange={(e) => setTagText(e.target.value)} />
              </form>
            </span>
          </Field>
          <Field k="Repeats">
            <select
              aria-label="Repeats"
              className="border-0 bg-transparent text-[13px] text-text"
              value={t.recurrence ? `${t.recurrence.freq}:${t.recurrence.interval}` : ""}
              onChange={(e) => {
                const [freq, n] = e.target.value.split(":");
                patch({ recurrence: e.target.value ? { freq: freq as "daily" | "weekdays" | "weekly" | "monthly", interval: Number(n) } : null });
              }}
            >
              <option value="">Doesn't repeat</option>
              <option value="daily:1">Every day</option>
              <option value="weekdays:1">Every weekday</option>
              <option value="weekly:1">Every week</option>
              <option value="weekly:2">Every 2 weeks</option>
              <option value="monthly:1">Every month</option>
            </select>
          </Field>
          <Field k="Goal">
            <select aria-label="Goal" className="max-w-[190px] border-0 bg-transparent text-[13px] text-text" value={t.goalId ?? ""} onChange={(e) => patch({ goalId: e.target.value || null })}>
              <option value="">None</option>
              {goals.map((g) => (
                <option key={g.goal.id} value={g.goal.id}>
                  {g.goal.title}
                </option>
              ))}
            </select>
          </Field>
          <Field k="Created by">
            <span className="text-text-2">
              {d.createdByName ?? "Atlas"}
              {t.createdByAi && d.acceptedByName ? ` · accepted by ${d.acceptedByName}` : ""}
              {t.importedFrom ? ` · imported from ${t.importedFrom}` : ""}
            </span>
          </Field>
          </div> : null}

        <section aria-label="Comments" className="flex flex-col gap-3" onDragOver={(e) => e.preventDefault()} onDrop={onDropFiles}>
          <span className="text-[13px] font-semibold">Comments{d.comments.length ? <span className="ml-1.5 font-normal text-text-3">{d.comments.length}</span> : null}</span>
          {d.comments.map((c) => (
            <div key={c.id} className="flex gap-3">
              <Avatar id={c.userId} name={c.userName} size={26} />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex flex-wrap gap-2 text-[12px] text-text-3">
                  {c.userName} · {new Intl.DateTimeFormat("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(c.createdAt))}
                  {c.editedAt ? " · edited" : ""}
                  {c.userId === user.id ? (
                    <>
                      <button type="button" className="text-cyan" onClick={() => setEditing({ id: c.id, body: c.body })}>
                        Edit
                      </button>
                      <button type="button" className="text-coral" onClick={() => window.confirm("Delete this comment?") && run(() => data.deleteComment(c.id))}>
                        Delete
                      </button>
                    </>
                  ) : null}
                </span>
                {editing?.id === c.id ? (
                  <form
                    className="flex flex-col gap-2"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      await run(() => data.editComment(c.id, editing.body));
                      setEditing(null);
                    }}
                  >
                    <textarea className="input h-16" value={editing.body} onChange={(e) => setEditing({ id: c.id, body: e.target.value })} />
                    <span className="flex gap-2">
                      <button type="submit" className="btn-outline h-8 text-[11px]">
                        Save
                      </button>
                      <button type="button" className="btn-ghost h-8 text-[11px]" onClick={() => setEditing(null)}>
                        Cancel
                      </button>
                    </span>
                  </form>
                ) : (
                  <span className="whitespace-pre-wrap text-[14px]">
                    {c.body.split(/(@[\p{L}]+(?: [\p{L}]+)?)/u).map((part, i) => (part.startsWith("@") ? <span key={i} className="text-cyan">{part}</span> : part))}
                  </span>
                )}
              </div>
            </div>
          ))}
          {d.attachments.length ? (
            <div className="flex flex-wrap gap-2">
              {d.attachments.map((a) => (
                <span key={a.id} className="flex items-center gap-2 border border-line px-2.5 py-1.5 text-[12px]">
                  <a href={a.url} download={a.fileName}>
                    {a.fileName}
                  </a>
                  <span className="text-text-3">{Math.ceil(a.size / 1024)} KB</span>
                  <button type="button" aria-label={`Remove ${a.fileName}`} className="text-text-3 hover:text-coral" onClick={() => run(() => data.removeAttachment(a.id))}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          <form
            className="flex flex-col gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!comment.trim()) return;
              await run(() => data.addComment(t.id, comment));
              setComment("");
            }}
          >
            <span className="flex items-start gap-3">
              <Avatar id={user.id} name={user.name} size={26} />
              <textarea aria-label="Write a comment" rows={1} className={`min-w-0 flex-1 resize-none border-0 bg-transparent p-0 pt-1 text-[14px] text-text placeholder:text-text-3 focus:outline-none ${comment ? "min-h-[64px]" : ""}`} placeholder="Add a comment… (@ to mention, drop files to attach)" value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && (e.currentTarget.form?.requestSubmit())} />
            </span>
            <span className="flex items-center gap-3 pl-[38px]">
              <button type="submit" className="btn-outline h-8 text-[11px]" disabled={!comment.trim()}>
                Comment
              </button>
              <label className="cursor-pointer text-[11px] text-cyan">
                Attach file
                <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && attach(e.target.files[0])} />
              </label>
              <span className="text-[11px] text-text-3">{home.users.map((u) => `@${u.name.split(" ")[0]}`).join(" ")}</span>
            </span>
          </form>
        </section>


        <hr className="my-1 border-0 border-t border-line" />

        <section aria-label="Description" className="group/desc flex flex-col gap-2">
          <div className="flex min-h-6 items-center justify-end gap-3 text-[12px]">
            {editDesc ? (
              <button type="button" className="text-cyan" onClick={() => setDesc((x) => (x.trim() ? `${x}\n\n${DESCRIPTION_TEMPLATE}` : DESCRIPTION_TEMPLATE))}>
                Template
              </button>
            ) : null}
            <button
              type="button"
              className={`text-cyan ${editDesc ? "" : "opacity-60 group-hover/desc:opacity-100"}`}
              onClick={() => {
                if (editDesc && desc !== t.descriptionMd) patch({ descriptionMd: desc });
                setEditDesc((x) => !x);
              }}
            >
              {editDesc ? "Save" : "Edit description"}
            </button>
          </div>
          {editDesc ? (
            <textarea aria-label="Description (Markdown)" className="input min-h-[220px] rounded-lg font-mono text-[13px]" value={desc} onChange={(e) => setDesc(e.target.value)} />
          ) : (
            <div onDoubleClick={() => setEditDesc(true)} title="Double-click to edit">
              <Markdown text={t.descriptionMd} />
            </div>
          )}
        </section>

        {!t.parentId ? (
          <section aria-label="Subtasks" className="overflow-hidden rounded-xl bg-surface">
            <div className="flex justify-between border-b border-line px-4 py-3 text-[11px] tracking-[0.22em] text-label">
              <span>
                SUBTASKS · {d.subtasks.filter((s) => s.task.status === "done").length} OF {d.subtasks.length}
              </span>
              <button type="button" className="text-cyan hover:text-text" onClick={startSplit} disabled={splitting === "loading"}>
                {splitting === "loading" ? "SPLITTING…" : "SPLIT WITH AI ↗"}
              </button>
            </div>
            {d.subtasks.map((s) => (
              <div
                key={s.task.id}
                draggable
                onDragStart={() => (dragSub.current = s.task.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={async () => {
                  const from = dragSub.current;
                  if (!from || from === s.task.id) return;
                  const idx = d.subtasks.findIndex((x) => x.task.id === s.task.id);
                  const prev = d.subtasks[idx - 1]?.task.position ?? s.task.position - 1000;
                  await run(() => data.updateTask(from, { position: (prev + s.task.position) / 2 }));
                }}
                className="grid h-[42px] grid-cols-[20px_minmax(0,1fr)_90px_56px] items-center gap-3 border-b border-line-soft px-4 text-[13px] last:border-b-0"
              >
                <input type="checkbox" aria-label={`Done: ${s.task.title}`} checked={s.task.status === "done"} onChange={(e) => run(() => data.updateTask(s.task.id, { status: e.target.checked ? "done" : "todo" }))} className="accent-[var(--mint)]" />
                <button type="button" className={`truncate text-left ${s.task.status === "done" ? "text-text-3 line-through" : ""}`} onClick={() => openTask(s.task.id)}>
                  {s.task.title}
                </button>
                <span className="truncate text-[11px] text-text-3">{s.assignees.map((a) => a.name.split(" ")[0]).join(", ") || "—"}</span>
                <span className="font-mono text-[12px] text-text-2">{hours(s.task.estimateMinutes)}</span>
              </div>
            ))}
            <form
              className="flex gap-2 px-4 py-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newSub.trim()) return;
                await run(() => data.createTask({ listId: t.listId, parentId: t.id, title: newSub, assigneeIds: t.assigneeIds.length ? [t.assigneeIds[0]] : [user.id] }));
                setNewSub("");
              }}
            >
              <input className="input h-8 flex-1" placeholder="+ Add subtask" value={newSub} onChange={(e) => setNewSub(e.target.value)} />
            </form>
          </section>
        ) : null}

        <section aria-label="Checklist" className="flex flex-col gap-1.5">
          <span className="label-caps">Checklist · {d.checklist.filter((c) => c.done).length}/{d.checklist.length}</span>
          {d.checklist.map((c) => (
            <div key={c.id} className="group flex items-center gap-2.5 text-[13px]">
              <input type="checkbox" aria-label={c.text} checked={c.done} onChange={(e) => run(() => data.updateChecklistItem(c.id, { done: e.target.checked }))} className="accent-[var(--mint)]" />
              <span className={c.done ? "text-text-3 line-through" : ""}>{c.text}</span>
              <button type="button" aria-label={`Remove ${c.text}`} className="ml-auto text-[11px] text-text-3 opacity-0 hover:text-coral group-hover:opacity-100" onClick={() => run(() => data.deleteChecklistItem(c.id))}>
                Remove
              </button>
            </div>
          ))}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newCheck.trim()) return;
              await run(() => data.addChecklistItem(t.id, newCheck));
              setNewCheck("");
            }}
          >
            <input className="input h-8 w-full" placeholder="+ Add item" value={newCheck} onChange={(e) => setNewCheck(e.target.value)} />
          </form>
        </section>

        <section aria-label="Activity log" className="flex flex-col gap-1.5">
          <button type="button" className="label-caps self-start" onClick={() => setShowLog((x) => !x)} aria-expanded={showLog}>
            Activity · {d.activity.length} {showLog ? "▴" : "▾"}
          </button>
          {showLog
            ? d.activity.map((a) => (
                <span key={a.id} className="text-[12px] text-text-2">
                  <span className="num font-mono text-text-3">{new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(a.at))}</span> · {a.userName ?? "Atlas"} · {a.text}
                </span>
              ))
            : null}
        </section>
      </div>

      <aside className="flex flex-col gap-3.5">
        <Card
          label={
            <span className="flex justify-between">
              <span>Time</span>
              <span className="font-mono tracking-normal">
                {hours(d.spentMinutes)} / {hours(t.estimateMinutes)}
              </span>
            </span>
          }
        >
          <div className="h-[3px] bg-line">
            <div className={`h-[3px] ${t.estimateMinutes && d.spentMinutes > t.estimateMinutes ? "bg-amber" : "bg-cyan"}`} style={{ width: `${t.estimateMinutes ? Math.min(100, (d.spentMinutes / t.estimateMinutes) * 100) : 0}%` }} />
          </div>
          <button
            type="button"
            className={`flex h-10 items-center justify-between border px-3.5 text-[11px] tracking-[0.22em] ${runningHere ? "border-cyan text-cyan" : "border-line-button text-text"}`}
            onClick={() => run(() => (runningHere ? data.stopTimer() : data.startTimer(t.id)), runningHere ? "Time logged" : undefined)}
          >
            <span>{runningHere ? "STOP TIMER" : myTimer ? "SWITCH TIMER HERE" : "START TIMER"}</span>
            <span className="font-mono tracking-normal">{runningHere ? elapsed(myTimer!.startedAt) : "00:00:00"}</span>
          </button>
          {timeForm ? (
            <form
              className="flex flex-wrap gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                await run(() => data.addTimeEntry(t.id, { minutes: Math.round(Number(timeForm.h) * 60), date: timeForm.date, note: timeForm.note }), "Time added");
                setTimeForm(null);
              }}
            >
              <input autoFocus aria-label="Hours" className="input h-8 w-16" placeholder="h" inputMode="decimal" value={timeForm.h} onChange={(e) => setTimeForm({ ...timeForm, h: e.target.value })} />
              <input type="date" aria-label="Date" className="input h-8 w-36" value={timeForm.date} onChange={(e) => setTimeForm({ ...timeForm, date: e.target.value })} />
              <input aria-label="Note" className="input h-8 min-w-0 flex-1" placeholder="Note" value={timeForm.note} onChange={(e) => setTimeForm({ ...timeForm, note: e.target.value })} />
              <button type="submit" className="btn-outline h-8 text-[11px]">
                Add
              </button>
            </form>
          ) : (
            <button type="button" className="self-start text-[12px] text-cyan" onClick={() => setTimeForm({ h: "", date: todayKey(), note: "" })}>
              + Add time
            </button>
          )}
          {d.time.slice(0, 6).map((e) => (
            <div key={e.id} className="flex justify-between gap-2 text-[12px] text-text-2">
              <span className="truncate">
                {dueLabel(e.startedAt.slice(0, 10))} · {e.userName.split(" ")[0]} · {e.source}
                {e.note ? ` · ${e.note}` : ""}
              </span>
              <span className="flex shrink-0 gap-2">
                <span className="font-mono">{hours(e.minutes)}</span>
                {e.userId === user.id ? (
                  <button type="button" aria-label="Remove entry" className="text-text-3 hover:text-coral" onClick={() => run(() => data.deleteTimeEntry(e.id))}>
                    ×
                  </button>
                ) : null}
              </span>
            </div>
          ))}
        </Card>

        <Card label="Blocks">
          {d.blocks.length ? (
            d.blocks.map((b) => (
              <button key={b.task.id} type="button" className="flex items-center gap-2 text-left text-text-2 hover:text-text" onClick={() => openTask(b.task.id)}>
                <StatusBox status={b.task.status} label={b.task.title} />
                {b.task.title}
              </button>
            ))
          ) : (
            <span className="text-text-3">Nothing waits on this.</span>
          )}
          <span className="label-caps mt-1.5">Waiting on</span>
          {d.waitingOn.map((w) => (
            <span key={w.task.id} className="flex items-center gap-2 text-text-2">
              <StatusBox status={w.task.status} label={w.task.title} />
              <button type="button" className="min-w-0 flex-1 truncate text-left hover:text-text" onClick={() => openTask(w.task.id)}>
                {w.task.title}
              </button>
            </span>
          ))}
          <TaskSearch
            exclude={[t.id, ...d.waitingOn.map((w) => w.task.id)]}
            placeholder="+ Waits on… (search tasks)"
            onPick={(r) => run(() => data.addDependency(t.id, r.task.id), `Now waiting on "${r.task.title}"`)}
          />
        </Card>

        <Card label="AI planner" accent>
          <span className="text-text-2">{fit?.text ?? "Checking capacity…"}</span>
          {fit?.risks.map((r) => (
            <span key={r} className="text-amber">
              Risk: {r}
            </span>
          ))}
        </Card>

        {splitDraft ? (
          <Modal open onClose={() => (data.rejectPlan(splitDraft.id), setSplitDraft(null))} title={`Split with AI · ${t.title}`}>
            <div className="flex flex-col gap-3 text-[13px]">
              <span className="text-text-2">A draft of {splitDraft.rows.length} subtasks ({splitDraft.rows.reduce((n, r) => n + r.estimateHours, 0)} h for a {hours(t.estimateMinutes)} task). Nothing is added until you accept.</span>
              {splitDraft.rows.map((r) => (
                <div key={r.key} className="flex justify-between gap-3 border-b border-line-soft pb-1.5">
                  <span>{r.title}</span>
                  <span className="font-mono text-text-2">{r.estimateHours} h</span>
                </div>
              ))}
              <div className="flex justify-end gap-3">
                <button type="button" className="btn-ghost" onClick={() => (data.rejectPlan(splitDraft.id), setSplitDraft(null))}>
                  Discard
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() =>
                    run(async () => {
                      await data.acceptPlan(splitDraft.id);
                      setSplitDraft(null);
                    }, "Subtasks added")
                  }
                >
                  Accept {splitDraft.rows.length} subtasks
                </button>
              </div>
            </div>
          </Modal>
        ) : null}

        <div className="flex justify-between gap-2">
          <span className="text-[11px] text-text-3">Updated {dueLabel(t.updatedAt.slice(0, 10))}</span>
          <button
            type="button"
            className="btn-ghost h-8 text-[11px] text-coral"
            onClick={() =>
              window.confirm("Move this task (and its subtasks) to the trash? Admins can restore it for 30 days.") &&
              run(async () => {
                await data.deleteTask(t.id);
                if (!panel) navigate("/tasks");
              }, "Moved to trash")
            }
          >
            Delete
          </button>
        </div>
      </aside>
    </div>
  );
};

export default TaskDetailView;
