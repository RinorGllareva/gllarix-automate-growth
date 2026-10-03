import { linkTargets, parseNotionExport } from "@/services/notionImport";
import type { Doc, DocRow, DocsApi } from "../docTypes";
import { AccessError, type User } from "../types";

export interface DocsStore {
  notionImportedAt: string | null;
  docs?: Doc[];
  notionReadOnly?: { at: string; by: string } | null;
}

interface Ctx<S extends DocsStore> {
  load: () => Promise<S>;
  save: () => Promise<void>;
  viewer: () => Promise<User>;
  now: () => number;
  users: User[];
  uid: (p: string) => string;
  audit: (userId: string | null, action: string, entity: string, entityId: string | null, before?: unknown, after?: unknown) => void;
}

const LINK = /\]\(\/docs\/([\w-]+)\)/g;

export const createDemoDocs = <S extends DocsStore>(ctx: Ctx<S>) => {
  const { load, save, viewer, now, users, uid, audit } = ctx;
  const iso = () => new Date(now()).toISOString();
  const nameOf = (id: string | null) => (id ? (users.find((u) => u.id === id)?.name ?? null) : null);
  const requireAdmin = (u: User) => {
    if (u.role !== "admin") throw new AccessError(403, "Founders manage the wiki structure.");
  };

  /** Starter pages so the wiki has a shape on day one; the Notion import fills the rest. */
  const docsOf = (s: S) => {
    if (s.docs) return s.docs;
    const at = iso();
    const mk = (id: string, title: string, icon: string, parentId: string | null, body: string): Doc => ({
      id, title, icon, parentId, body, source: "atlas", notionId: null, createdBy: null, updatedBy: null, createdAt: at, updatedAt: at, archived: false,
    });
    s.docs = [
      mk("doc-handbook", "Company handbook", "📘", null, "Who we are, how we work, and where things live.\n\n## Pages\n- [Sales playbook](/docs/doc-sales)\n- [Gllarix onboarding SOP](/docs/doc-onboarding)\n- [Weekly rhythm](/docs/doc-rhythm)\n\n## Where things live\n| What | Where |\n|---|---|\n| Leads, deals, clients | Atlas › Sell |\n| Tasks and SOP checklists | Atlas › Work |\n| Money and payouts | Atlas › Money |\n| This wiki | Atlas › Work › Docs and wiki |"),
      mk("doc-sales", "Sales playbook", "📞", "doc-handbook", "How we sell the two offers.\n\n## The call\n1. Opener under 20 seconds, say the call is recorded.\n2. Three questions: missed calls, job value, after-hours.\n3. Book a demo on the live line, or send the one-pager.\n\n## Objections\nAnswers live in the call workspace. **Never improvise a claim**: if there's no approved answer, ask a question back and log it.\n\n> Approved answers are written by a founder from what BDRs log on calls."),
      mk("doc-onboarding", "Gllarix onboarding SOP", "🛠️", "doc-handbook", "From deposit to go-live in under 7 days.\n\n- [ ] Intake form received\n- [ ] Agent drafted from the website FAQ\n- [ ] Business number forwarded\n- [ ] Test calls pass\n- [ ] Go live and start billing\n\nThe same steps are the client's onboarding checklist in Atlas › Clients."),
      mk("doc-rhythm", "Weekly rhythm", "🗓️", "doc-handbook", "## Every day\n- BDR: queue, callbacks, inbound within 15 minutes.\n\n## Saturday\n- 1:1 on the scorecard.\n- Approve last week's meetings.\n\n## Month end\n- Close the books by the 5th (Money › Finance)."),
    ];
    return s.docs;
  };

  const rowsOf = (s: S): DocRow[] => {
    const all = docsOf(s).filter((d) => !d.archived);
    const back = new Map<string, { id: string; title: string }[]>();
    for (const d of all) for (const m of d.body.matchAll(LINK)) if (m[1] !== d.id) back.set(m[1], [...(back.get(m[1]) ?? []).filter((x) => x.id !== d.id), { id: d.id, title: d.title }]);
    return all.map(({ body: _body, ...d }) => ({ ...d, updatedByName: nameOf(d.updatedBy), backlinks: back.get(d.id) ?? [] }));
  };

  const api: DocsApi = {
    async listDocs() {
      const user = await viewer();
      const s = await load();
      const fresh = !s.docs;
      const docs = rowsOf(s).sort((a, b) => a.title.localeCompare(b.title));
      if (fresh) await save();
      const notion = docsOf(s).filter((d) => d.source === "notion" && !d.archived);
      return {
        docs,
        canEdit: user.role !== "viewer",
        move:
          user.role === "admin"
            ? {
                tasksImportedAt: s.notionImportedAt,
                docsFromNotion: notion.length,
                brokenLinks: notion.reduce((n, d) => n + (d.body.match(/\(not in this export\)|\]\(notion:/g)?.length ?? 0), 0),
                readOnlyAt: s.notionReadOnly?.at ?? null,
                readOnlyBy: nameOf(s.notionReadOnly?.by ?? null),
              }
            : null,
      };
    },

    async getDoc(id) {
      await viewer();
      const s = await load();
      const d = docsOf(s).find((x) => x.id === id && !x.archived);
      if (!d) throw new AccessError(404);
      return { ...rowsOf(s).find((r) => r.id === id)!, body: d.body };
    },

    async saveDoc(input) {
      const user = await viewer();
      if (user.role === "viewer") throw new AccessError(403);
      const s = await load();
      const all = docsOf(s);
      const title = input.title.trim();
      if (!title) throw new Error("Give the page a title.");
      if (input.parentId && !all.some((d) => d.id === input.parentId && !d.archived)) throw new Error("The parent page doesn't exist.");
      const at = iso();
      if (input.id) {
        const d = all.find((x) => x.id === input.id && !x.archived);
        if (!d) throw new AccessError(404);
        // A page can't be moved under itself or one of its own children.
        for (let p = input.parentId; p; p = all.find((x) => x.id === p)?.parentId ?? null) if (p === d.id) throw new Error("A page can't go inside itself.");
        Object.assign(d, { title, body: input.body, parentId: input.parentId, icon: input.icon ?? d.icon, updatedBy: user.id, updatedAt: at });
        audit(user.id, "doc.update", "doc", d.id, null, { title });
        await save();
        return d;
      }
      const d: Doc = { id: uid("doc"), title, icon: input.icon ?? null, parentId: input.parentId, body: input.body, source: "atlas", notionId: null, createdBy: user.id, updatedBy: user.id, createdAt: at, updatedAt: at, archived: false };
      all.push(d);
      audit(user.id, "doc.create", "doc", d.id, null, { title });
      await save();
      return d;
    },

    async archiveDoc(id) {
      const user = await viewer();
      requireAdmin(user);
      const s = await load();
      const all = docsOf(s);
      const d = all.find((x) => x.id === id && !x.archived);
      if (!d) throw new AccessError(404);
      d.archived = true;
      for (const c of all) if (c.parentId === id) c.parentId = d.parentId;
      audit(user.id, "doc.archive", "doc", id, { title: d.title }, null);
      await save();
    },

    async importNotionDocs(files) {
      const user = await viewer();
      requireAdmin(user);
      const s = await load();
      const all = docsOf(s);
      const { pages, skipped } = parseNotionExport(files);
      if (!pages.length) throw new Error("No Notion pages found. Pick the unzipped export folder (Markdown & CSV).");
      const at = iso();
      const idFor = new Map<string, string>();
      let created = 0;
      let updated = 0;
      // Pass 1: create or find every page, so links and parents can point at Atlas ids.
      for (const p of pages) {
        const existing = p.notionId ? all.find((d) => d.notionId === p.notionId) : undefined;
        if (existing) {
          idFor.set(p.key, existing.id);
          updated++;
        } else {
          const d: Doc = { id: uid("doc"), title: p.title, icon: null, parentId: null, body: "", source: "notion", notionId: p.notionId, createdBy: user.id, updatedBy: user.id, createdAt: at, updatedAt: at, archived: false };
          all.push(d);
          idFor.set(p.key, d.id);
          created++;
        }
      }
      // Pass 2: bodies with Atlas links, and the tree.
      for (const p of pages) {
        const d = all.find((x) => x.id === idFor.get(p.key))!;
        Object.assign(d, { title: p.title, body: linkTargets(p.body, (k) => idFor.get(k)), parentId: p.parentKey ? (idFor.get(p.parentKey) ?? null) : d.parentId, archived: false, updatedBy: user.id, updatedAt: at });
      }
      audit(user.id, "doc.import_notion", "doc", null, null, { created, updated, skipped: skipped.length });
      await save();
      return { created, updated, skipped };
    },

    async setNotionReadOnly(done) {
      const user = await viewer();
      requireAdmin(user);
      const s = await load();
      s.notionReadOnly = done ? { at: iso(), by: user.id } : null;
      audit(user.id, "notion.read_only", "doc", null, null, { done });
      await save();
    },
  };

  return { api };
};
