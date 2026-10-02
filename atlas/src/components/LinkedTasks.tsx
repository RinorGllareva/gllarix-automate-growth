import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useUser } from "@/auth/AuthContext";
import { useToast } from "@/components/ui/overlay";
import { PRIORITY_META, STATUS_META } from "@/config/tasks";
import { data, type LinkType, type TaskRow } from "@/data";
import { canAccess } from "@/lib/nav";
import { isOpen } from "@/services/tasks";

const shortDue = (d: string | null) => (d ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`)) : "no date");

/** Tasks linked to a CRM record (A15 Links), with quick add into the matching space. */
const LinkedTasks = ({ type, id, spaceHint = "Sales", compact = false }: { type: LinkType; id: string; spaceHint?: string; compact?: boolean }) => {
  const user = useUser();
  const toast = useToast();
  const [rows, setRows] = useState<TaskRow[] | null>(null);
  const [title, setTitle] = useState("");
  const load = useCallback(() => data.tasksFor(type, id).then(setRows, () => setRows([])), [type, id]);
  useEffect(() => {
    load();
  }, [load]);
  if (!canAccess(user.role, "tasks")) return null;

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      const home = await data.tasksHome();
      const space = home.spaces.find((x) => x.space.name === spaceHint) ?? home.spaces[0];
      const list = space?.lists[0];
      if (!list) throw new Error("No task list you can add to yet.");
      await data.createTask({ listId: list.id, title, linked: { type, id }, assigneeIds: [user.id] });
      setTitle("");
      load();
    } catch (err) {
      toast((err as Error).message, "error");
    }
  };

  const open = rows?.filter((r) => isOpen(r.task.status)) ?? [];
  const closed = rows?.filter((r) => !isOpen(r.task.status)) ?? [];
  return (
    <section aria-label="Tasks" className="flex flex-col border border-line">
      <span className="label-caps border-b border-line px-4 py-3">
        Tasks{rows ? ` · ${open.length} open` : ""}
      </span>
      {[...open, ...(compact ? [] : closed)].map((r) => (
        <Link key={r.task.id} to={`/tasks/${r.task.id}`} className="flex items-center justify-between gap-3 border-b border-line-soft px-4 py-2.5 text-[13px] last:border-b-0 hover:bg-surface-2">
          <span className="flex min-w-0 items-center gap-2.5">
            <span className={`h-3 w-3 shrink-0 border ${STATUS_META[r.task.status].border} ${r.task.status === "done" ? STATUS_META.done.bg : ""}`} />
            <span className={`truncate ${isOpen(r.task.status) ? "" : "text-text-3 line-through"}`}>{r.task.title}</span>
          </span>
          <span className="flex shrink-0 items-center gap-3 text-[11px]">
            <span className={PRIORITY_META[r.task.priority].text}>{PRIORITY_META[r.task.priority].label}</span>
            <span className="text-text-3">{r.assignees.map((a) => a.name.split(" ")[0]).join(", ") || "—"}</span>
            <span className="font-mono text-text-2">{shortDue(r.task.dueAt)}</span>
          </span>
        </Link>
      ))}
      {rows && !rows.length ? <span className="px-4 py-3 text-[13px] text-text-3">No tasks linked yet.</span> : null}
      <form onSubmit={add} className="flex gap-2 px-4 py-2.5">
        <input className="input h-8 flex-1" placeholder="+ Add a task for this record" value={title} onChange={(e) => setTitle(e.target.value)} />
      </form>
    </section>
  );
};

export default LinkedTasks;
