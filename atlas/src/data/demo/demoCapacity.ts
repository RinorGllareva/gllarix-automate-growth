import { AGENT, CAPACITY_SEED, DEFAULT_BUFFER, FOCUS_FACTOR, WEEKDAYS, type Weekday } from "@/config/capacity";
import { isOpen } from "@/services/tasks";
import { fmtH, nextWeeks, plannedShare, schedule, weekCap, windowHours, type SchedPerson, type SchedTask } from "@/services/scheduler";
import { isoWeekKey, isoWeekRange, localDateKey, shiftDateKey } from "@/services/time";
import type { Availability, CapacityApi, CapacityPlan, CapacitySettings, PlanPerson, TimeOff } from "../capacityTypes";
import type { Task, TaskDependency, TaskList, TimeEntry } from "../taskTypes";
import { AccessError, type User } from "../types";

const DAY = 86_400_000;

export interface CapacityStore {
  tasks: Task[];
  taskLists: TaskList[];
  taskDeps: TaskDependency[];
  timeEntries: TimeEntry[];
  availability: Availability[];
  timeOff: TimeOff[];
  capacitySettings: CapacitySettings;
  dismissedSuggestions: string[];
}

export const emptyCapacityState = () => ({
  availability: [] as Availability[],
  timeOff: [] as TimeOff[],
  capacitySettings: { focusFactor: FOCUS_FACTOR, buffer: DEFAULT_BUFFER } as CapacitySettings,
  dismissedSuggestions: [] as string[],
});

interface Ctx<S extends CapacityStore> {
  load: () => Promise<S>;
  save: () => Promise<void>;
  viewer: () => Promise<User>;
  now: () => number;
  users: User[];
  uid: (p: string) => string;
  audit: (userId: string | null, action: string, entity: string, entityId: string | null, before?: unknown, after?: unknown) => void;
  canSeeTask: (s: S, user: User, t: Task) => boolean;
  updateTask: (s: S, user: User, id: string, patch: Partial<Task>) => void;
  createTask: (s: S, user: User, input: { listId: string; title: string; assigneeIds: string[]; dueAt: string; estimateMinutes: number; category: string | null; priority: Task["priority"] }) => void;
}

const COLORS: Record<string, PlanPerson["color"]> = { "u-rinor": "lavender", "u-cofounder": "cyan", "u-bdr": "amber", "u-implementer": "text-3", [AGENT.id]: "mint" };
const DAY_LABEL: Record<Weekday, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };

