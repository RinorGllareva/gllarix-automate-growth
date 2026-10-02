import { describe, expect, it } from "vitest";
import type { LeadQuery } from "@/data/leadTypes";
import { CLEARED_QUERY } from "@/lib/leadQuery";
import { createDemoSource } from "@/data/demo/demoSource";
import type { DataSource } from "@/data/types";

const NOW = Date.UTC(2026, 9, 1, 12, 30); // Thu 1 Oct 2026
const PW = "pw";
const ALL: LeadQuery = { ...CLEARED_QUERY, sort: "score", dir: "desc", page: 1 };

class MemoryStorage implements Storage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  clear() {
    this.m.clear();
  }
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
}

/** One store, one browser: switch users by signing out and in again. */
const source = async (email: string) => {
  const src = createDemoSource({ password: PW, persistLeads: false, now: () => NOW, storage: new MemoryStorage() });
  await switchTo(src, email);
  return src;
};
const switchTo = async (src: DataSource, email: string) => {
  await src.signOut();
  const r = await src.signInWithPassword(email, PW);
  if (!r.ok) throw new Error("sign-in failed");
};

/** A fresh Gllarix deal on a lead without one, with a simple selection (one receptionist). */
const freshDeal = async (src: DataSource, ownerId?: string) => {
  const page = await src.listLeads(ALL);
  const existing = new Set((await src.listDeals()).map((r) => r.lead.id));
  const candidates = page.rows.filter((r) => !existing.has(r.lead.id) && r.contact?.email && (!ownerId || r.lead.ownerId === ownerId) && !["won", "lost"].includes(r.lead.stage));
  for (const row of candidates) {
    const id = await src.createDeal(row.lead.id);
    const d = await src.getDeal(id);
    if (d.row.deal.brand !== "gllarix") continue;
    const sel = { ...d.draft, market: "us" as const, tiers: { rec: "rec_m" }, qty: {}, pilot: false, disc: 0 };
    await src.updateDraft(id, sel);
    return { id, sel };
  }
  throw new Error("no Gllarix lead without a deal in the seed");
};

describe("deals and quotes (M6)", () => {
  it("a BDR can't give any extra discount, or request one", async () => {
    const src = await source("diego@atlas.test");
    const { id, sel } = await freshDeal(src, "u-bdr");
    await expect(src.updateDraft(id, { ...sel, disc: 5 })).rejects.toMatchObject({ status: 403 });
    await expect(src.requestDiscount(id, 15, "")).rejects.toMatchObject({ status: 403 });
    expect((await src.updateDraft(id, sel)).result.setup).toBe(1500);
  });

  it("an admin gives up to 10%; more needs the second founder's approval", async () => {
    const src = await source("rinor@atlas.test");
    const { id, sel } = await freshDeal(src);
    await src.updateDraft(id, { ...sel, disc: 10 });
    await expect(src.updateDraft(id, { ...sel, disc: 15 })).rejects.toThrow(/both founders/);
    await expect(src.updateDraft(id, { ...sel, disc: 31 })).rejects.toThrow(/0–30/);
    await src.requestDiscount(id, 15, "Competing offer");
    const [pending] = await src.pendingDiscounts();
    await expect(src.decideDiscount(pending.id, true)).rejects.toMatchObject({ status: 403 });
    await switchTo(src, "artin@atlas.test");
    await src.decideDiscount(pending.id, true);
    await switchTo(src, "rinor@atlas.test");
    expect((await src.updateDraft(id, { ...sel, disc: 15 })).draft.disc).toBe(15);
    await expect(src.updateDraft(id, { ...sel, disc: 20 })).rejects.toThrow(/both founders/);
  });

  it("saved versions are immutable; an accepted quote locks the deal", async () => {
    const src = await source("rinor@atlas.test");
    const { id, sel } = await freshDeal(src);
    const v1 = await src.saveQuote(id);
    await src.sendQuote(v1.id);
    await src.updateDraft(id, { ...sel, rush: true });
    const v2 = await src.saveQuote(id);
    expect([v1.version, v2.version]).toEqual([1, 2]);
    const quotes = (await src.getDeal(id)).quotes;
    expect(quotes.find((q) => q.id === v1.id)).toMatchObject({ status: "sent", setupMinor: 150_000 });
    expect(v2.setupMinor).toBe(188_000); // +25% rush, rounded to 10 like the calculator
    expect((await src.getDeal(id)).row.deal.stage).toBe("proposal_sent");

    await src.acceptQuote(v1.token, "Jane Client");
    const after = await src.getDeal(id);
    expect(after.editable).toBe(false);
    await expect(src.updateDraft(id, sel)).rejects.toThrow(/accepted or paid/);
    await expect(src.saveQuote(id)).rejects.toThrow(/accepted or paid/);
  });

  it("the Stripe webhook is idempotent and marks Won, creates the client and the setup commission", async () => {
    const src = await source("diego@atlas.test");
    const { id } = await freshDeal(src, "u-bdr");
    const q = await src.saveQuote(id);
    await src.sendQuote(q.id);
    await expect(src.startCheckout(q.token)).rejects.toThrow(/Accept/);
    await src.acceptQuote(q.token, "Jane Client");
    const session = await src.startCheckout(q.token);
    expect(session.amountMinor).toBe(75_000); // 50% of the $1,500 setup
    await src.completeTestCheckout(session.id);
    await src.completeTestCheckout(session.id);

    const event = {
      id: `evt_test_${session.id.slice(8)}`,
      type: "checkout.session.completed" as const,
      created: new Date(NOW).toISOString(),
      data: { object: { id: session.id, amount_total: session.amountMinor, currency: "usd", metadata: { quoteId: q.id, dealId: id } } },
    };
    expect(await src.stripeWebhook(event)).toEqual({ duplicate: true });

    const deal = await src.getDeal(id);
    expect(deal.row.deal).toMatchObject({ stage: "won", depositPaid: true });
    expect(deal.row.lead.stage).toBe("won");
    expect((await src.publicQuote(q.token))?.quote.status).toBe("paid");

    await switchTo(src, "rinor@atlas.test");
    expect((await src.listPayments()).filter((p) => p.dealId === id)).toHaveLength(1);
    expect((await src.listClients()).filter((c) => c.dealId === id)).toMatchObject([{ status: "onboarding" }]);
    const comm = (await src.listCommissions()).filter((c) => c.dealId === id && c.type === "setup_commission");
    expect(comm).toHaveLength(1);
    expect(comm[0]).toMatchObject({ userId: "u-bdr", amountMinor: 15_000, status: "pending" }); // 10% of $1,500, min 100
  });

  it("caps pilots at 2 won per brand", async () => {
    const src = await source("rinor@atlas.test");
    const used = (await src.listDeals()).filter((r) => r.deal.brand === "gllarix" && r.deal.stage === "won" && r.deal.pilot).length;
    for (let i = used; i < 2; i++) {
      const { id, sel } = await freshDeal(src);
      await src.updateDraft(id, { ...sel, pilot: true });
      const q = await src.saveQuote(id);
      await src.sendQuote(q.id);
      await src.acceptQuote(q.token, "Pilot Client");
      await src.completeTestCheckout((await src.startCheckout(q.token)).id);
    }
    const { id, sel } = await freshDeal(src);
    await expect(src.updateDraft(id, { ...sel, pilot: true })).rejects.toThrow(/No pilots left/);
  });

  it("the parity check passes in the app", async () => {
    const src = await source("rinor@atlas.test");
    expect((await src.parityCheck()).every((p) => p.pass)).toBe(true);
  });
});
