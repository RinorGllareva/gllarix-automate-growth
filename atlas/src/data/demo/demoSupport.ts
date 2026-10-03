import { TICKET_CATEGORIES } from "@/config/support";
import { slaState, sortTickets } from "@/services/support";
import type { Company } from "../leadTypes";
import type { Client } from "../quoteTypes";
import type { SupportApi, Ticket, TicketRow } from "../supportTypes";
import { AccessError, type Notification, type User } from "../types";

export interface SupportStore {
  clients: Client[];
  companies: Company[];
  tickets?: Ticket[];
}

interface Ctx<S extends SupportStore> {
  load: () => Promise<S>;
  save: () => Promise<void>;
  viewer: () => Promise<User>;
  now: () => number;
  users: User[];
  uid: (p: string) => string;
  audit: (userId: string | null, action: string, entity: string, entityId: string | null, before?: unknown, after?: unknown) => void;
  notify: (n: Omit<Notification, "id" | "createdAt" | "readAt">) => void;
}

const HOUR = 3_600_000;
const SUPPORT: User["role"][] = ["admin", "implementer"];

export const createDemoSupport = <S extends SupportStore>(ctx: Ctx<S>) => {
  const { load, save, viewer, now, users, uid, audit, notify } = ctx;
  const iso = (t = now()) => new Date(t).toISOString();
  const nameOf = (id: string | null) => (id ? (users.find((u) => u.id === id)?.name ?? null) : null);
  const implementer = () => users.find((u) => u.role === "implementer" && u.active)?.id ?? null;
  const requireSupport = async () => {
    const user = await viewer();
    if (!SUPPORT.includes(user.role)) throw new AccessError(403, "Support is for the founders and the implementer.");
    return user;
  };

  /** A few tickets on live clients, one of them late, so the page shows its job on day one. */
  const ticketsOf = (s: S) => {
    if (s.tickets) return s.tickets;
    const t = now();
    const live = s.clients.filter((c) => c.status === "live" || c.status === "paused");
    const who = implementer();
    const mk = (c: Client | undefined, n: number, p: Partial<Ticket> & Pick<Ticket, "subject" | "category">, hoursAgo: number, msgs: [string | null, string, boolean?][]): Ticket | null =>
      c
        ? {
            id: uid("tk"), number: `T-${1000 + n}`, clientId: c.id, priority: "normal", channel: "email", status: "open", assigneeId: who, createdBy: null,
            createdAt: iso(t - hoursAgo * HOUR), firstResponseAt: null, resolvedAt: null, ...p,
            messages: msgs.map(([by, text, internal], i) => ({ id: uid("tm"), at: iso(t - (hoursAgo - i * 0.5) * HOUR), by, text, internal: !!internal })),
          }
        : null;
    s.tickets = [
      mk(live[0], 1, { subject: "Receptionist booked two jobs in the same slot", category: "wrong_answers", channel: "phone" }, 10, [[null, "Tuesday 9am got booked twice. The second customer was annoyed."]]),
      mk(live[1] ?? live[0], 2, { subject: "Add the new Saturday opening hours", category: "change", status: "waiting", firstResponseAt: iso(t - 20 * HOUR) }, 26, [
        [null, "We now open Saturdays 8–12. Can the assistant say that?"],
        [who, "Yes, we'll add it in this weekend's release. Do you also take emergency calls on Saturday afternoon?"],
      ]),
      mk(live[0], 3, { subject: "Invoice shows overage we didn't expect", category: "billing", status: "resolved", firstResponseAt: iso(t - 70 * HOUR), resolvedAt: iso(t - 50 * HOUR) }, 72, [
        [null, "Why were we charged for 120 extra minutes?"],
        [who, "A spam caller kept the line busy on the 14th. We've credited the minutes and blocked the number."],
      ]),
    ].filter((x): x is Ticket => !!x);
    return s.tickets;
  };

  const rowFor = (s: S, tk: Ticket): TicketRow => {
    const c = s.clients.find((x) => x.id === tk.clientId);
    return { ...tk, companyName: (c && s.companies.find((co) => co.id === c.companyId)?.name) ?? "—", assigneeName: nameOf(tk.assigneeId), sla: slaState(tk, now()) };
  };
  const find = (s: S, id: string) => {
    const tk = ticketsOf(s).find((x) => x.id === id);
    if (!tk) throw new AccessError(404);
    return tk;
  };

  const api: SupportApi = {
    async listTickets(clientId) {
      await requireSupport();
      const s = await load();
      const fresh = !s.tickets;
      const rows = ticketsOf(s)
        .filter((tk) => !clientId || tk.clientId === clientId)
        .map((tk) => rowFor(s, tk));
      if (fresh) await save();
      return { tickets: sortTickets(rows), people: users.filter((u) => u.active && SUPPORT.includes(u.role)).map((u) => ({ id: u.id, name: u.name })) };
    },

    async getTicket(id) {
      await requireSupport();
      const s = await load();
      const tk = find(s, id);
      return { ...rowFor(s, tk), messages: tk.messages.map((m) => ({ ...m, byName: m.by ? nameOf(m.by) : null })) };
    },

    async createTicket(input) {
      const user = await requireSupport();
      const s = await load();
      const c = s.clients.find((x) => x.id === input.clientId);
      if (!c) throw new AccessError(404);
      if (!input.subject.trim()) throw new Error("Give the ticket a subject.");
      const all = ticketsOf(s);
      const n = all.reduce((m, x) => Math.max(m, Number(x.number.slice(2)) || 1000), 1000) + 1;
      const at = iso();
      const tk: Ticket = {
        id: uid("tk"), number: `T-${n}`, clientId: c.id, subject: input.subject.trim(), category: input.category, priority: input.priority, channel: input.channel, status: "open",
        assigneeId: implementer() ?? user.id, createdBy: user.id, createdAt: at, firstResponseAt: null, resolvedAt: null,
        messages: input.body.trim() ? [{ id: uid("tm"), at, by: input.channel === "internal" ? user.id : null, text: input.body.trim(), internal: input.channel === "internal" }] : [],
      };
      all.push(tk);
      const name = rowFor(s, tk).companyName;
      // Urgent or "down" tickets reach everyone who can fix them, not only the assignee.
      const alert = input.priority === "urgent" || input.category === "down";
      users
        .filter((u) => u.active && SUPPORT.includes(u.role) && u.id !== user.id && (alert || u.id === tk.assigneeId))
        .forEach((u) => notify({ userId: u.id, type: "client_health", text: `${alert ? "Urgent ticket" : "New ticket"} ${tk.number} · ${name}: ${tk.subject} (${TICKET_CATEGORIES[tk.category].level.split(" · ")[0]})`, href: `/support/${tk.id}` }));
      audit(user.id, "ticket.create", "ticket", tk.id, null, { clientId: c.id, category: tk.category, priority: tk.priority });
      await save();
      return tk;
    },

    async replyTicket(id, input) {
      const user = await requireSupport();
      const s = await load();
      const tk = find(s, id);
      if (!input.text.trim()) throw new Error("Write something first.");
      const at = iso();
      tk.messages.push({ id: uid("tm"), at, by: user.id, text: input.text.trim(), internal: input.internal });
      if (!input.internal) {
        tk.firstResponseAt ??= at;
        if (tk.status === "open") tk.status = "waiting";
      }
      audit(user.id, input.internal ? "ticket.note" : "ticket.reply", "ticket", tk.id, null, null);
      await save();
    },

    async updateTicket(id, patch) {
      const user = await requireSupport();
      const s = await load();
      const tk = find(s, id);
      const before = { status: tk.status, assigneeId: tk.assigneeId, priority: tk.priority };
      if (patch.status && patch.status !== tk.status) {
        tk.status = patch.status;
        tk.resolvedAt = patch.status === "resolved" ? iso() : null;
      }
      if (patch.assigneeId !== undefined) {
        if (patch.assigneeId && !users.some((u) => u.id === patch.assigneeId && SUPPORT.includes(u.role))) throw new Error("Assign it to a founder or the implementer.");
        tk.assigneeId = patch.assigneeId;
        if (patch.assigneeId && patch.assigneeId !== user.id) notify({ userId: patch.assigneeId, type: "task", text: `${user.name} gave you ticket ${tk.number}: ${tk.subject}`, href: `/support/${tk.id}` });
      }
      if (patch.priority) tk.priority = patch.priority;
      audit(user.id, "ticket.update", "ticket", tk.id, before, { status: tk.status, assigneeId: tk.assigneeId, priority: tk.priority });
      await save();
    },
  };

  return { api, ticketsOf };
};