export const windowsText = (w: Availability["windows"], tz: string) => {
  const days = WEEKDAYS.filter((d) => w[d]);
  if (!days.length) return "No working hours set";
  const same = days.every((d) => w[d] === w[days[0]]);
  const zone = new Intl.DateTimeFormat("en-GB", { timeZone: tz, timeZoneName: "short" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value ?? tz;
  const range = (ds: Weekday[]) => (ds.length > 2 && WEEKDAYS.indexOf(ds[ds.length - 1]) - WEEKDAYS.indexOf(ds[0]) === ds.length - 1 ? `${DAY_LABEL[ds[0]]}–${DAY_LABEL[ds[ds.length - 1]]}` : ds.map((d) => DAY_LABEL[d]).join(" and "));
  return same ? `${range(days)} · ${w[days[0]]!.replace("-", "–")} ${zone}` : days.map((d) => `${DAY_LABEL[d]} ${w[d]}`).join(" · ");
};

const capLabel = (a: Availability, hours: number) => {
  const d = WEEKDAYS.filter((x) => a.windows[x]);
  const when = d.length && d.every((x) => x === "sat" || x === "sun") ? "Weekends" : null;
  const what = a.planned.length && a.planned.length < Object.keys(a.split).length ? a.planned.map((c) => c.replace("_", " ")).join(" + ") : Object.keys(a.split).length === 1 ? Object.keys(a.split)[0].replace("_", " ") : null;
  const label = when ?? (what ? (what[0].toUpperCase() + what.slice(1)).replace("Operations + development", "Ops + dev") : "Hours");
  return `${label} · ${fmtH(hours)} h`;
};

export const createDemoCapacity = <S extends CapacityStore>(ctx: Ctx<S>) => {
  const { load, save, viewer, now, users, uid, audit } = ctx;
  const iso = (t = now()) => new Date(t).toISOString();

  const seedCapacity = (s: S) => {
    if (s.availability.length) return;
    for (const [userId, c] of Object.entries(CAPACITY_SEED)) {
      if (!users.some((u) => u.id === userId)) continue;
      s.availability.push({ userId, timezone: c.timezone, windows: { ...c.windows }, split: { ...c.split }, planned: c.planned ?? [], skills: [...c.skills], updatedAt: iso(), updatedBy: null });
    }
  };

  /** Actual ÷ estimate per person once there are 4+ weeks of time entries on finished, estimated tasks. */
  const accuracyOf = (s: S, userId: string) => {
    const entries = s.timeEntries.filter((e) => e.userId === userId);
    if (!entries.length) return null;
    const firstAt = Math.min(...entries.map((e) => new Date(e.startedAt).getTime()));
    if (now() - firstAt < 28 * DAY) return null;
    // Only finished tasks that have time logged on them (same basis as the time reports' estimate accuracy).
    const spent = (t: { id: string }) => entries.filter((e) => e.taskId === t.id).reduce((m, e) => m + e.minutes, 0);
    const done = s.tasks.filter((t) => t.status === "done" && t.estimateMinutes && t.assigneeIds.includes(userId) && spent(t) > 0);
    const est = done.reduce((n, t) => n + t.estimateMinutes!, 0);
    const actual = done.reduce((n, t) => n + spent(t), 0);
    return est > 0 && actual > 0 ? Math.round((actual / est) * 100) / 100 : null;
  };

  const schedPeople = (s: S): SchedPerson[] =>
    s.availability.map((a) => {
      const acc = accuracyOf(s, a.userId);
      return {
        id: a.userId, name: users.find((u) => u.id === a.userId)?.name ?? a.userId, timezone: a.timezone, windows: a.windows, split: a.split, planned: a.planned, skills: a.skills,
        focusFactor: s.capacitySettings.focusFactor, buffer: acc !== null ? Math.min(1, Math.max(0, acc - 1)) : s.capacitySettings.buffer,
        timeOff: s.timeOff.filter((o) => o.userId === a.userId),
      };
    });

  const schedTasks = (s: S): SchedTask[] =>
    s.tasks
      .filter((t) => !t.deletedAt && !t.parentId && isOpen(t.status))
      .map((t) => {
        const spent = s.timeEntries.filter((e) => e.taskId === t.id).reduce((n, e) => n + e.minutes, 0);
        return {
          id: t.id, title: t.title, ownerId: t.assigneeIds[0] ?? null, category: t.category, priority: t.priority, startAt: t.startAt, dueAt: t.dueAt,
          remainingHours: Math.max(0, (t.estimateMinutes ?? 0) - spent) / 60, agent: t.tags.includes("agent"), milestone: t.tags.includes("milestone"),
          dependsOn: s.taskDeps.filter((d) => d.taskId === t.id).map((d) => d.dependsOnId),
        };
      });

  const run = (s: S, weeks: string[]) => schedule({ people: schedPeople(s), tasks: schedTasks(s), now: now(), weeks, agentReviewHours: AGENT.reviewHoursPerTask });

  const api: CapacityApi = {
    async capacityPlan(q = {}) {
      const user = await viewer();
      if (user.role === "viewer") throw new AccessError(403);
      const s = await load();
      const today = localDateKey(now(), user.timezone);
      const from = isoWeekRange(isoWeekKey(q.from ?? today)).start;
      const weeks = nextWeeks(from, Math.min(12, Math.max(1, q.weeks ?? 5)));
      const result = run(s, weeks);
      const admin = user.role === "admin";
      const seesPerson = (id: string) => admin || id === user.id;
      const people: PlanPerson[] = s.availability
        .filter((a) => seesPerson(a.userId))
        .map((a) => {
          const sp = schedPeople(s).find((p) => p.id === a.userId)!;
          const hours = weekCap(sp, weeks[0]);
          const raw = WEEKDAYS.reduce((n, d) => n + windowHours(a.windows[d]), 0);
          return {
            id: a.userId, name: users.find((u) => u.id === a.userId)?.name ?? a.userId, kind: "person", color: COLORS[a.userId] ?? "text-3",
            capLine: capLabel(a, raw * plannedShare(a)), hoursPerWeek: hours, windowsText: windowsText(a.windows, a.timezone),
            splitText: Object.entries(a.split).map(([k, v]) => `${k[0].toUpperCase()}${k.slice(1).replace("_", " ")} ${Math.round(v * 100)}%`).join(" · "),
            timezone: a.timezone, accuracy: accuracyOf(s, a.userId), editable: admin || a.userId === user.id,
          };
        });
      if (admin) people.push({ id: AGENT.id, name: AGENT.name, kind: "agent", color: "mint", capLine: "Needs founder review", hoursPerWeek: null, windowsText: "Any time", splitText: `Each PR books ${AGENT.reviewHoursPerTask} h of founder review`, timezone: null, accuracy: null, editable: false });

      const listIds = q.spaceId ? new Set(s.taskLists.filter((l) => l.spaceId === q.spaceId).map((l) => l.id)) : null;
      const inScope = (t: Task) => !t.deletedAt && !t.parentId && t.status !== "cancelled" && ctx.canSeeTask(s, user, t) && (!q.listId || t.listId === q.listId) && (!listIds || listIds.has(t.listId));
      const lastDay = shiftDateKey(from, weeks.length * 7 - 1);
      const bars = s.tasks
        .filter(inScope)
        .filter((t) => t.dueAt || t.startAt)
        .map((t) => {
          const pl = result.placements[t.id];
          const agent = t.tags.includes("agent");
          const start = t.startAt ?? pl?.start ?? t.dueAt!;
          const end = t.dueAt ?? pl?.finish ?? start;
          return {
            taskId: t.id, title: t.title, ownerId: t.assigneeIds[0] ?? null, color: agent ? ("mint" as const) : (COLORS[t.assigneeIds[0] ?? ""] ?? ("text-3" as const)),
            start: start <= end ? start : end, end, milestone: t.tags.includes("milestone"), agent, status: t.status,
            waitingOn: s.taskDeps.filter((d) => d.taskId === t.id).map((d) => d.dependsOnId), finish: pl?.finish ?? null,
          };
        })
        .filter((b) => b.end >= from && b.start <= lastDay && (isOpen(b.status) || b.end >= today))
        .sort((a, b) => Number(a.milestone) - Number(b.milestone) || a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
      const unscheduled = s.tasks
        .filter((t) => inScope(t) && isOpen(t.status) && !t.dueAt && !t.startAt)
        .map((t) => ({ taskId: t.id, title: t.title, ownerName: users.find((u) => u.id === t.assigneeIds[0])?.name ?? null, estimateHours: t.estimateMinutes ? t.estimateMinutes / 60 : null }));
      const visibleTask = (id: string | undefined) => {
        const t = id ? s.tasks.find((x) => x.id === id) : undefined;
        return !t || ctx.canSeeTask(s, user, t);
      };

      return {
        today,
        weeks: weeks.map((k) => ({ key: k, start: isoWeekRange(k).start, label: `W${Number(k.slice(6))} · ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${isoWeekRange(k).start}T00:00:00Z`)).toUpperCase()}` })),
        people,
        cells: result.cells.filter((c) => seesPerson(c.personId)).map((c) => ({ ...c, tasks: c.tasks.filter((x) => visibleTask(x.taskId)) })),
        agent: admin ? result.agent : [],
        bars,
        unscheduled,
        conflicts: result.conflicts.filter((c) => ("personId" in c ? seesPerson(c.personId) : visibleTask(c.taskId))),
        suggestions: result.suggestions.filter((x) => !s.dismissedSuggestions.includes(x.id) && (admin || x.personId === user.id) && weeks.includes(x.week)),
        availability: s.availability.filter((a) => seesPerson(a.userId)),
        timeOff: s.timeOff.filter((o) => seesPerson(o.userId)),
        settings: s.capacitySettings,
      } satisfies CapacityPlan;
    },

    async applySuggestion(id) {
      const user = await viewer();
      const s = await load();
      const weeks = nextWeeks(isoWeekRange(isoWeekKey(localDateKey(now(), user.timezone))).start, 12);
      const sug = run(s, weeks).suggestions.find((x) => x.id === id);
      if (!sug) throw new Error("That suggestion no longer applies. The plan has changed.");
      if (user.role !== "admin" && sug.personId !== user.id) throw new AccessError(403);
      if (!sug.apply) throw new Error("This one needs a decision, not a click.");
      const a = sug.apply;
      const t = s.tasks.find((x) => x.id === a.taskId);
      if (!t) throw new AccessError(404);
      if (a.kind === "shift") ctx.updateTask(s, user, t.id, { dueAt: t.dueAt ? shiftDateKey(t.dueAt, a.days) : null, startAt: t.startAt ? shiftDateKey(t.startAt, a.days) : null });
      else if (a.kind === "reassign") ctx.updateTask(s, user, t.id, { assigneeIds: [a.to, ...t.assigneeIds.filter((x) => x !== a.from && x !== a.to)] });
      else if (a.kind === "dates") ctx.updateTask(s, user, t.id, { startAt: a.startAt, dueAt: a.dueAt });
      else {
        // Split keeps the total: this task keeps part of the remaining estimate; a "(part 2)" task takes the rest next week.
        const spent = s.timeEntries.filter((e) => e.taskId === t.id).reduce((n, e) => n + e.minutes, 0);
        const total = t.estimateMinutes ?? 0;
        const ratio = a.keepHours / (a.keepHours + a.moveHours);
        const remaining = Math.max(0, total - spent);
        const keep = Math.round(remaining * ratio);
        ctx.updateTask(s, user, t.id, { estimateMinutes: spent + keep });
        ctx.createTask(s, user, { listId: t.listId, title: `${t.title} (part 2)`, assigneeIds: t.assigneeIds, dueAt: shiftDateKey(t.dueAt!, a.days), estimateMinutes: remaining - keep, category: t.category, priority: t.priority });
      }
      audit(user.id, "capacity.apply_suggestion", "task", t.id, null, { suggestion: id });
      await save();
    },

    async dismissSuggestion(id) {
      await viewer();
      const s = await load();
      if (!s.dismissedSuggestions.includes(id)) s.dismissedSuggestions.push(id);
      await save();
    },

    async updateAvailability(userId, patch) {
      const user = await viewer();
      if (user.role !== "admin" && user.id !== userId) throw new AccessError(403, "You can edit only your own hours.");
      const s = await load();
      const a = s.availability.find((x) => x.userId === userId);
      if (!a) throw new AccessError(404);
      if (patch.split) {
        const sum = Object.values(patch.split).reduce((n, v) => n + v, 0);
        if (Math.abs(sum - 1) > 0.005) throw new Error(`The category split must add up to 100% (now ${Math.round(sum * 100)}%).`);
        if (Object.values(patch.split).some((v) => v < 0)) throw new Error("Shares can't be negative.");
      }
      if (patch.windows) {
        for (const [d, w] of Object.entries(patch.windows)) {
          if (!w) continue;
          if (!/^\d{2}:\d{2}-\d{2}:\d{2}(,\s*\d{2}:\d{2}-\d{2}:\d{2})*$/.test(w) || windowHours(w) <= 0) throw new Error(`${d}: use HH:MM-HH:MM (end after start).`);
        }
      }
      if (patch.timezone) {
        try {
          new Intl.DateTimeFormat("en-GB", { timeZone: patch.timezone });
        } catch {
          throw new Error(`Unknown timezone "${patch.timezone}".`);
        }
      }
      const before = { ...a };
      Object.assign(a, patch.windows ? { windows: Object.fromEntries(Object.entries(patch.windows).filter(([, v]) => v)) } : {}, patch.split ? { split: patch.split } : {}, patch.timezone ? { timezone: patch.timezone } : {}, patch.planned ? { planned: patch.planned.filter((c) => c in a.split) } : {}, { updatedAt: iso(), updatedBy: user.id });
      if (a.planned.some((c) => !(c in a.split))) a.planned = a.planned.filter((c) => c in a.split);
      audit(user.id, "availability.update", "user", userId, before, a);
      await save();
    },

    async addTimeOff(userId, entry) {
      const user = await viewer();
      if (user.role !== "admin" && user.id !== userId) throw new AccessError(403);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.from) || !/^\d{4}-\d{2}-\d{2}$/.test(entry.to) || entry.to < entry.from) throw new Error("Pick a start date and an end date on or after it.");
      const s = await load();
      s.timeOff.push({ id: uid("off"), userId, from: entry.from, to: entry.to, reason: entry.reason.trim() || "Time off" });
      audit(user.id, "time_off.add", "user", userId, null, entry);
      await save();
    },

    async removeTimeOff(id) {
      const user = await viewer();
      const s = await load();
      const o = s.timeOff.find((x) => x.id === id);
      if (!o) return;
      if (user.role !== "admin" && user.id !== o.userId) throw new AccessError(403);
      s.timeOff = s.timeOff.filter((x) => x.id !== id);
      await save();
    },

    async setCapacitySettings(patch) {
      const user = await viewer();
      if (user.role !== "admin") throw new AccessError(403);
      const s = await load();
      if (patch.focusFactor !== undefined && (patch.focusFactor <= 0 || patch.focusFactor > 1)) throw new Error("The focus factor is between 0.1 and 1.");
      if (patch.buffer !== undefined && (patch.buffer < 0 || patch.buffer > 1)) throw new Error("The buffer is between 0% and 100%.");
      Object.assign(s.capacitySettings, patch);
      audit(user.id, "capacity.settings", "settings", null, null, patch);
      await save();
    },
  };

  return { api, seedCapacity, run, schedPeople, schedTasks };
};
