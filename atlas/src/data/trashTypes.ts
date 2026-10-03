/**
 * Trash (page standard §3): deleting moves a record here for 30 days. The person who deleted it can undo for
 * 10 minutes (the toast's Undo); founders restore or purge any time from Settings › Trash.
 */
export const TRASH_DAYS = 30;
export const UNDO_MINUTES = 10;

export type TrashEntity = "expense" | "cash_snapshot" | "contact" | "note" | "lead" | "deal" | "meeting" | "candidate" | "opening" | "competitor" | "channel" | "experiment" | "sop" | "doc" | "task" | "ticket_message" | "automation" | "template" | "thread" | "program";

export interface TrashItem {
  id: string;
  entity: TrashEntity;
  entityId: string;
  /** What people see: "Expense · Google Workspace · €18". */
  label: string;
  deletedAt: string;
  deletedBy: string | null;
  deletedByName?: string | null;
  /** Days left before it's purged. */
  daysLeft?: number;
}

export interface TrashApi {
  /** Founders see everything; others see what they deleted themselves. */
  listTrash(): Promise<TrashItem[]>;
  restoreFromTrash(id: string): Promise<void>;
  /** Founders only: gone for good. */
  purgeTrash(id: string): Promise<void>;
}
