import { describe, expect, it } from "vitest";
import { CONTRACT_TEMPLATES } from "@/config/contracts";
import { createDemoSource } from "@/data/demo/demoSource";
import type { DataSource } from "@/data/types";
import { contractSections, fillContract } from "@/services/contracts";
import { textPdf, wrap } from "@/services/pdf";

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

describe("contract text and PDF", () => {
  it("fills every placeholder it knows and keeps unknowns visible", () => {
    const body = fillContract(CONTRACT_TEMPLATES[0], { brand: "gllarix", client: "Acme Plumbing", clientPlace: "Tampa, US", country: "US", signer: "Ana Ruiz, Owner", setup: "$1,500", deposit: "$750", monthly: "$699", items: ["AI receptionist"], pilot: true });
    expect(body).not.toMatch(/{{\w+}}/);
    expect(body).toContain("Acme Plumbing, Tampa, US");
    expect(body).toContain("- AI receptionist");
    expect(body).toContain("Pilot:");
    expect(contractSections(body)[0]).toMatchObject({ heading: "1. Parties" });
  });

  it("writes a valid PDF with an xref that points at its objects", () => {
    const b64 = textPdf("Test (1)", [{ text: "Hello € world", heading: true }, { text: "x ".repeat(2000) }]);
    const pdf = atob(b64);
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf).toContain("(Test \\(1\\)) Tj");
    expect(pdf).toContain("Hello EUR world");
    const xref = Number(pdf.match(/startxref\n(\d+)/)![1]);
    expect(pdf.slice(xref, xref + 4)).toBe("xref");
    const first = Number(pdf.slice(xref).split("\n")[3].slice(0, 10));
    expect(pdf.slice(first, first + 7)).toBe("1 0 obj");
    expect(wrap("a ".repeat(200), 20).every((l) => l.length <= 20)).toBe(true);
  });
});

describe("contracts: draft, send, sign", () => {
  it("drafts from the quote, signs on the public link, and files the PDF on the deal and its client", async () => {
    const src = createDemoSource({ password: PW, persistLeads: false, now: () => Date.UTC(2026, 9, 2, 14), storage: new MemoryStorage() });
    await as(src, "rinor@atlas.test");
    const deals = await src.listDeals();
    const row = deals.find((r) => r.latestQuote && r.deal.stage !== "lost") ?? deals[0];
    if (!row.latestQuote) await src.saveQuote(row.deal.id);

    const c = await src.createContract(row.deal.id);
    expect(c).toMatchObject({ status: "draft", version: 1 });
    expect(await src.publicContract(c.token)).toBeNull(); // drafts aren't public
    await expect(src.sendContract(c.id, "nope")).rejects.toThrow(/email/);
    const path = await src.sendContract(c.id, "owner@client.example");
    expect(path).toBe(`/c/${c.token}`);

    await src.signOut(); // the client isn't signed in
    const open = await src.publicContract(c.token);
    expect(open).toMatchObject({ status: "viewed" });
    await expect(src.signContract(c.token, { name: "Ana", title: null, email: "ana@client.example", agree: true })).rejects.toThrow(/full name/);
    await expect(src.signContract(c.token, { name: "Ana Ruiz", title: null, email: "ana@client.example", agree: false })).rejects.toThrow(/I agree/);
    const signed = await src.signContract(c.token, { name: "Ana Ruiz", title: "Owner", email: "ana@client.example", agree: true });
    expect(signed.status).toBe("signed");
    expect(signed.signature?.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(signed.signedPdfUrl).toMatch(/^data:application\/pdf;base64,/);

    await as(src, "rinor@atlas.test");
    const files = await src.listFiles("deal", row.deal.id);
    expect(files.find((f) => f.kind === "contract")?.name).toMatch(/signed\.pdf$/);
    await expect(src.deleteFile(files.find((f) => f.kind === "contract")!.id)).rejects.toThrow(/can't be deleted/);
    const client = (await src.clientsOverview()).cards.find((x) => x.id && x.status !== "proposal");
    if (client) {
      const detail = await src.getClient(client.id);
      if (detail.deal.id === row.deal.id) expect((await src.listFiles("client", client.id)).some((f) => f.kind === "contract")).toBe(true);
    }
    // A new version voids the old unsigned one but never a signed one.
    const v2 = await src.createContract(row.deal.id);
    expect((await src.listContracts(row.deal.id)).find((x) => x.id === c.id)?.status).toBe("signed");
    expect(v2.version).toBe(2);
  });
});
