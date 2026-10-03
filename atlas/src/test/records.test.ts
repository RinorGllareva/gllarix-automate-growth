import { describe, expect, it } from "vitest";
import { createDemoSource } from "@/data/demo/demoSource";
import type { DataSource } from "@/data/types";

const PW = "pw";
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
const as = async (src: DataSource, email: string) => {
  await src.signOut();
  const r = await src.signInWithPassword(email, PW);
  if (!r.ok) throw new Error("sign-in failed");
};
const setup = async () => {
  const src = createDemoSource({ password: PW, persistLeads: false, now: () => Date.UTC(2026, 9, 2, 14), storage: new MemoryStorage() });
  await as(src, "diego@atlas.test");
  const leads = await src.listLeads({ tiers: [], lists: [], countries: [], stages: [], owners: [], sources: [], brands: [], q: "", sort: "score", dir: "desc", page: 1 });
  return { src, leadId: leads.rows[0].lead.id };
};

describe("lead records: contacts, tags, files", () => {
  it("adds and edits contacts; a changed email goes back to not verified", async () => {
    const { src, leadId } = await setup();
    await expect(src.saveContact(leadId, { firstName: "Ana", lastName: "Ruiz", title: "Office manager", email: "not-an-email", phone: null, isDecisionMaker: false })).rejects.toThrow(/doesn't look right/);
    await src.saveContact(leadId, { firstName: "Ana", lastName: "Ruiz", title: "Office manager", email: "ana@example.com", phone: "+1 555 0100", isDecisionMaker: false });
    let d = await src.getLead(leadId);
    const ana = d.contacts.find((c) => c.firstName === "Ana")!;
    expect(ana).toMatchObject({ email: "ana@example.com", emailStatus: "unknown", title: "Office manager" });
    expect(d.activities.map((a) => a.title)).toContain("Contact added · Ana Ruiz");
    await src.saveContact(leadId, { id: ana.id, firstName: "Ana", lastName: "Ruiz", title: "Owner", email: "ana@example.com", phone: "+1 555 0100", isDecisionMaker: true });
    d = await src.getLead(leadId);
    expect(d.contacts.find((c) => c.id === ana.id)).toMatchObject({ title: "Owner", isDecisionMaker: true });
  });

  it("normalises tags and keeps them short", async () => {
    const { src, leadId } = await setup();
    await src.setLeadTags(leadId, [" Referral ", "referral", "has-crew"]);
    expect((await src.getLead(leadId)).lead.tags).toEqual(["referral", "has-crew"]);
    await expect(src.setLeadTags(leadId, ["no!"])).rejects.toThrow(/valid tag/);
  });

  it("files: the uploader or an admin deletes; the accountant only reads; other roles can't touch the lead", async () => {
    const { src, leadId } = await setup();
    const f = await src.uploadFile("lead", leadId, { name: "floor-plan.pdf", size: 1200, mime: "application/pdf", url: "data:application/pdf;base64,AA==" });
    expect((await src.listFiles("lead", leadId)).map((x) => x.name)).toEqual(["floor-plan.pdf"]);
    await expect(src.uploadFile("lead", leadId, { name: "big.zip", size: 3 * 1024 * 1024, mime: "application/zip", url: "data:," })).rejects.toThrow(/2 MB/);
    await as(src, "lena@atlas.test");
    await expect(src.listFiles("lead", leadId)).rejects.toThrow();
    await expect(src.saveContact(leadId, { firstName: "X", lastName: "", title: null, email: null, phone: null, isDecisionMaker: false })).rejects.toThrow();
    await as(src, "rinor@atlas.test");
    await src.deleteFile(f.id);
    expect(await src.listFiles("lead", leadId)).toEqual([]);
  });
});
