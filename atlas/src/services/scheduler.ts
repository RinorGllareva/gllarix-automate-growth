import { CATEGORY_KEY, CHUNK_HOURS, HORIZON_WEEKS, WEEKDAY_BY_INDEX, type Weekday } from "@/config/capacity";
import { PRIORITY_META } from "@/config/tasks";
import type { TaskPriority } from "@/data/taskTypes";
import { isoWeekKey, isoWeekRange, localDateKey, shiftDateKey } from "./time";

/**
 * Scheduler (CRM_BUILD_PROMPT A16), deterministic and pure.
 * 1. Order tasks topologically by dependencies, then priority and deadline.
 * 2. Place estimate × (1 + buffer) in chunks of at least 30 minutes inside the owner's windows (their own timezone) and
 *    planned category share. Tasks with a deadline fill backwards from it (as late as possible; a start date spreads them
 *    from start to due); tasks without one go forward into free hours (window × focus factor − already scheduled).
 *    Nothing starts before its start date or before its dependencies finish. Agent tasks book review hours on the reviewer.
 * 3. Output a range per task, load per person per week, and conflicts (over capacity, late, dependency, reviewer full).
 * 4. Suggest fixes: move to the next week with room → reassign to someone with the skill and free hours → split → flag.
 *    Estimates are never shrunk.
 */

export interface SchedPerson {
  id: string;
  name: string;
  timezone: string;
  windows: Partial<Record<Weekday, string>>;
  split: Record<string, number>;
  /** Split categories that count as task time; default all. */
  planned?: string[];
  skills: string[];
  focusFactor: number;
  buffer: number;
  timeOff: { from: string; to: string }[];
}

export interface SchedTask {
  id: string;
  title: string;
  /** First assignee; for agent tasks this is the reviewer. */
  ownerId: string | null;
  category: string | null;
  priority: TaskPriority;
  startAt: string | null;
  dueAt: string | null;
  remainingHours: number;
  agent: boolean;
  /** Agent tasks: review hours for this task (default: agentReviewHours). */
  reviewHours?: number;
  dependsOn: string[];
  milestone: boolean;
}

export interface ScheduleInput {
  people: SchedPerson[];
  tasks: SchedTask[];
  now: number;
  /** ISO week keys to report ("2026-W41"). */
  weeks: string[];
  agentReviewHours: number;
}

export interface Chunk {
  date: string;
  hours: number;
  personId: string;
  kind: "work" | "review";
}

export interface Placement {
  taskId: string;
  personId: string | null;
  start: string | null;
  finish: string | null;
  needHours: number;
  dated: boolean;
  chunks: Chunk[];
}

export interface CellLoad {
  personId: string;
  week: string;
  cap: number;
  used: number;
  free: number;
  tasks: { taskId: string; title: string; hours: number; kind: Chunk["kind"] }[];
}

export type Conflict =
  | { type: "over_capacity"; personId: string; week: string; used: number; cap: number }
  | { type: "late"; taskId: string; due: string; finish: string }
  | { type: "dependency"; taskId: string; dependsOnId: string; depFinish: string; due: string | null; start: string | null }
  | { type: "reviewer_full"; personId: string; week: string; reviewHours: number }
  | { type: "unschedulable"; taskId: string };

export type SuggestionApply =
  | { kind: "shift"; taskId: string; days: number }
  | { kind: "reassign"; taskId: string; from: string; to: string }
  | { kind: "dates"; taskId: string; startAt: string | null; dueAt: string }
  | { kind: "split"; taskId: string; keepHours: number; moveHours: number; days: number };

export interface Suggestion {
  /** Stable: type:task:week. */
  id: string;
  type: "move" | "reassign" | "split" | "schedule" | "flag";
  week: string;
  personId: string | null;
  text: string;
  apply: SuggestionApply | null;
}

export interface ScheduleResult {
  placements: Record<string, Placement>;
  cells: CellLoad[];
  conflicts: Conflict[];
  suggestions: Suggestion[];
  /** Agent pull requests and review hours per week. */
  agent: { week: string; prs: number; reviewHours: number }[];
}

// ---------------------------------------------------------------- capacity

const round = (h: number, step = CHUNK_HOURS) => Math.round(h / step) * step;
/** Free time rounds down to whole 30-minute chunks. */
const floorChunk = (h: number) => Math.floor(h / CHUNK_HOURS + 1e-9) * CHUNK_HOURS;
export const fmtH = (h: number) => {
  const r = Math.round(h * 2) / 2;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
};

