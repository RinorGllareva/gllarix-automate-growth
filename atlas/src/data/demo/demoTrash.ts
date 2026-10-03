import { TRASH_DAYS, UNDO_MINUTES, type TrashApi, type TrashEntity, type TrashItem } from "../trashTypes";
import { AccessError, type User } from "../types";

/** A trashed record keeps a full copy and the collection it came from, so restoring puts it back exactly. */
export interface Stored extends TrashItem {
  collection: string;
  data: unknown;
}

export interface TrashStore {
  trash?: Stored[];
}

interface Ctx<S extends TrashStore> {
  load: () => Promise<S>;
  save: () => Promise<void>;
  viewer: () => Promise<User>;
  now: () => number;
  users: User[];
  uid: (p: string) => string;
  audit: (userId: string | null, action: string, entity: string, entityId: string | null, before?: unknown, after?: unknown) => void;
}

const DAY = 86_400_000;
type Rec = { id: string };

export const createDemoTrash = <S extends TrashStore>(ctx: Ctx<S>) => {
  const { load, save, viewer, now, users, uid, audit } = ctx;
  const iso = () => new Date(now()).toISOString();
  const nameOf = (id: string | null) => (id ? (users.find((u) => u.id === id)?.name ?? null) : null);
  const trashOf = (s: S) => {
    s.trash ??= [];
    // Older than 30 days: purged.
    s.trash = s.trash.filter((t) => now() - new Date(t.deletedAt).getTime() < TRASH_DAYS * DAY);
    return s.trash;
  };
  const coll = (s: S, collection: string) => {
    const store = s as unknown as Record<string, Rec[] | undefined>;
    return (store[collection] ??= []);
  };

  /**
   * Move a record out of its collection into the trash. Call inside a mutation (the caller saves). Returns the
   * trash id for the Undo button.
   */
  const trashRecord = (s: S, collection: string, entityId: string, entity: TrashEntity, label: string, by: string | null) => {
    const list = coll(s, collection);
    const i = list.findIndex((r) => r.id === entityId);
    if (i < 0) throw new AccessError(404);
    const [data] = list.splice(i, 1);
    const item: Stored = { id: uid("tr"), entity, entityId, label, deletedAt: iso(), deletedBy: by, collection, data };
    trashOf(s).push(item);
    audit(by, `${entity}.delete`, entity, entityId, data, null);
    return item.id;
  };

  const api: TrashApi = {
    async listTrash() {
      const user = await viewer();
      const s = await load();
      return trashOf(s)
        .filter((t) => user.role === "admin" || t.deletedBy === user.id)
        .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt))
        .map(({ collection: _c, data: _d, ...t }) => ({ ...t, deletedByName: nameOf(t.deletedBy), daysLeft: Math.max(0, TRASH_DAYS - Math.floor((now() - new Date(t.deletedAt).getTime()) / DAY)) }));
    },

    async restoreFromTrash(id) {
      const user = await viewer();
      const s = await load();
      const all = trashOf(s);
      const t = all.find((x) => x.id === id);
      if (!t) throw new AccessError(404, "It's no longer in the trash.");
      const ownUndo = t.deletedBy === user.id && now() - new Date(t.deletedAt).getTime() < UNDO_MINUTES * 60_000;
      if (user.role !== "admin" && !ownUndo) throw new AccessError(403, "Founders restore from the trash.");
      const list = coll(s, t.collection);
      if (list.some((r) => r.id === t.entityId)) throw new Error("A record with the same id is back already.");
      list.push(t.data as Rec);
      s.trash = all.filter((x) => x.id !== id);
      audit(user.id, `${t.entity}.restore`, t.entity, t.entityId, null, t.data);
      await save();
    },

    async purgeTrash(id) {
      const user = await viewer();
      if (user.role !== "admin") throw new AccessError(403, "Only founders delete for good.");
      const s = await load();
      const t = trashOf(s).find((x) => x.id === id);
      if (!t) throw new AccessError(404);
      s.trash = trashOf(s).filter((x) => x.id !== id);
      audit(user.id, `${t.entity}.purge`, t.entity, t.entityId, { label: t.label }, null);
      await save();
    },
  };

  return { api, trashRecord };
};
