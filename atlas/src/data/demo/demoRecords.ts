import type { Activity, Company, Contact, Lead } from "../leadTypes";
import { MAX_DEMO_FILE_BYTES, type FileEntity, type RecordFile, type RecordsApi } from "../recordTypes";
import { AccessError, type User } from "../types";

export interface RecordsStore {
  leads: Lead[];
  companies: Company[];
  contacts: Contact[];
  clients: { id: string; dealId: string }[];
  files?: RecordFile[];
}

interface Ctx<S extends RecordsStore> {
  load: () => Promise<S>;
  save: () => Promise<void>;
  viewer: () => Promise<User>;
  now: () => number;
  users: User[];
  uid: (p: string) => string;
  audit: (userId: string | null, action: string, entity: string, entityId: string | null, before?: unknown, after?: unknown) => void;
  /** Same access as the record's own page. */
  canSee: (s: S, user: User, entity: FileEntity, id: string) => boolean;
  activity: (s: S, a: Omit<Activity, "id" | "at">) => void;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TAG = /^[a-z0-9][a-z0-9 -]{0,23}$/;

export const createDemoRecords = <S extends RecordsStore>(ctx: Ctx<S>) => {
  const { load, save, viewer, now, users, uid, audit, canSee, activity } = ctx;
  const iso = () => new Date(now()).toISOString();
  const filesOf = (s: S) => (s.files ??= []);
  const nameOf = (id: string | null) => (id ? (users.find((u) => u.id === id)?.name ?? null) : null);
  const editLead = async (leadId: string) => {
    const user = await viewer();
    if (user.role === "viewer" || user.role === "implementer") throw new AccessError(403);
    const s = await load();
    const lead = s.leads.find((l) => l.id === leadId);
    if (!lead) throw new AccessError(404);
    if (!canSee(s, user, "lead", leadId)) throw new AccessError(403);
    if (lead.erasedAt) throw new Error("This lead's personal data was erased.");
    return { user, s, lead };
  };

  /** Writes a file Atlas produced (signed contract, report) without a person uploading it. */
  const attachSystemFile = (s: S, entity: FileEntity, entityId: string, f: Pick<RecordFile, "name" | "size" | "mime" | "url" | "kind">, by: string | null) => {
    const file: RecordFile = { id: uid("fl"), entity, entityId, ...f, uploadedBy: by, uploadedByName: nameOf(by), createdAt: iso() };
    filesOf(s).push(file);
    return file;
  };

  const api: RecordsApi = {
    async listFiles(entity, id) {
      const user = await viewer();
      const s = await load();
      if (!canSee(s, user, entity, id)) throw new AccessError(403);
      // A client also shows its deal's signed contracts.
      const dealId = entity === "client" ? s.clients.find((c) => c.id === id)?.dealId : null;
      return filesOf(s)
        .filter((f) => (f.entity === entity && f.entityId === id) || (dealId && f.entity === "deal" && f.entityId === dealId && f.kind === "contract"))
        .map((f) => ({ ...f, uploadedByName: nameOf(f.uploadedBy) }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async uploadFile(entity, id, input) {
      const user = await viewer();
      if (user.role === "viewer") throw new AccessError(403);
      const s = await load();
      if (!canSee(s, user, entity, id)) throw new AccessError(403);
      if (!input.name.trim()) throw new Error("The file needs a name.");
      if (input.size > MAX_DEMO_FILE_BYTES) throw new Error("Files up to 2 MB in demo mode. Larger files arrive with Supabase Storage.");
      const file = attachSystemFile(s, entity, id, { name: input.name.trim(), size: input.size, mime: input.mime || "application/octet-stream", url: input.url, kind: "upload" }, user.id);
      if (entity === "lead") activity(s, { leadId: id, userId: user.id, type: "note", title: `File added · ${file.name}`, detail: null, disposition: null, durationS: null });
      audit(user.id, "file.upload", entity, id, null, { name: file.name, size: file.size });
      await save();
      return file;
    },

    async deleteFile(id) {
      const user = await viewer();
      const s = await load();
      const f = filesOf(s).find((x) => x.id === id);
      if (!f) throw new AccessError(404);
      if (f.kind === "contract") throw new Error("Signed contracts are kept for the record and can't be deleted.");
      if (user.role !== "admin" && f.uploadedBy !== user.id) throw new AccessError(403, "Only the person who uploaded it, or an admin, can delete a file.");
      s.files = filesOf(s).filter((x) => x.id !== id);
      audit(user.id, "file.delete", f.entity, f.entityId, { name: f.name }, null);
      await save();
    },

    async saveContact(leadId, input) {
      const { user, s, lead } = await editLead(leadId);
      const firstName = input.firstName.trim();
      if (!firstName) throw new Error("A contact needs at least a first name.");
      const email = input.email?.trim().toLowerCase() || null;
      if (email && !EMAIL.test(email)) throw new Error("That email doesn't look right.");
      const phone = input.phone?.trim() || null;
      const fields = { firstName, lastName: input.lastName.trim(), title: input.title?.trim() || null, email, phone, isDecisionMaker: input.isDecisionMaker };
      if (input.id) {
        const c = s.contacts.find((x) => x.id === input.id && x.companyId === lead.companyId);
        if (!c) throw new AccessError(404);
        const before = { ...c };
        // A changed email or phone needs verifying again.
        Object.assign(c, fields, {
          emailStatus: email !== before.email ? "unknown" : c.emailStatus,
          phoneVerified: phone !== before.phone ? false : c.phoneVerified,
          phoneInvalid: phone !== before.phone ? false : c.phoneInvalid,
        });
        activity(s, { leadId, userId: user.id, type: "note", title: `Contact updated · ${firstName} ${fields.lastName}`.trim(), detail: null, disposition: null, durationS: null });
        audit(user.id, "contact.update", "contact", c.id, before, c);
      } else {
        const c: Contact = {
          id: uid("ct"), companyId: lead.companyId, ...fields, emailStatus: "unknown", phoneType: "unknown", phoneVerified: false, phoneInvalid: false, linkedinUrl: null,
        } as Contact;
        s.contacts.push(c);
        if (!lead.primaryContactId) lead.primaryContactId = c.id;
        activity(s, { leadId, userId: user.id, type: "note", title: `Contact added · ${firstName} ${fields.lastName}`.trim(), detail: fields.title, disposition: null, durationS: null });
        audit(user.id, "contact.create", "contact", c.id, null, c);
      }
      lead.updatedAt = iso();
      await save();
    },

    async setLeadTags(leadId, tags) {
      const { user, lead } = await editLead(leadId);
      const clean = [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];
      const bad = clean.find((t) => !TAG.test(t));
      if (bad) throw new Error(`"${bad}" isn't a valid tag: letters, numbers, spaces and dashes, up to 24 characters.`);
      if (clean.length > 8) throw new Error("Up to 8 tags per lead.");
      const before = lead.tags ?? [];
      lead.tags = clean;
      lead.updatedAt = iso();
      audit(user.id, "lead.tags", "lead", leadId, before, clean);
      await save();
    },
  };

  return { api, attachSystemFile };
};