/** Hours in "09:00-15:00" (or several, comma-separated). */
export const windowHours = (w: string | undefined) =>
  (w ?? "")
    .split(",")
    .map((x) => x.trim().match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/))
    .filter(Boolean)
    .reduce((n, m) => n + Math.max(0, (Number(m![3]) * 60 + Number(m![4]) - Number(m![1]) * 60 - Number(m![2])) / 60), 0);

export const plannedShare = (p: Pick<SchedPerson, "split" | "planned">) => (p.planned?.length ? p.planned.reduce((n, c) => n + (p.split[c] ?? 0), 0) : 1);

const weekdayKey = (date: string) => WEEKDAY_BY_INDEX[new Date(`${date}T00:00:00Z`).getUTCDay()];
const offOn = (p: SchedPerson, date: string) => p.timeOff.some((o) => date >= o.from && date <= o.to);

/** Task hours a person has on a local date (window × planned share; 0 on time off). */
export const dayCap = (p: SchedPerson, date: string) => (offOn(p, date) ? 0 : windowHours(p.windows[weekdayKey(date)]) * plannedShare(p));

export const weekDates = (week: string) => {
  const { start } = isoWeekRange(week);
  return Array.from({ length: 7 }, (_, i) => shiftDateKey(start, i));
};

/** Weekly capacity shown in the grid: window hours × planned share, minus time off. */
export const weekCap = (p: SchedPerson, week: string) => round(weekDates(week).reduce((n, d) => n + dayCap(p, d), 0));

export const nextWeeks = (fromDate: string, n: number) => {
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(isoWeekKey(shiftDateKey(fromDate, i * 7)));
  return out;
};

// ---------------------------------------------------------------- ordering

const rank = (p: TaskPriority) => PRIORITY_META[p].rank;

