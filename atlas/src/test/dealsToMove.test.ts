import { describe, expect, it } from "vitest";
import type { DealRow } from "@/data/salesTypes";
import { dealsToMove } from "@/services/deals";

const NOW = Date.parse("2026-10-02T15:00:00Z");
const ago = (days: number) => new Date(NOW - days * 86_400_000).toISOString();

const row = (id: string, patch: { stage?: string; owner?: string; meeting?: string | null; quote?: DealRow["latestQuote"]; changed?: string; deposit?: boolean } = {}) =>
  ({
    deal: { id, stage: patch.stage ?? "proposal", ownerId: patch.owner ?? "u-diego", stageChangedAt: patch.changed ?? ago(1), depositPaid: patch.deposit ?? false },
    company: { name: `Co ${id}` },
    nextMeetingAt: patch.meeting ?? null,
    latestQuote: patch.quote ?? null,
  }) as unknown as DealRow;

const q = (p: Partial<NonNullable<DealRow["latestQuote"]>>) => ({ version: 1, status: "sent" as const, sentAt: null, openedAt: null, paidAt: null, ...p });

describe("deals to move today", () => {
  it("puts prep and money first, chases quotes by age, and skips what's fresh or not mine", () => {
    const moves = dealsToMove(
      [
        row("fresh", { quote: q({ sentAt: ago(1) }) }), // sent yesterday: the client has the ball
        row("chase", { quote: q({ sentAt: ago(4) }) }),
        row("opened", { quote: q({ sentAt: ago(5), openedAt: ago(2) }) }),
        row("meet", { meeting: new Date(NOW + 2 * 3_600_000).toISOString() }),
        row("paid", { deposit: true, quote: q({ status: "paid", paidAt: ago(0) }) }),
        row("stuck", { meeting: null, quote: q({ sentAt: ago(1) }), changed: ago(20) }),
        row("other", { owner: "u-other", quote: q({ status: "draft" }) }),
        row("won", { stage: "won" }),
      ],
      "u-diego",
      NOW,
      10,
    );
    expect(moves.map((m) => m.dealId)).toEqual(["meet", "paid", "opened", "chase"]);
    expect(moves[0].text).toBe("Prep: meeting in 2 h");
    expect(moves[3].text).toContain("not opened in 4 d");
  });

  it("leaves out meetings further than a day away and deals the client is holding", () => {
    const moves = dealsToMove(
      [
        row("later", { meeting: new Date(NOW + 3 * 86_400_000).toISOString() }),
        row("opened-today", { quote: q({ sentAt: ago(2), openedAt: ago(0) }) }),
        row("draft", { quote: q({ status: "draft" }) }),
        row("nothing", {}),
      ],
      "u-diego",
      NOW,
    );
    expect(moves.map((m) => [m.dealId, m.priority])).toEqual([
      ["draft", 4],
      ["nothing", 4],
    ]);
  });
});
