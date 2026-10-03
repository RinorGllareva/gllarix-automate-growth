import { describe, expect, it } from "vitest";
import { createDemoSource } from "@/data/demo/demoSource";
import type { DataSource } from "@/data/types";
import { applyView } from "@/services/views";
import { parseTable, pipeBytes } from "@/services/fileParse";
import { parseImportDate } from "@/data/demo/demoFoundations";
import { autoMap } from "@/services/importPlan";
import { autoMapColumns, IMPORT_SCHEMAS } from "@/config/importSchemas";

/** A zip (stored, or deflated like Excel writes them), enough to test the .xlsx reader without a library. */
const deflate = (data: Uint8Array) => pipeBytes(data, new CompressionStream("deflate-raw"));
const makeZip = async (files: Record<string, string>, compress: boolean) => {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const le = (n: number, bytes: number) => Array.from({ length: bytes }, (_, i) => (n >>> (8 * i)) & 0xff);
  for (const [name, text] of Object.entries(files)) {
    const nameB = enc.encode(name);
    const plain = enc.encode(text);
    const data = compress ? await deflate(plain) : plain;
    const method = compress ? 8 : 0;
    const local = new Uint8Array([...le(0x04034b50, 4), ...le(20, 2), 0, 0, ...le(method, 2), 0, 0, 0, 0, ...le(0, 4), ...le(data.length, 4), ...le(data.length, 4), ...le(nameB.length, 2), 0, 0, ...nameB]);
    central.push(new Uint8Array([...le(0x02014b50, 4), ...le(20, 2), ...le(20, 2), 0, 0, ...le(method, 2), 0, 0, 0, 0, ...le(0, 4), ...le(data.length, 4), ...le(data.length, 4), ...le(nameB.length, 2), 0, 0, 0, 0, 0, 0, 0, 0, ...le(0, 4), ...le(offset, 4), ...nameB]));
    parts.push(local, data);
    offset += local.length + data.length;
  }
  const cdSize = central.reduce((n, c) => n + c.length, 0);
  const n = Object.keys(files).length;
  const eocd = new Uint8Array([...le(0x06054b50, 4), 0, 0, 0, 0, ...le(n, 2), ...le(n, 2), ...le(cdSize, 4), ...le(offset, 4), 0, 0]);
  return new Blob([...parts, ...central, eocd]);
};

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
  if (!(await src.signInWithPassword(email, PW)).ok) throw new Error("sign-in failed");
};
const setup = async () => {
  const clock = { t: Date.UTC(2026, 9, 3, 14) };
  const src = createDemoSource({ password: PW, persistLeads: false, now: () => clock.t, storage: new MemoryStorage() });
  await as(src, "rinor@atlas.test");
  return { src, clock };
};

describe("events table", () => {
  it("records writes (not reads), filters by record, and hides other people's records from sellers", async () => {
    const { src } = await setup();
    const { tickets } = await src.listTickets();
    await src.updateTicket(tickets[0].id, { priority: "urgent" });
    const evs = await src.recordEvents("ticket", tickets[0].id);
    expect(evs[0]).toMatchObject({ type: "ticket.update", entity: "ticket", entityId: tickets[0].id, actor: "u-rinor" });
    expect(evs[0].actorName).toMatch(/Rinor/);
    await src.scorecard("u-bdr");
    expect((await src.listEvents({ limit: 500 })).some((e) => e.type.endsWith(".view"))).toBe(false);
    expect((await src.listEvents({ type: "ticket.*" })).length).toBeGreaterThan(0);
    await as(src, "diego@atlas.test");
    expect((await src.listEvents({ type: "ticket.*" })).length).toBe(0);
    await expect(src.recordEvents("ticket", tickets[0].id)).rejects.toMatchObject({ status: 403 });
  });

  it("meeting timelines: marking held is on the meeting, and its seller can read it but others can't", async () => {
    const { src } = await setup();
    await as(src, "diego@atlas.test");
    const mine = (await src.listMeetings()).rows.find((r) => r.status === "to_hold" && r.meeting.bookedBy === "u-bdr");
    expect(mine).toBeTruthy();
    if (!mine) return;
    await src.markMeeting(mine.meeting.id, { attended: true, durationMin: 30 });
    expect((await src.recordEvents("meeting", mine.meeting.id)).some((e) => e.type === "meeting.mark")).toBe(true);
    await as(src, "lena@atlas.test");
    await expect(src.recordEvents("meeting", mine.meeting.id)).rejects.toMatchObject({ status: 403 });
  });

  it("webhooks: https only, deliveries are simulated and signed in demo mode", async () => {
    const { src, clock } = await setup();
    await expect(src.saveWebhook({ url: "http://example.com/hook", events: ["deal.*"], active: true })).rejects.toThrow(/https/);
    const w = await src.saveWebhook({ url: "https://hooks.example.com/atlas", events: ["ticket.*"], active: true });
    expect(w.secret).toMatch(/^whsec_/);
    clock.t += 1000;
    const { tickets } = await src.listTickets();
    await src.updateTicket(tickets[0].id, { priority: "low" });
    const { deliveries } = await src.listWebhooks();
    expect(deliveries[0]).toMatchObject({ webhookId: w.id, eventType: "ticket.update", status: "simulated" });
    expect(deliveries[0].signature).toMatch(/^sha256=[0-9a-f]{64}$/);
    await src.deleteWebhook(w.id);
    expect((await src.listWebhooks()).webhooks).toEqual([]);
  });
});

