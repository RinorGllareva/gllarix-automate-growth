import { TICKET_CATEGORIES } from "@/config/support";
import type { Ticket, TicketRow } from "@/data/supportTypes";

const HOUR = 3_600_000;

const span = (ms: number) => {
  const m = Math.round(Math.abs(ms) / 60_000);
  return m < 60 ? `${m} min` : m < 48 * 60 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`;
};

/**
 * Where a ticket stands against its service level: first reply due, fix due, or done. Urgent tickets get half the
 * time; a ticket waiting on the client doesn't count against the fix target.
 */
export const slaState = (t: Pick<Ticket, "category" | "priority" | "status" | "createdAt" | "firstResponseAt" | "resolvedAt">, now: number): TicketRow["sla"] => {
  if (t.status === "resolved") return { due: null, overdue: false, label: t.resolvedAt ? `Resolved in ${span(new Date(t.resolvedAt).getTime() - new Date(t.createdAt).getTime())}` : "Resolved", stage: "done" };
  const target = TICKET_CATEGORIES[t.category];
  const factor = t.priority === "urgent" ? 0.5 : 1;
  const created = new Date(t.createdAt).getTime();
  if (!t.firstResponseAt) {
    const due = created + target.firstHours * factor * HOUR;
    const left = due - now;
    return { due: new Date(due).toISOString(), overdue: left < 0, label: left < 0 ? `Reply overdue by ${span(left)}` : `Reply within ${span(left)}`, stage: "first" };
  }
  if (t.status === "waiting") return { due: null, overdue: false, label: "Waiting on the client", stage: "fix" };
  const due = created + target.fixHours * factor * HOUR;
  const left = due - now;
  return { due: new Date(due).toISOString(), overdue: left < 0, label: left < 0 ? `Fix overdue by ${span(left)}` : `Fix within ${span(left)}`, stage: "fix" };
};

/** Open work first: overdue, then soonest due, urgent before normal. */
export const sortTickets = (rows: TicketRow[]) =>
  [...rows].sort((a, b) => {
    const rank = (r: TicketRow) => (r.status === "resolved" ? 3 : r.sla.overdue ? 0 : r.status === "open" ? 1 : 2);
    return rank(a) - rank(b) || (a.priority === "urgent" ? -1 : 0) - (b.priority === "urgent" ? -1 : 0) || (a.sla.due ?? "~").localeCompare(b.sla.due ?? "~") || b.createdAt.localeCompare(a.createdAt);
  });

/** Counts for the health score: open and waiting tickets both mean the client has a problem. */
export const openTicketCount = (tickets: Pick<Ticket, "clientId" | "status">[], clientId: string) => tickets.filter((t) => t.clientId === clientId && t.status !== "resolved").length;
