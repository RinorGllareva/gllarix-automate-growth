import { createContext, useContext, type ReactNode } from "react";
import { PRIORITY_META, STATUS_META } from "@/config/tasks";
import { CATEGORY_HUE, hueTint, hueVar, PRIORITY_HUE, TASK_STATUS_HUE } from "@/config/colors";
import { Pill } from "@/components/ui/primitives";
import type { TaskPriority, TaskRow, TaskStatus, TasksHome } from "@/data";
import { isOpen } from "@/services/tasks";

export interface TasksCtx {
  home: TasksHome;
  refresh: () => void;
  /** Open a task in the side panel (wide screens) or its page. */
  openTask: (id: string) => void;
}

export const TasksContext = createContext<TasksCtx | null>(null);
/** The header element a view renders its filters into (same row as the view tabs). */
export const ToolbarSlot = createContext<HTMLElement | null>(null);
export const useTasks = () => {
  const c = useContext(TasksContext);
  if (!c) throw new Error("useTasks outside the Tasks module");
  return c;
};

export const todayKey = () => new Date().toISOString().slice(0, 10);

export const dueLabel = (d: string | null) =>
  d ? new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`)) : "—";
export const shortDue = (d: string | null) => (d ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`)) : "—");
export const isOverdue = (row: TaskRow) => !!row.task.dueAt && row.task.dueAt < todayKey() && isOpen(row.task.status);

export const ownersText = (row: TaskRow) => (row.assignees.length > 2 ? `${row.assignees.length} people` : row.assignees.map((a) => a.name.split(" ")[0]).join(", ") || "—");

/** The status square: click cycles the status. */
export const StatusBox = ({ status, onClick, label }: { status: TaskStatus; onClick?: () => void; label: string }) => {
  const m = STATUS_META[status];
  const hue = TASK_STATUS_HUE[status];
  const box = (
    <span
      className="flex h-3.5 w-3.5 items-center justify-center border-2 text-[8px] leading-none"
      style={{ borderColor: hueVar(hue), background: status === "done" ? hueVar(hue) : status === "todo" ? "transparent" : hueTint(hue, 35), color: "var(--ice-ink)" }}
    >
      {status === "done" ? "✓" : ""}
    </span>
  );
  return onClick ? (
    <button type="button" onClick={onClick} aria-label={`${label}: ${m.label}. Change status`} title={`${m.label} · click for next`} className="flex h-5 w-5 items-center justify-center">
      {box}
    </button>
  ) : (
    <span className="flex h-5 w-5 items-center justify-center" aria-label={m.label}>
      {box}
    </span>
  );
};

/** ClickUp-style priority flag. */
export const Flag = ({ p, size = 12 }: { p: TaskPriority; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ color: hueVar(PRIORITY_HUE[p]) }}>
    <path d="M5 21V4M5 4h11l-2 4 2 4H5" fill={p === "low" ? "none" : "currentColor"} stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
  </svg>
);

export const PriorityText = ({ p }: { p: TaskPriority }) => (
  <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: hueVar(PRIORITY_HUE[p]) }}>
    <Flag p={p} size={11} />
    {PRIORITY_META[p].label}
  </span>
);

export const CategoryChip = ({ c }: { c: string | null }) =>
  c ? (
    <Pill hue={CATEGORY_HUE[c] ?? "text-3"} className="h-5 self-start justify-self-start px-1.5 text-[10px]">
      {c}
    </Pill>
  ) : (
    <span className="text-text-3">—</span>
  );

export const AiTag = () => <span className="text-[9px] tracking-[0.18em] text-cyan">AI</span>;

export const StatusChip = ({ s }: { s: TaskStatus }) => (
  <Pill hue={TASK_STATUS_HUE[s]} dot className="uppercase tracking-[0.12em]">
    {STATUS_META[s].label}
  </Pill>
);

/** Status group header pill, filled like ClickUp. */
export const GroupPill = ({ tone, children }: { tone: string; children: ReactNode }) => {
  const hue = tone.replace("text-", "");
  const v = hue === "text" || hue === "text-2" ? "var(--text-3)" : `var(--${hue})`;
  return (
    <span className="inline-flex h-[22px] items-center px-2 text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ background: v, color: "var(--ice-ink)" }}>
      {children}
    </span>
  );
};

/** Page icon for a task (Notion style): one emoji per category. */
const CATEGORY_EMOJI: Record<string, string> = {
  Development: "💻", Sales: "💼", "Lead gen": "🎯", Management: "🧭", Finance: "💶", Operations: "⚙️", Research: "🔬", Delivery: "🚚", Marketing: "📣",
};
export const taskEmoji = (t: { category: string | null; createdByAi?: boolean }) => (t.category && CATEGORY_EMOJI[t.category]) || (t.createdByAi ? "✨" : "📄");

/** Rounded status pill with a dot (Notion board header, task page property). */
export const StatusPill = ({ s, label, className = "" }: { s: TaskStatus; label?: string; className?: string }) => {
  const hue = TASK_STATUS_HUE[s];
  const v = hue === "text-3" ? "var(--text-2)" : hueVar(hue);
  return (
    <span className={`inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[12px] font-medium ${className}`} style={{ background: hueTint(hue, 20), color: v }}>
      <span className="h-2 w-2 rounded-full" style={{ background: v }} aria-hidden="true" />
      {label ?? STATUS_META[s].label}
    </span>
  );
};

export const SectionLabel =({ children }: { children: ReactNode }) => <span className="label-caps">{children}</span>;