describe("custom fields", () => {
  it("defines, validates, stores and hides values like the record they belong to", async () => {
    const { src } = await setup();
    const f = await src.saveFieldDef({ entity: "deal", label: "Contract end", type: "date", options: [], inTable: true });
    expect(f.key).toBe("contract_end");
    const tier = await src.saveFieldDef({ entity: "deal", label: "Tier", type: "select", options: ["Gold", "Silver"], inTable: false });
    await expect(src.saveFieldDef({ entity: "deal", label: "Bad", type: "select", options: ["One"], inTable: false })).rejects.toThrow(/two options/);
    const deal = (await src.listDeals())[0];
    await src.setCustomValue("deal", deal.deal.id, "contract_end", "31.12.2026");
    await src.setCustomValue("deal", deal.deal.id, "tier", "gold");
    await expect(src.setCustomValue("deal", deal.deal.id, "tier", "Bronze")).rejects.toThrow(/Gold, Silver/);
    expect((await src.customValues("deal", [deal.deal.id]))[deal.deal.id]).toEqual({ contract_end: "2026-12-31", tier: "Gold" });
    await src.moveFieldDef(tier.id, "up");
    expect((await src.listFieldDefs("deal")).map((x) => x.key)).toEqual(["tier", "contract_end"]);
    await expect(src.saveFieldDef({ ...tier, type: "text" })).rejects.toThrow(/type/);
    await src.deleteFieldDef(f.id);
    expect((await src.customValues("deal", [deal.deal.id]))[deal.deal.id]).toEqual({ tier: "Gold" });
    const other = (await src.listDeals()).find((d) => d.deal.ownerId !== "u-bdr")!;
    await src.setCustomValue("deal", other.deal.id, "tier", "Silver");
    await as(src, "diego@atlas.test");
    expect(await src.customValues("deal", [other.deal.id])).toEqual({});
  });
});

