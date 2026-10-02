import { MEETING_BONUS_CURRENCY, MEETING_BONUS_MINOR } from "@/config/targets";
import type { Meeting } from "@/data/queueTypes";
import type { Commission } from "@/data/salesTypes";

/**
 * Commission maths (services/commissions.py). M4: the $15 meeting bonus, pending once a meeting is approved.
 * Setup and recurring commission on collected cash (10%, min $100; 10% × 6 months) arrive with payments in M6.
 */
export const meetingBonus = (meeting: Meeting, period: string, id: string, at: string): Commission => ({
  id,
  userId: meeting.bookedBy,
  meetingId: meeting.id,
  dealId: null,
  type: "meeting_bonus",
  amountMinor: MEETING_BONUS_MINOR,
  currency: MEETING_BONUS_CURRENCY,
  status: "pending",
  period,
  createdAt: at,
});

/** Bonus owed for a set of meetings: $15 × approved. */
export const bonusTotalMinor = (meetings: Meeting[]) => meetings.filter((m) => m.approved === true).length * MEETING_BONUS_MINOR;

/** Sum of live (not void or clawed back) commissions per user, in minor units. */
export const commissionTotals = (rows: Commission[]) => {
  const totals = new Map<string, number>();
  for (const c of rows) {
    if (c.status === "void" || c.status === "clawed_back") continue;
    totals.set(c.userId, (totals.get(c.userId) ?? 0) + c.amountMinor);
  }
  return totals;
};
