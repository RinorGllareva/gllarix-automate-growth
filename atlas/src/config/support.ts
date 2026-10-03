import type { TicketCategory, TicketChannel, TicketPriority, TicketStatus } from "@/data/supportTypes";

/**
 * Ticket categories and their targets, from the service levels in config/operations.ts (SERVICE_LEVELS). Hours are
 * clock hours for now; business-hours calendars per client arrive with real data.
 */
export const TICKET_CATEGORIES: Record<TicketCategory, { label: string; firstHours: number; fixHours: number; level: string }> = {
  down: { label: "Receptionist down", firstHours: 1, fixHours: 4, level: "First reply 1 h · fixed in 4 h" },
  wrong_answers: { label: "Wrong answers or bookings", firstHours: 8, fixHours: 48, level: "First reply same day · fixed in 2 business days" },
  change: { label: "Change request", firstHours: 24, fixHours: 7 * 24, level: "First reply 1 business day · next weekend release" },
  billing: { label: "Billing question", firstHours: 24, fixHours: 72, level: "First reply 1 business day · fixed in 3 business days" },
  other: { label: "Other", firstHours: 24, fixHours: 72, level: "First reply 1 business day" },
};

export const TICKET_STATUS: Record<TicketStatus, { label: string; hue: "amber" | "blue" | "mint" }> = {
  open: { label: "Open", hue: "amber" },
  waiting: { label: "Waiting on client", hue: "blue" },
  resolved: { label: "Resolved", hue: "mint" },
};

export const TICKET_PRIORITY: Record<TicketPriority, { label: string; hue: "coral" | "text-3" | "cyan" }> = {
  urgent: { label: "Urgent", hue: "coral" },
  normal: { label: "Normal", hue: "cyan" },
  low: { label: "Low", hue: "text-3" },
};

export const TICKET_CHANNEL: Record<TicketChannel, string> = { email: "Email", phone: "Phone", whatsapp: "WhatsApp", internal: "Found by us" };