describe("saved views", () => {
  it("keeps views per person and page; only founders share", async () => {
    const { src } = await setup();
    const state = { q: "acme", filters: [{ key: "status", values: ["open"] }], sort: { key: "date", dir: "desc" as const } };
    const mine = await src.savePageView({ page: "support", name: "Open acme", state });
    await src.savePageView({ page: "support", name: "Team view", state, shared: true });
    await src.savePageView({ page: "support", name: "open ACME", state: { ...state, q: "acme2" } });
    expect((await src.listPageViews("support")).filter((v) => v.ownerId === "u-rinor")).toHaveLength(2);
    expect((await src.listPageViews("support")).find((v) => v.id === mine.id)!.state.q).toBe("acme2");
    await as(src, "lena@atlas.test");
    expect((await src.listPageViews("support")).map((v) => v.name)).toEqual(["Team view"]);
    await expect(src.savePageView({ page: "support", name: "Mine", state, shared: true })).rejects.toMatchObject({ status: 403 });
    await expect(src.deletePageView(mine.id)).rejects.toMatchObject({ status: 403 });
  });

  it("applies search, select, date and number filters and sorts", () => {
    const rows = [
      { id: "a", name: "Acme", status: "open", date: "2026-10-01", amount: 50 },
      { id: "b", name: "Bolt", status: "closed", date: "2026-09-01", amount: 500 },
      { id: "c", name: "Acme two", status: "open", date: "2026-10-20", amount: 5 },
    ];
    const fields = [
      { key: "status", label: "Status", type: "select" as const, get: (r: (typeof rows)[number]) => r.status },
      { key: "date", label: "Date", type: "date" as const, get: (r: (typeof rows)[number]) => r.date },
      { key: "amount", label: "Amount", type: "number" as const, get: (r: (typeof rows)[number]) => r.amount },
    ];
    const pick = (state: Parameters<typeof applyView>[1]) => applyView(rows, state, fields, (r) => r.name).map((r) => r.id);
    expect(pick({ q: "acme", filters: [], sort: null })).toEqual(["a", "c"]);
    expect(pick({ q: "", filters: [{ key: "status", values: ["open"] }, { key: "date", from: "2026-10-05" }], sort: null })).toEqual(["c"]);
    expect(pick({ q: "", filters: [{ key: "amount", min: 10 }], sort: { key: "amount", dir: "desc" } })).toEqual(["b", "a"]);
  });
});

