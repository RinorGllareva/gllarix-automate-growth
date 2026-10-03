/**
 * Support tickets for live clients (spec/backbone/12 · service levels). Open tickets feed the client health score;
 * response and fix targets come from config/support.ts.
 */
export type TicketCategory = "down" | "wrong_answers" | "change" | "billing" | "other";
export type TicketStatus = "open" | "waiting" | "resolved";
export type TicketPriority = "urgent" | "normal" | "low";
export type TicketChannel = "email" | "phone" | "whatsapp" | "internal";

export interface TicketMessage {
  id: string;
  at: string;
  /** User id, or null when the client wrote it. */
  by: string | null;
  text: string;
  /** Internal notes are never sent to the client. */
  internal: boolean;
}

export interface Ticket {
  id: string;
  /** Short number people say out loud: "T-1004". */
  number: string;
  clientId: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  channel: TicketChannel;
  status: TicketStatus;
  assigneeId: string | null;
  createdBy: string | null;
  createdAt: string;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  messages: TicketMessage[];
}

export interface TicketRow extends Ticket {
  companyName: string;
  assigneeName: string | null;
  /** From services/support.slaState. */
  sla: { due: string | null; overdue: boolean; label: string; stage: "first" | "fix" | "done" };
}

export interface SupportApi {
  /** Founders and the implementer; a client id narrows it to one client. */
  listTickets(clientId?: string): Promise<{ tickets: TicketRow[]; people: { id: string; name: string }[] }>;
  getTicket(id: string): Promise<Omit<TicketRow, "messages"> & { messages: (TicketMessage & { byName: string | null })[] }>;
  createTicket(input: { clientId: string; subject: string; body: string; category: TicketCategory; priority: TicketPriority; channel: TicketChannel }): Promise<Ticket>;
  /** A reply to the client counts as the first response and waits on them; an internal note changes nothing. */
  replyTicket(id: string, input: { text: string; internal: boolean }): Promise<void>;
  updateTicket(id: string, patch: { status?: TicketStatus; assigneeId?: string | null; priority?: TicketPriority }): Promise<void>;
}
