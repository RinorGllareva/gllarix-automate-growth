import type { Expense } from "../advisorTypes";
import {
  FIELD_ENTITIES,
  type AtlasEvent,
  type CustomValues,
  type EntityImportJob,
  type EntityImportResult,
  type FieldDef,
  type FieldEntity,
  type FieldValue,
  type FoundationsApi,
  type ImportRowStatus,
  type PageView,
  type Webhook,
  type WebhookDelivery,
} from "../foundationTypes";
import type { Candidate, Opening } from "../peopleTypes";
import type { Task, TaskList, TaskPriority } from "../taskTypes";
import { AccessError, type User } from "../types";

export interface FoundationsStore {
  expenses: Expense[];
  tasks: Task[];
  taskLists: TaskList[];
  candidates?: Candidate[];
  openings?: Opening[];
  fieldDefs?: FieldDef[];
  /** entity → record id → field key → value. */
  customValues?: Partial<Record<FieldEntity, Record<string, CustomValues>>>;
  pageViews?: PageView[];
  webhooks?: Webhook[];
  entityImports?: EntityImportJob[];
  /** "entity|source name" → column mapping. */
  importMappings?: Record<string, Record<string, string | null>>;
}

interface Ctx<S extends FoundationsStore> {
  load: () => Promise<S>;
  save: () => Promise<void>;
  viewer: () => Promise<User>;
  now: () => number;
  users: User[];
  uid: (p: string) => string;
  audit: (userId: string | null, action: string, entity: string, entityId: string | null, before?: unknown, after?: unknown) => void;
  readEvents: () => AtlasEvent[];
  /** Lead, deal, client and ticket visibility (the same rule as files). */
  canSeeRecord: (s: S, user: User, entity: "lead" | "deal" | "client" | "ticket", id: string) => boolean;
  /** Tasks, meetings, docs: can the viewer open it (by asking the record's own read function). */
  canOpen: (entity: string, id: string) => Promise<boolean>;
  createTask: (input: { listId: string; title: string; dueAt?: string | null; estimateMinutes?: number | null; priority?: TaskPriority; descriptionMd?: string }) => Promise<Task>;
  addCandidate: (input: { openingId: string; name: string; email?: string | null; source: Candidate["source"]; voiceNoteUrl?: string | null; notes?: string }) => Promise<Candidate>;
}

const RECORD_ENTITIES = new Set(["lead", "deal", "client", "ticket"]);
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** "2026-10-03", "03.10.2026", "03/10/2026" (day first, as in European bank exports) → "2026-10-03". */
export const parseImportDate = (raw: string): string | null => {
  const v = raw.trim();
  if (DATE.test(v)) return v;
  const m = v.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  // Excel stores dates as days since 1899-12-30 (an .xlsx cell reads "46298").
  if (/^\d{5}(\.\d+)?$/.test(v) && Number(v) > 20_000 && Number(v) < 80_000) return new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(v)) * 86_400_000).toISOString().slice(0, 10);
  if (/^\d+(\.\d+)?$/.test(v)) return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
};

/** "1,234.50", "1234,50", "€ 99", "-12" → major units. */
export const parseImportAmount = (raw: string): number | null => {
  let v = raw.replace(/[^\d.,-]/g, "");
  if (!v) return null;
  if (/,\d{1,2}$/.test(v) && !/\.\d{1,2}$/.test(v)) v = v.replace(/\./g, "").replace(",", ".");
  else v = v.replace(/,/g, "");
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const yes = (raw: string | undefined) => /^(y|yes|true|1|x|monthly|recurring)$/i.test((raw ?? "").trim());
const slug = (label: string) =>
  label
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40) || "field";

const EXPENSE_CATEGORIES: Expense["category"][] = ["people", "tools", "data", "usage", "freelance", "marketing", "admin", "fees"];
const CANDIDATE_SOURCES: Candidate["source"][] = ["Venezuela groups", "LinkedIn", "Referral", "Other"];
const PRIORITIES: TaskPriority[] = ["low", "normal", "high", "urgent"];

const hmacHex = async (secret: string, body: string) => {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
};

export const eventMatches = (patterns: string[], type: string) => patterns.some((p) => (p.endsWith("*") ? type.startsWith(p.slice(0, -1)) : p === type));

