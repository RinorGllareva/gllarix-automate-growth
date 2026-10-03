import { describe, expect, it } from "vitest";
import { createDemoSource } from "@/data/demo/demoSource";
import type { DataSource } from "@/data/types";
import { linkTargets, parseNotionExport } from "@/services/notionImport";

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

const A = "a".repeat(32);
const B = "b".repeat(32);
const EXPORT = [
  { path: `Export/Wiki ${A}.md`, text: `# Wiki\n\nStart with the [Sales playbook](Wiki%20${A}/Sales%20playbook%20${B}.md).\n![logo](Wiki%20${A}/logo.png)\nSee [Old page](Gone%20${"c".repeat(32)}.md).` },
  { path: `Export/Wiki ${A}/Sales playbook ${B}.md`, text: `# Sales playbook: v2\n\nBack to the [wiki](../Wiki%20${A}.md).` },
  { path: `Export/Tasks ${"d".repeat(32)}.csv`, text: "" },
];

describe("Notion export parser", () => {
  it("rebuilds the tree, keeps real titles, rewrites links and marks what's missing", () => {
    const { pages, skipped } = parseNotionExport(EXPORT);
    expect(skipped).toEqual([`Export/Tasks ${"d".repeat(32)}.csv`]);
    const wiki = pages.find((p) => p.title === "Wiki")!;
    const sales = pages.find((p) => p.notionId === B)!;
    expect(sales.title).toBe("Sales playbook: v2");
    expect(sales.parentKey).toBe(wiki.key);
    expect(wiki.body).toContain(`[Sales playbook](notion:${sales.key})`);
    expect(wiki.body).toContain("[image: logo]");
    expect(wiki.body).toContain("Old page (not in this export)");
    expect(sales.body).toContain(`(notion:${wiki.key})`);
    expect(linkTargets(wiki.body, (k) => (k === sales.key ? "doc-x" : undefined))).toContain("[Sales playbook](/docs/doc-x)");
  });
});

describe("docs and wiki", () => {
  it("imports Notion once, re-import updates, edits keep the tree sane, and only founders archive", async () => {
    const src = createDemoSource({ password: PW, persistLeads: false, now: () => Date.UTC(2026, 9, 2, 14), storage: new MemoryStorage() });
    await as(src, "rinor@atlas.test");
    const before = (await src.listDocs()).docs.length;
    expect((await src.importNotionDocs(EXPORT))).toMatchObject({ created: 2, updated: 0 });
    expect((await src.importNotionDocs(EXPORT))).toMatchObject({ created: 0, updated: 2 });
    let home = await src.listDocs();
    expect(home.docs.length).toBe(before + 2);
    expect(home.move).toMatchObject({ docsFromNotion: 2, brokenLinks: 1, readOnlyAt: null });
    const wiki = home.docs.find((d) => d.title === "Wiki")!;
    const sales = home.docs.find((d) => d.title === "Sales playbook: v2")!;
    expect(sales.parentId).toBe(wiki.id);
    expect((await src.getDoc(wiki.id)).body).toContain(`/docs/${sales.id}`);
    expect(sales.backlinks.map((b) => b.id)).toContain(wiki.id);
    await expect(src.saveDoc({ id: wiki.id, title: "Wiki", body: "", parentId: sales.id })).rejects.toThrow(/inside itself/);
    await src.setNotionReadOnly(true);
    expect((await src.listDocs()).move?.readOnlyAt).not.toBeNull();

    await as(src, "diego@atlas.test");
    home = await src.listDocs();
    expect(home.move).toBeNull();
    const mine = await src.saveDoc({ title: "My call notes template", body: "- opener", parentId: wiki.id });
    expect(mine.parentId).toBe(wiki.id);
    await expect(src.archiveDoc(mine.id)).rejects.toThrow();
    await as(src, "books@atlas.test");
    expect((await src.listDocs()).canEdit).toBe(false);
    await expect(src.saveDoc({ title: "x", body: "", parentId: null })).rejects.toThrow();
    await as(src, "rinor@atlas.test");
    await src.archiveDoc(wiki.id);
    home = await src.listDocs();
    expect(home.docs.find((d) => d.id === sales.id)?.parentId).toBeNull();
  });
});