describe("Import Center", () => {
  it("previews, imports, skips duplicates and undoes a batch of expenses", async () => {
    const { src } = await setup();
    const rows: Record<string, string>[] = [
      { date: "03.10.2026", vendor: "Hetzner", amount: "1.234,50", currency: "EUR", category: "tools" },
      { date: "2026-10-03", vendor: "Hetzner", amount: "1234.50" },
      { date: "", vendor: "Nobody", amount: "5" },
    ];
    const dry = await src.runEntityImport({ entity: "expense", fileName: "bank.csv", sourceName: "Bank", rows, dryRun: true });
    expect(dry.job).toBeNull();
    expect(dry.rows.map((r) => r.status)).toEqual(["create", "duplicate", "error"]);
    const before = (await src.listFinanceData()).expenses.length;
    const { job } = await src.runEntityImport({ entity: "expense", fileName: "bank.csv", sourceName: "Bank", rows });
    expect(job).toMatchObject({ created: 1, duplicates: 1, failed: 1 });
    expect((await src.listFinanceData()).expenses.find((e) => e.vendor === "Hetzner")).toMatchObject({ amountMinor: 123450, date: "2026-10-03" });
    expect((await src.runEntityImport({ entity: "expense", fileName: "bank.csv", sourceName: "Bank", rows: rows.slice(0, 1), dryRun: true })).rows[0].status).toBe("duplicate");
    expect(await src.undoEntityImport(job!.id)).toEqual({ removed: 1 });
    expect((await src.listFinanceData()).expenses.length).toBe(before);
    await expect(src.undoEntityImport(job!.id)).rejects.toThrow(/already/);
    await src.saveImportMapping("expense", "Bank", { Datum: "date", Betrag: "amount" });
    expect(await src.getImportMapping("expense", "bank")).toEqual({ Datum: "date", Betrag: "amount" });
  });

  it("imports candidates with custom fields and tasks into a list", async () => {
    const { src } = await setup();
    await src.saveFieldDef({ entity: "candidate", label: "Years selling", type: "number", options: [], inTable: false });
    const { openings } = await src.hiringBoard();
    const r = await src.runEntityImport({
      entity: "candidate",
      fileName: "c.csv",
      sourceName: "Form",
      target: openings[0].id,
      rows: [
        { name: "Ana Test", email: "ana@example.com", source: "linkedin", "custom:years_selling": "4" },
        { name: "Bad", "custom:years_selling": "lots" },
      ],
    });
    expect(r.rows.map((x) => x.status)).toEqual(["create", "error"]);
    const cand = (await src.hiringBoard()).candidates.find((c) => c.email === "ana@example.com")!;
    expect(cand.source).toBe("LinkedIn");
    expect((await src.customValues("candidate", [cand.id]))[cand.id]).toEqual({ years_selling: 4 });
    const list = (await src.tasksHome()).spaces[0].lists[0];
    const t = await src.runEntityImport({ entity: "task", fileName: "n.csv", sourceName: "Notion", target: list.id, rows: [{ title: "Imported one", due: "2026-10-20", estimate: "1.5", priority: "high" }] });
    expect(t.job!.created).toBe(1);
    const task = await src.getTask(t.job!.createdIds[0]);
    expect(task.task).toMatchObject({ title: "Imported one", dueAt: "2026-10-20", estimateMinutes: 90, priority: "high" });
    await as(src, "diego@atlas.test");
    await expect(src.listEntityImports()).rejects.toMatchObject({ status: 403 });
  });

  it("maps HubSpot, Pipedrive and Apollo lead exports, and bank exports, by column name", () => {
    expect(autoMap(["Company name", "Phone Number", "Website URL", "City", "State/Region", "Country/Region"])).toMatchObject({ "Company name": "companyName", "Phone Number": "phone", "Website URL": "website", "State/Region": "region", "Country/Region": "country" });
    expect(autoMap(["Organization - Name", "Person - Email", "Person - Phone", "Organization - City"])).toMatchObject({ "Organization - Name": "companyName", "Person - Email": "email", "Person - Phone": "phone", "Organization - City": "city" });
    expect(autoMap(["Company", "Company Phone", "Title", "Company City", "Company State", "Company Country", "Industry"])).toMatchObject({ Company: "companyName", "Company Phone": "phone", Title: "contactTitle", "Company State": "region", Industry: "industry" });
    expect(autoMapColumns(["Buchungsdatum", "Empfänger", "Betrag", "Währung"], IMPORT_SCHEMAS.expense.fields)).toEqual({ Buchungsdatum: "date", "Empfänger": "vendor", Betrag: "amount", "Währung": "currency" });
  });

  it("reads CSV and JSON files into headers and rows", async () => {
    const csv = await parseTable(new File(["Date,Vendor,Amount\n2026-10-01,Hetzner,12.50\n"], "bank.csv", { type: "text/csv" }));
    expect(csv).toMatchObject({ headers: ["Date", "Vendor", "Amount"], rows: [{ Date: "2026-10-01", Vendor: "Hetzner", Amount: "12.50" }] });
    const json = await parseTable(new File([JSON.stringify([{ name: "Ana", years: 4 }])], "c.json", { type: "application/json" }));
    expect(json).toMatchObject({ headers: ["name", "years"], rows: [{ name: "Ana", years: "4" }] });
  });

  it("reads the first sheet of an .xlsx (shared strings, numbers, gaps)", async () => {
    const files: Record<string, string> = {
      "xl/workbook.xml": '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Bank" r:id="rId1"/></sheets></workbook>',
      "xl/_rels/workbook.xml.rels": '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
      "xl/sharedStrings.xml": "<sst><si><t>Date</t></si><si><t>Vendor</t></si><si><t>Amount</t></si><si><r><t>Hetz</t></r><r><t>ner</t></r></si></sst>",
      "xl/worksheets/sheet1.xml":
        '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row><row r="2"><c r="A2"><v>46298</v></c><c r="B2" t="s"><v>3</v></c><c r="C2"><v>12.5</v></c></row><row r="3"><c r="B3" t="inlineStr"><is><t>Gap</t></is></c></row></sheetData></worksheet>',
    };
    for (const compress of [false, true]) {
      const t = await parseTable(new File([await makeZip(files, compress)], "bank.xlsx"));
      expect(t.sheet).toBe("Bank");
      expect(t.headers).toEqual(["Date", "Vendor", "Amount"]);
      expect(t.rows).toEqual([
        { Date: "46298", Vendor: "Hetzner", Amount: "12.5" },
        { Date: "", Vendor: "Gap", Amount: "" },
      ]);
    }
    expect(parseImportDate("46298")).toBe("2026-10-03");
  });
});