export const createDemoFoundations = <S extends FoundationsStore>(ctx: Ctx<S>) => {
  const { load, save, viewer, now, users, uid, audit, readEvents } = ctx;
  const iso = () => new Date(now()).toISOString();
  const admin = async () => {
    const user = await viewer();
    if (user.role !== "admin") throw new AccessError(403, "Founders manage this in Settings.");
    return user;
  };

  const canSeeEvent = async (s: S, user: User, e: AtlasEvent) => {
    if (user.role === "admin") return true;
    if (e.actor === user.id) return true;
    if (!e.entityId) return false;
    if (RECORD_ENTITIES.has(e.entity)) return ctx.canSeeRecord(s, user, e.entity as "lead" | "deal" | "client" | "ticket", e.entityId);
    return ctx.canOpen(e.entity, e.entityId);
  };

  const fieldsOf = (s: S, entity?: FieldEntity) =>
    [...(s.fieldDefs ?? [])].filter((f) => !entity || f.entity === entity).sort((a, b) => a.entity.localeCompare(b.entity) || a.order - b.order);

  const canSeeFieldRecord = async (s: S, user: User, entity: FieldEntity, id: string) =>
    entity === "candidate" ? user.role === "admin" && !!s.candidates?.some((c) => c.id === id) : ctx.canSeeRecord(s, user, entity, id);

  /** Checks a value against its field's type; returns the value to store. */
  const coerce = (f: FieldDef, value: FieldValue): FieldValue => {
    if (value === null || value === "" || (Array.isArray(value) && !value.length)) return null;
    switch (f.type) {
      case "number":
      case "money": {
        const n = typeof value === "number" ? value : parseImportAmount(String(value));
        if (n === null) throw new Error(`${f.label}: use a number.`);
        return f.type === "money" && typeof value !== "number" ? Math.round(n * 100) : n;
      }
      case "date": {
        const d = parseImportDate(String(value));
        if (!d) throw new Error(`${f.label}: use a date.`);
        return d;
      }
      case "checkbox":
        return typeof value === "boolean" ? value : yes(String(value));
      case "select": {
        const v = String(value).trim();
        const hit = f.options.find((o) => o.toLowerCase() === v.toLowerCase());
        if (!hit) throw new Error(`${f.label}: pick one of ${f.options.join(", ")}.`);
        return hit;
      }
      case "multi_select": {
        const list = (Array.isArray(value) ? value : String(value).split(/[,;]/)).map((x) => x.trim()).filter(Boolean);
        const out = list.map((v) => f.options.find((o) => o.toLowerCase() === v.toLowerCase()));
        if (out.some((x) => !x)) throw new Error(`${f.label}: pick from ${f.options.join(", ")}.`);
        return [...new Set(out as string[])];
      }
      case "person": {
        const v = String(value).trim();
        const u = users.find((x) => x.id === v || x.email === v.toLowerCase() || x.name.toLowerCase() === v.toLowerCase());
        if (!u) throw new Error(`${f.label}: pick someone on the team.`);
        return u.id;
      }
      case "link": {
        const v = String(value).trim();
        if (!/^https?:\/\/\S+$/.test(v)) throw new Error(`${f.label}: use a full link (https://…).`);
        return v;
      }
      default:
        return String(value).trim().slice(0, 2000);
    }
  };

  const writeValue = (s: S, entity: FieldEntity, id: string, key: string, value: FieldValue) => {
    const byEntity = ((s.customValues ??= {})[entity] ??= {});
    const row = (byEntity[id] ??= {});
    if (value === null) delete row[key];
    else row[key] = value;
  };

  const api: FoundationsApi = {
    // ------------------------------------------------------------ events and webhooks
    async listEvents(q = {}) {
      const user = await viewer();
      const s = await load();
      const out: AtlasEvent[] = [];
      for (const e of readEvents()) {
        if (q.type && !eventMatches([q.type], e.type)) continue;
        if (q.entity && e.entity !== q.entity) continue;
        if (q.entityId && e.entityId !== q.entityId) continue;
        if (q.actor && e.actor !== q.actor) continue;
        if (q.since && e.at <= q.since) continue;
        if (!(await canSeeEvent(s, user, e))) continue;
        out.push(e);
        if (out.length >= (q.limit ?? 200)) break;
      }
      return out;
    },

    async recordEvents(entity, id) {
      const user = await viewer();
      const s = await load();
      const probe: AtlasEvent = { id: "", type: "", entity, entityId: id, actor: null, actorName: null, payload: null, at: "" };
      if (user.role !== "admin" && !(await canSeeEvent(s, user, probe))) throw new AccessError(403);
      return readEvents().filter((e) => e.entity === entity && e.entityId === id);
    },

    async listWebhooks() {
      await admin();
      const s = await load();
      const webhooks = s.webhooks ?? [];
      const deliveries: WebhookDelivery[] = [];
      // Demo mode never calls the URL: it shows the signed request it would send, newest first.
      for (const e of readEvents().slice(0, 300)) {
        for (const w of webhooks) {
          if (!w.active || e.at < w.createdAt || !eventMatches(w.events, e.type)) continue;
          const body = JSON.stringify({ id: e.id, type: e.type, entity: e.entity, entityId: e.entityId, at: e.at, data: e.payload ?? null });
          deliveries.push({ id: `${w.id}:${e.id}`, webhookId: w.id, eventId: e.id, eventType: e.type, at: e.at, status: "simulated", signature: `sha256=${await hmacHex(w.secret, body)}`, body });
          if (deliveries.length >= 50) break;
        }
        if (deliveries.length >= 50) break;
      }
      // The secret is shown once, when the webhook is made; lists only show its last characters.
      return { webhooks: webhooks.map((w) => ({ ...w, secret: `whsec_…${w.secret.slice(-4)}` })), deliveries };
    },

    async saveWebhook(input) {
      const user = await admin();
      const s = await load();
      const url = input.url.trim();
      if (!/^https:\/\/[^\s/]+\.[^\s]+$/.test(url)) throw new Error("Use an https:// address.");
      const events = [...new Set(input.events.map((e) => e.trim()).filter(Boolean))];
      if (!events.length) throw new Error("Pick at least one event.");
      const list = (s.webhooks ??= []);
      let w = input.id ? list.find((x) => x.id === input.id) : undefined;
      if (input.id && !w) throw new AccessError(404);
      if (w) Object.assign(w, { url, events, active: input.active });
      else {
        const bytes = crypto.getRandomValues(new Uint8Array(24));
        w = { id: uid("wh"), url, events, active: input.active, secret: `whsec_${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`, createdBy: user.id, createdAt: iso() };
        list.push(w);
      }
      audit(user.id, "webhook.save", "webhook", w.id, null, { url, events, active: input.active });
      await save();
      return w;
    },

    async deleteWebhook(id) {
      const user = await admin();
      const s = await load();
      const w = (s.webhooks ?? []).find((x) => x.id === id);
      if (!w) throw new AccessError(404);
      s.webhooks = (s.webhooks ?? []).filter((x) => x.id !== id);
      audit(user.id, "webhook.delete", "webhook", id, { url: w.url }, null);
      await save();
    },

    // ------------------------------------------------------------ custom fields
    async listFieldDefs(entity) {
      await viewer();
      return fieldsOf(await load(), entity);
    },

    async saveFieldDef(input) {
      const user = await admin();
      const s = await load();
      if (!FIELD_ENTITIES.includes(input.entity)) throw new Error("Pick what the field belongs to.");
      const label = input.label.trim();
      if (!label) throw new Error("Name the field.");
      const options = [...new Set(input.options.map((o) => o.trim()).filter(Boolean))];
      if ((input.type === "select" || input.type === "multi_select") && options.length < 2) throw new Error("Add at least two options.");
      const defs = (s.fieldDefs ??= []);
      if (defs.some((f) => f.entity === input.entity && f.label.toLowerCase() === label.toLowerCase() && f.id !== input.id)) throw new Error(`There's already a "${label}" field.`);
      let f = input.id ? defs.find((x) => x.id === input.id) : undefined;
      if (input.id && !f) throw new AccessError(404);
      if (f) {
        if (f.type !== input.type) throw new Error("A field's type can't change once it has values: add a new field instead.");
        if (f.entity !== input.entity) throw new Error("A field can't move to another record type.");
        Object.assign(f, { label, options, currency: input.currency, inTable: input.inTable });
      } else {
        let key = slug(input.key || label);
        for (let n = 2; defs.some((x) => x.entity === input.entity && x.key === key); n++) key = `${slug(label)}_${n}`;
        f = { id: uid("fd"), entity: input.entity, key, label, type: input.type, options, currency: input.currency, inTable: input.inTable, order: defs.filter((x) => x.entity === input.entity).length, createdAt: iso() };
        defs.push(f);
      }
      audit(user.id, "field.save", "field", f.id, null, { entity: f.entity, key: f.key, type: f.type });
      await save();
      return f;
    },

    async deleteFieldDef(id) {
      const user = await admin();
      const s = await load();
      const f = (s.fieldDefs ?? []).find((x) => x.id === id);
      if (!f) throw new AccessError(404);
      s.fieldDefs = (s.fieldDefs ?? []).filter((x) => x.id !== id);
      for (const row of Object.values(s.customValues?.[f.entity] ?? {})) delete row[f.key];
      audit(user.id, "field.delete", "field", id, { entity: f.entity, key: f.key }, null);
      await save();
    },

    async moveFieldDef(id, direction) {
      await admin();
      const s = await load();
      const f = (s.fieldDefs ?? []).find((x) => x.id === id);
      if (!f) throw new AccessError(404);
      const sibs = fieldsOf(s, f.entity);
      const i = sibs.indexOf(f);
      const j = direction === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= sibs.length) return;
      [sibs[i], sibs[j]] = [sibs[j], sibs[i]];
      sibs.forEach((x, k) => (x.order = k));
      await save();
    },

    async customValues(entity, ids) {
      const user = await viewer();
      const s = await load();
      const out: Record<string, CustomValues> = {};
      for (const id of ids) if (s.customValues?.[entity]?.[id] && (await canSeeFieldRecord(s, user, entity, id))) out[id] = { ...s.customValues[entity]![id] };
      return out;
    },

    async setCustomValue(entity, id, key, value) {
      const user = await viewer();
      if (user.role === "viewer") throw new AccessError(403);
      const s = await load();
      if (!(await canSeeFieldRecord(s, user, entity, id))) throw new AccessError(403);
      const f = (s.fieldDefs ?? []).find((x) => x.entity === entity && x.key === key);
      if (!f) throw new AccessError(404);
      const v = coerce(f, value);
      const before = s.customValues?.[entity]?.[id]?.[key] ?? null;
      writeValue(s, entity, id, key, v);
      audit(user.id, `${entity}.field_update`, entity, id, { [key]: before }, { [key]: v });
      await save();
    },

    // ------------------------------------------------------------ saved views
    async listPageViews(page) {
      const user = await viewer();
      const s = await load();
      return (s.pageViews ?? []).filter((v) => v.page === page && (v.ownerId === user.id || v.shared)).sort((a, b) => Number(b.ownerId === user.id) - Number(a.ownerId === user.id) || a.name.localeCompare(b.name));
    },

    async savePageView(input) {
      const user = await viewer();
      const s = await load();
      const name = input.name.trim();
      if (!name) throw new Error("Name the view.");
      if (input.shared && user.role !== "admin") throw new AccessError(403, "Founders share views with the team.");
      const list = (s.pageViews ??= []);
      const existing = list.find((v) => v.page === input.page && v.ownerId === user.id && v.name.toLowerCase() === name.toLowerCase());
      const row: PageView = { id: existing?.id ?? uid("pv"), page: input.page, name, ownerId: user.id, ownerName: user.name, shared: !!input.shared, state: JSON.parse(JSON.stringify(input.state)), createdAt: existing?.createdAt ?? iso() };
      if (existing) Object.assign(existing, row);
      else list.push(row);
      await save();
      return row;
    },

    async deletePageView(id) {
      const user = await viewer();
      const s = await load();
      const v = (s.pageViews ?? []).find((x) => x.id === id);
      if (!v) throw new AccessError(404);
      if (v.ownerId !== user.id && user.role !== "admin") throw new AccessError(403, "Only the owner or a founder deletes a view.");
      s.pageViews = (s.pageViews ?? []).filter((x) => x.id !== id);
      await save();
    },

    // ------------------------------------------------------------ Import Center
    async runEntityImport(input) {
      const user = await admin();
      const s = await load();
      if (!input.rows.length) throw new Error("The file has no rows.");
      if (input.rows.length > 5000) throw new Error("Up to 5,000 rows per import. Split the file.");
      const rows: EntityImportResult["rows"] = [];
      const plan: { row: number; make: () => Promise<string>; custom: Record<string, string> }[] = [];
      const seen = new Set<string>();
      const customOf = (r: Record<string, string>) => Object.fromEntries(Object.entries(r).filter(([k, v]) => k.startsWith("custom:") && v?.trim()).map(([k, v]) => [k.slice(7), v]));
      const mark = (row: number, status: ImportRowStatus, label: string, reason: string | null) => rows.push({ row, status, label, reason });

      if (input.entity === "expense") {
        const currency = input.target === "USD" ? "USD" : "EUR";
        input.rows.forEach((r, i) => {
          const n = i + 1;
          const date = parseImportDate(r.date ?? "");
          const vendor = (r.vendor ?? "").trim();
          const amount = parseImportAmount(r.amount ?? "");
          const label = vendor || `Row ${n}`;
          if (!date || !vendor || amount === null) return mark(n, "error", label, "Needs a date, a vendor and an amount.");
          const amountMinor = Math.round(Math.abs(amount) * 100);
          if (!amountMinor) return mark(n, "error", label, "The amount is zero.");
          const cur = /usd|\$/i.test(r.currency ?? "") ? "USD" : /eur|€/i.test(r.currency ?? "") ? "EUR" : currency;
          const key = `${date}|${vendor.toLowerCase()}|${amountMinor}`;
          if (seen.has(key) || s.expenses.some((e) => `${e.date}|${e.vendor.toLowerCase()}|${e.amountMinor}` === key)) return mark(n, "duplicate", label, "Same day, vendor and amount already in Finance.");
          seen.add(key);
          const catRaw = (r.category ?? "").trim().toLowerCase();
          const category = EXPENSE_CATEGORIES.find((c) => c === catRaw) ?? "admin";
          mark(n, "create", `${label} · ${(amountMinor / 100).toFixed(2)} ${cur}`, null);
          plan.push({
            row: n,
            custom: {},
            make: async () => {
              const e: Expense = { id: uid("ex"), date, vendor, category, amountMinor, currency: cur, recurring: yes(r.recurring), source: "bank_export", note: r.note?.trim() || null };
              s.expenses.push(e);
              return e.id;
            },
          });
        });
      } else if (input.entity === "candidate") {
        const opening = (s.openings ?? []).find((o) => o.id === input.target);
        if (!opening) throw new Error("Pick the opening the candidates applied to.");
        const defs = fieldsOf(s, "candidate");
        input.rows.forEach((r, i) => {
          const n = i + 1;
          const name = (r.name ?? "").trim();
          const email = (r.email ?? "").trim().toLowerCase();
          if (!name) return mark(n, "error", `Row ${n}`, "Needs a name.");
          if (email && !EMAIL.test(email)) return mark(n, "error", name, "That email doesn't look right.");
          const custom = customOf(r);
          for (const [k, v] of Object.entries(custom)) {
            const f = defs.find((d) => d.key === k);
            if (!f) return mark(n, "error", name, `Unknown field "${k}".`);
            try {
              coerce(f, v);
            } catch (e) {
              return mark(n, "error", name, (e as Error).message);
            }
          }
          const key = email || `${name.toLowerCase()}|${opening.id}`;
          const dup = seen.has(key) || (s.candidates ?? []).some((c) => (email && c.email?.toLowerCase() === email) || (c.openingId === opening.id && c.name.toLowerCase() === name.toLowerCase()));
          if (dup) return mark(n, "duplicate", name, "Already a candidate (same email, or same name for this opening).");
          seen.add(key);
          const srcRaw = (r.source ?? "").trim().toLowerCase();
          const source = CANDIDATE_SOURCES.find((x) => x.toLowerCase() === srcRaw || (srcRaw && x.toLowerCase().startsWith(srcRaw))) ?? "Other";
          mark(n, "create", name, null);
          plan.push({ row: n, custom, make: async () => (await ctx.addCandidate({ openingId: opening.id, name, email: email || null, source, notes: r.notes ?? "", voiceNoteUrl: r.voiceNoteUrl?.trim() || null })).id });
        });
      } else {
        const list = s.taskLists.find((l) => l.id === input.target);
        if (!list) throw new Error("Pick the list the tasks go into.");
        input.rows.forEach((r, i) => {
          const n = i + 1;
          const title = (r.title ?? "").trim();
          if (!title) return mark(n, "error", `Row ${n}`, "Needs a title.");
          const due = r.due?.trim() ? parseImportDate(r.due) : null;
          if (r.due?.trim() && !due) return mark(n, "error", title, "The due date isn't a date.");
          const hours = r.estimate?.trim() ? parseImportAmount(r.estimate) : null;
          const key = title.toLowerCase();
          if (seen.has(key) || s.tasks.some((t) => !t.deletedAt && t.listId === list.id && t.title.toLowerCase() === key && t.status !== "done" && t.status !== "cancelled")) return mark(n, "duplicate", title, "An open task with this title is already in the list.");
          seen.add(key);
          const pr = (r.priority ?? "").trim().toLowerCase();
          const priority = PRIORITIES.find((p) => p === pr) ?? "normal";
          mark(n, "create", title, null);
          plan.push({ row: n, custom: {}, make: async () => (await ctx.createTask({ listId: list.id, title, dueAt: due, estimateMinutes: hours ? Math.round(hours * 60) : null, priority, descriptionMd: r.description ?? "" })).id });
        });
      }

      if (input.dryRun) return { job: null, rows };
      const createdIds: string[] = [];
      for (const p of plan) {
        try {
          const id = await p.make();
          createdIds.push(id);
          if (input.entity === "candidate") {
            const defs = fieldsOf(s, "candidate");
            for (const [k, v] of Object.entries(p.custom)) writeValue(s, "candidate", id, k, coerce(defs.find((d) => d.key === k)!, v));
          }
        } catch (e) {
          const r = rows.find((x) => x.row === p.row)!;
          Object.assign(r, { status: "error" as const, reason: (e as Error).message });
        }
      }
      const job: EntityImportJob = {
        id: uid("ij"),
        entity: input.entity,
        fileName: input.fileName,
        sourceName: input.sourceName.trim() || input.fileName,
        createdBy: user.id,
        createdAt: iso(),
        rows: input.rows.length,
        created: createdIds.length,
        duplicates: rows.filter((r) => r.status === "duplicate").length,
        failed: rows.filter((r) => r.status === "error").length,
        createdIds,
        undoneAt: null,
      };
      (s.entityImports ??= []).unshift(job);
      audit(user.id, `${input.entity}.import`, "import", job.id, null, { file: job.fileName, created: job.created, duplicates: job.duplicates, failed: job.failed });
      await save();
      return { job, rows };
    },

    async listEntityImports() {
      await admin();
      return (await load()).entityImports ?? [];
    },

    async undoEntityImport(id) {
      const user = await admin();
      const s = await load();
      const job = (s.entityImports ?? []).find((j) => j.id === id);
      if (!job) throw new AccessError(404);
      if (job.undoneAt) throw new Error("This import was already undone.");
      const ids = new Set(job.createdIds);
      let removed = 0;
      if (job.entity === "expense") {
        const before = s.expenses.length;
        s.expenses = s.expenses.filter((e) => !ids.has(e.id));
        removed = before - s.expenses.length;
      } else if (job.entity === "candidate") {
        const before = (s.candidates ?? []).length;
        s.candidates = (s.candidates ?? []).filter((c) => !ids.has(c.id));
        removed = before - s.candidates.length;
        for (const cid of ids) delete s.customValues?.candidate?.[cid];
      } else {
        const before = s.tasks.length;
        s.tasks = s.tasks.filter((t) => !ids.has(t.id) && !(t.parentId && ids.has(t.parentId)));
        removed = before - s.tasks.length;
      }
      job.undoneAt = iso();
      audit(user.id, `${job.entity}.import_undo`, "import", job.id, null, { removed });
      await save();
      return { removed };
    },

    async getImportMapping(entity, sourceName) {
      await admin();
      return (await load()).importMappings?.[`${entity}|${sourceName.trim().toLowerCase()}`] ?? null;
    },

    async saveImportMapping(entity, sourceName, mapping) {
      await admin();
      const s = await load();
      (s.importMappings ??= {})[`${entity}|${sourceName.trim().toLowerCase()}`] = mapping;
      await save();
    },
  };

  return { api };
};