/** Topological order (dependencies first), ties by priority, then deadline, then id. Cycles are broken by id. */
export const topoOrder = (tasks: SchedTask[]) => {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const indeg = new Map(tasks.map((t) => [t.id, t.dependsOn.filter((d) => byId.has(d)).length]));
  const out: SchedTask[] = [];
  const cmp = (a: SchedTask, b: SchedTask) => rank(a.priority) - rank(b.priority) || (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999") || a.id.localeCompare(b.id);
  const ready = tasks.filter((t) => indeg.get(t.id) === 0).sort(cmp);
  const done = new Set<string>();
  while (out.length < tasks.length) {
    if (!ready.length) {
      const rest = tasks.filter((t) => !done.has(t.id)).sort(cmp);
      ready.push(rest[0]);
    }
    const t = ready.shift()!;
    if (done.has(t.id)) continue;
    done.add(t.id);
    out.push(t);
    for (const other of tasks) {
      if (done.has(other.id) || !other.dependsOn.includes(t.id)) continue;
      const left = (indeg.get(other.id) ?? 1) - 1;
      indeg.set(other.id, left);
      if (left <= 0) {
        ready.push(other);
        ready.sort(cmp);
      }
    }
  }
  return out;
};

// ---------------------------------------------------------------- scheduling

export const schedule = (raw: ScheduleInput): ScheduleResult => {
  const input: ScheduleInput = { ...raw, people: [...raw.people].sort((a, b) => a.id.localeCompare(b.id)), tasks: [...raw.tasks].sort((a, b) => a.id.localeCompare(b.id)) };
  const people = new Map(input.people.map((p) => [p.id, p]));
  const todayOf = (p: SchedPerson | undefined) => localDateKey(input.now, p?.timezone ?? "UTC");
  const used = new Map<string, number>(); // personId|date → hours
  const usedOn = (pid: string, d: string) => used.get(`${pid}|${d}`) ?? 0;
  const book = (chunks: Chunk[], c: Chunk) => {
    if (c.hours <= 0) return;
    chunks.push(c);
    used.set(`${c.personId}|${c.date}`, usedOn(c.personId, c.date) + c.hours);
  };
  const placements: Record<string, Placement> = {};
  const conflicts: Conflict[] = [];
  const horizonEnd = (from: string) => shiftDateKey(from, HORIZON_WEEKS * 7);
  const maxDate = (...ds: (string | null | undefined)[]) => ds.filter(Boolean).sort().pop() as string;

  const earliestFor = (t: SchedTask, p: SchedPerson | undefined) => {
    const depFinish = t.dependsOn.map((d) => placements[d]?.finish).filter(Boolean) as string[];
    // Work can start the day a dependency finishes (weekend work often chains within a day).
    const afterDeps = depFinish.length ? depFinish.sort().pop()! : null;
    return maxDate(todayOf(p), t.startAt, afterDeps);
  };

  /** Working days of p from `from` to `to` inclusive. */
  const workDays = (p: SchedPerson, from: string, to: string) => {
    const out: string[] = [];
    for (let d = from; d <= to; d = shiftDateKey(d, 1)) if (dayCap(p, d) > 0) out.push(d);
    return out;
  };
  const firstWorkDay = (p: SchedPerson, from: string) => {
    const end = horizonEnd(from);
    for (let d = from; d <= end; d = shiftDateKey(d, 1)) if (dayCap(p, d) > 0) return d;
    return null;
  };

  /** Deadline tasks: as late as possible from the due date backwards at focus × day cap; a start date spreads them evenly. */
  const placeDated = (t: SchedTask, p: SchedPerson, need: number, earliest: string, kind: Chunk["kind"], chunks: Chunk[]) => {
    const due = t.dueAt!;
    const days = earliest <= due ? workDays(p, earliest, due) : [];
    if (!days.length) {
      const d = firstWorkDay(p, earliest);
      if (d) book(chunks, { date: d, hours: round(need), personId: p.id, kind });
      return;
    }
    let left = round(need);
    if (t.startAt && kind === "work") {
      // Spread across the planned window, weighted by each day's hours.
      const total = days.reduce((n, d) => n + dayCap(p, d), 0);
      days.forEach((d, i) => {
        const h = i === days.length - 1 ? left : Math.min(left, round((need * dayCap(p, d)) / total));
        if (h >= CHUNK_HOURS || i === days.length - 1) {
          book(chunks, { date: d, hours: h, personId: p.id, kind });
          left -= h;
        }
      });
      return;
    }
    for (let i = days.length - 1; i >= 0 && left > 0; i--) {
      const h = Math.min(left, Math.max(CHUNK_HOURS, floorChunk(dayCap(p, days[i]) * p.focusFactor)));
      book(chunks, { date: days[i], hours: h, personId: p.id, kind });
      left -= h;
    }
    // Not enough days before the deadline: the rest piles on the first day (the over-capacity conflict shows it).
    if (left > 0) book(chunks, { date: days[0], hours: left, personId: p.id, kind });
  };

  /** No deadline: forward into free hours. */
  const placeGreedy = (p: SchedPerson, need: number, earliest: string, kind: Chunk["kind"], chunks: Chunk[]) => {
    let left = round(need);
    const end = horizonEnd(earliest);
    for (let d = earliest; d <= end && left > 0; d = shiftDateKey(d, 1)) {
      const free = floorChunk(dayCap(p, d) * p.focusFactor - usedOn(p.id, d));
      if (free < CHUNK_HOURS) continue;
      const h = Math.min(left, free);
      book(chunks, { date: d, hours: h, personId: p.id, kind });
      left -= h;
    }
    return left <= 0;
  };

  const ordered = topoOrder(input.tasks);
  // Deadline tasks first (their placement doesn't depend on others' load), then the rest into what's free.
  for (const pass of ["dated", "undated"] as const) {
    for (const t of ordered) {
      if ((pass === "dated") !== !!t.dueAt) continue;
      const owner = t.ownerId ? people.get(t.ownerId) : undefined;
      const chunks: Chunk[] = [];
      const earliest = earliestFor(t, owner);
      if (t.milestone) {
        placements[t.id] = { taskId: t.id, personId: t.ownerId, start: t.dueAt, finish: t.dueAt, needHours: 0, dated: !!t.dueAt, chunks };
        continue;
      }
      let need = 0;
      if (t.agent) {
        // The agent has no hour limit; its reviewer books review hours before the deadline.
        need = t.reviewHours ?? input.agentReviewHours;
        if (owner) {
          if (t.dueAt) placeDated({ ...t, startAt: null }, owner, need, earliest, "review", chunks);
          else placeGreedy(owner, need, earliest, "review", chunks);
        }
      } else if (owner && t.remainingHours > 0) {
        need = t.remainingHours * (1 + owner.buffer);
        if (t.dueAt) placeDated(t, owner, need, earliest, "work", chunks);
        else if (!placeGreedy(owner, need, earliest, "work", chunks)) conflicts.push({ type: "unschedulable", taskId: t.id });
      }
      const dates = chunks.map((c) => c.date).sort();
      placements[t.id] = {
        taskId: t.id,
        personId: owner?.id ?? null,
        start: t.agent ? (t.startAt ?? earliest) : (dates[0] ?? t.startAt ?? t.dueAt),
        finish: t.agent ? (t.dueAt ?? dates[dates.length - 1] ?? null) : (dates[dates.length - 1] ?? t.dueAt),
        needHours: round(need),
        dated: !!t.dueAt,
        chunks,
      };
      const finish = placements[t.id].finish;
      if (t.dueAt && finish && finish > t.dueAt) conflicts.push({ type: "late", taskId: t.id, due: t.dueAt, finish });
    }
  }

  // Dependencies: a dependency finishing after the task's deadline, or the task starting before it finishes.
  for (const t of input.tasks) {
    for (const d of t.dependsOn) {
      const depFinish = placements[d]?.finish;
      const own = placements[t.id];
      if (!depFinish || !own) continue;
      if ((t.dueAt && depFinish > t.dueAt) || (own.start && own.start < depFinish && !t.milestone)) {
        conflicts.push({ type: "dependency", taskId: t.id, dependsOnId: d, depFinish, due: t.dueAt, start: own.start });
      }
    }
  }

  // Load per person per reported week.
  const titles = new Map(input.tasks.map((t) => [t.id, t.title]));
  const cells: CellLoad[] = [];
  for (const p of input.people) {
    for (const week of input.weeks) {
      const dates = new Set(weekDates(week));
      const byTask = new Map<string, { hours: number; kind: Chunk["kind"] }>();
      for (const pl of Object.values(placements)) {
        for (const c of pl.chunks) {
          if (c.personId !== p.id || !dates.has(c.date)) continue;
          const cur = byTask.get(pl.taskId);
          byTask.set(pl.taskId, { hours: (cur?.hours ?? 0) + c.hours, kind: c.kind });
        }
      }
      const cap = weekCap(p, week);
      const usedH = round([...byTask.values()].reduce((n, x) => n + x.hours, 0), 0.1);
      cells.push({
        personId: p.id, week, cap, used: usedH, free: round(Math.max(0, cap - usedH), 0.1),
        tasks: [...byTask.entries()].map(([taskId, x]) => ({ taskId, title: titles.get(taskId) ?? "", hours: round(x.hours, 0.1), kind: x.kind })).sort((a, b) => b.hours - a.hours),
      });
      if (usedH > cap + 0.05) {
        conflicts.push({ type: "over_capacity", personId: p.id, week, used: usedH, cap });
        const review = [...byTask.values()].filter((x) => x.kind === "review").reduce((n, x) => n + x.hours, 0);
        if (review > 0) conflicts.push({ type: "reviewer_full", personId: p.id, week, reviewHours: round(review, 0.1) });
      }
    }
  }

  const agent = input.weeks.map((week) => {
    const dates = new Set(weekDates(week));
    const agentTasks = input.tasks.filter((t) => t.agent && placements[t.id]?.finish && dates.has(placements[t.id].finish!));
    const reviewHours = Object.values(placements).flatMap((pl) => pl.chunks).filter((c) => c.kind === "review" && dates.has(c.date)).reduce((n, c) => n + c.hours, 0);
    return { week, prs: agentTasks.length, reviewHours: round(reviewHours, 0.1) };
  });

  const sortedPlacements = Object.fromEntries(Object.keys(placements).sort().map((k) => [k, placements[k]]));
  return { placements: sortedPlacements, cells, conflicts, suggestions: suggest(input, placements, cells, conflicts), agent };
};

// ---------------------------------------------------------------- suggestions

const weekNo = (week: string) => `W${Number(week.slice(6))}`;
const dayLabel = (d: string) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

const suggest = (input: ScheduleInput, placements: Record<string, Placement>, cells: CellLoad[], conflicts: Conflict[]): Suggestion[] => {
  const out: Suggestion[] = [];
  const tasks = new Map(input.tasks.map((t) => [t.id, t]));
  const people = new Map(input.people.map((p) => [p.id, p]));
  const cell = (pid: string, week: string) => cells.find((c) => c.personId === pid && c.week === week);
  const first = (pid: string) => people.get(pid)?.name.split(" ")[0] ?? "—";
  const dependentsOf = (id: string) => input.tasks.filter((t) => t.dependsOn.includes(id));

  for (const c of conflicts) {
    if (c.type !== "over_capacity") continue;
    const p = people.get(c.personId)!;
    const over = c.used - c.cap;
    const here = cell(p.id, c.week)!;
    // Movable work in this week: dated, not urgent, not agent review; low priority and later deadlines first.
    const candidates = here.tasks
      .filter((x) => x.kind === "work")
      .map((x) => ({ ...x, t: tasks.get(x.taskId)! }))
      .filter((x) => x.t && x.t.dueAt && x.t.priority !== "urgent" && !x.t.milestone)
      .sort((a, b) => rank(b.t.priority) - rank(a.t.priority) || b.t.dueAt!.localeCompare(a.t.dueAt!) || Number(b.hours >= over) - Number(a.hours >= over));

    let moved: string | null = null;
    for (const x of candidates) {
      for (let k = 1; k <= 4 && !moved; k++) {
        const target = isoWeekKey(shiftDateKey(isoWeekRange(c.week).start, k * 7));
        const tc = cell(p.id, target) ?? { free: weekCap(p, target), cap: weekCap(p, target), used: 0 };
        const newDue = shiftDateKey(x.t.dueAt!, k * 7);
        const blocks = dependentsOf(x.t.id).some((d) => (d.dueAt && d.dueAt < newDue) || (d.startAt && d.startAt <= newDue));
        if (tc.free >= x.hours && !blocks) {
          moved = x.t.id;
          out.push({
            id: `move:${x.t.id}:${c.week}`, type: "move", week: c.week, personId: p.id,
            text: `${first(p.id)} is ${fmtH(over)} h over in ${weekNo(c.week)}. Move "${x.t.title}" to ${weekNo(target)}, where ${first(p.id)} has ${fmtH(tc.free)} h free.`,
            apply: { kind: "shift", taskId: x.t.id, days: k * 7 },
          });
        }
      }
      if (moved) break;
    }

    let reassigned = false;
    for (const x of candidates) {
      if (x.t.id === moved && candidates.length > 1) continue;
      const skill = CATEGORY_KEY[x.t.category ?? ""] ?? null;
      const to = input.people.find((q) => q.id !== p.id && (!skill || q.skills.includes(skill)) && (cell(q.id, c.week)?.free ?? 0) >= x.hours);
      if (to) {
        reassigned = true;
        out.push({
          id: `reassign:${x.t.id}:${c.week}`, type: "reassign", week: c.week, personId: p.id,
          text: `"${x.t.title}" can go to ${first(to.id)}, who has ${fmtH(cell(to.id, c.week)!.free)} h free in ${weekNo(c.week)}.`,
          apply: { kind: "reassign", taskId: x.t.id, from: p.id, to: to.id },
        });
        break;
      }
    }

    if (!moved && !reassigned) {
      const big = candidates[0];
      const next = big ? cell(p.id, isoWeekKey(shiftDateKey(isoWeekRange(c.week).start, 7))) : undefined;
      if (big && next && next.free >= CHUNK_HOURS && here.cap > here.used - big.hours) {
        const keep = Math.max(CHUNK_HOURS, round(big.hours - over));
        out.push({
          id: `split:${big.t.id}:${c.week}`, type: "split", week: c.week, personId: p.id,
          text: `Split "${big.t.title}": keep ${fmtH(keep)} h in ${weekNo(c.week)} and move ${fmtH(big.hours - keep)} h to ${weekNo(next.week)}.`,
          apply: { kind: "split", taskId: big.t.id, keepHours: keep, moveHours: round(big.hours - keep), days: 7 },
        });
      } else {
        out.push({ id: `flag:${p.id}:${c.week}`, type: "flag", week: c.week, personId: p.id, text: `${first(p.id)} is ${fmtH(over)} h over in ${weekNo(c.week)} and nothing can move without missing a deadline. Agree new dates or less scope.`, apply: null });
      }
    }
  }

  // Undated work: propose the dates the scheduler found.
  for (const t of input.tasks) {
    const pl = placements[t.id];
    if (t.dueAt || t.milestone || t.agent || !pl?.chunks.length || !t.ownerId) continue;
    const firstChunk = [...pl.chunks].sort((a, b) => a.date.localeCompare(b.date))[0];
    out.push({
      id: `schedule:${t.id}:${isoWeekKey(firstChunk.date)}`, type: "schedule", week: isoWeekKey(firstChunk.date), personId: t.ownerId,
      text: `"${t.title}" has no dates yet; block ${fmtH(firstChunk.hours)} h on ${dayLabel(firstChunk.date)}${pl.finish !== firstChunk.date ? `, done by ${dayLabel(pl.finish!)}` : ""}.`,
      apply: { kind: "dates", taskId: t.id, startAt: firstChunk.date, dueAt: pl.finish! },
    });
  }

  // Deadlines that can't be met.
  for (const c of conflicts) {
    if (c.type !== "late") continue;
    const t = tasks.get(c.taskId)!;
    out.push({
      id: `flag:${t.id}:${isoWeekKey(c.due)}`, type: "flag", week: isoWeekKey(c.due), personId: t.ownerId,
      text: `"${t.title}" can't be done by ${dayLabel(c.due)}; the earliest finish is ${dayLabel(c.finish)}.`,
      apply: { kind: "dates", taskId: t.id, startAt: t.startAt, dueAt: c.finish },
    });
  }
  return out;
};
