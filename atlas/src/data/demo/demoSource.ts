import type { AuditEntry, DataSource, Notification, SignInResult, User } from "../types";
import { createDemoLeads } from "./demoLeads";
import { SEED_NOTIFICATIONS, SEED_USERS } from "./seed";

const STORE_KEY = "atlas-demo-v1";
const SESSION_KEY = "atlas-demo-session";

export const IDLE_TIMEOUT_MS = 12 * 60 * 60 * 1000;
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

interface Store {
  notifications: Notification[];
  audit: AuditEntry[];
  /** Failed sign-in timestamps per lower-cased email. */
  failures: Record<string, number[]>;
}

interface Session {
  userId: string;
  lastSeen: number;
}

const read = <T,>(storage: Storage | undefined, key: string): T | null => {
  try {
    const raw = storage?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

const write = (storage: Storage | undefined, key: string, value: unknown) => {
  try {
    if (value === null) storage?.removeItem(key);
    else storage?.setItem(key, JSON.stringify(value));
  } catch {
    // storage blocked: demo mode keeps working in memory for this page load
  }
};

const uid = () => Math.random().toString(36).slice(2, 10);

interface DemoOptions {
  password: string;
  storage?: Storage;
  now?: () => number;
  /** Keep leads in IndexedDB between visits (default true). */
  persistLeads?: boolean;
  /** AI provider for the planner (default: the deterministic fake). */
  aiProvider?: import("@/services/aiProvider").AIProvider;
}

/** A browser-only backend over seeded fake data, so Atlas runs on localhost with no database. */
export const createDemoSource = ({ password, storage = globalThis.localStorage, now = Date.now, persistLeads = true, aiProvider }: DemoOptions): DataSource => {
  const persistent = (() => {
    try {
      storage?.setItem("atlas-probe", "1");
      storage?.removeItem("atlas-probe");
      return Boolean(storage);
    } catch {
      return false;
    }
  })();
  const fresh = (): Store => ({ notifications: SEED_NOTIFICATIONS, audit: [], failures: {} });
  let memory: Store = read<Store>(storage, STORE_KEY) ?? fresh();
  let session = read<Session>(storage, SESSION_KEY);
  // Re-read storage on every call so other tabs (and sign-outs elsewhere) are seen.
  const sync = () => {
    if (!persistent) return;
    memory = read<Store>(storage, STORE_KEY) ?? fresh();
    session = read<Session>(storage, SESSION_KEY);
  };

  const save = () => write(storage, STORE_KEY, memory);
  const setSession = (next: Session | null) => {
    session = next;
    write(storage, SESSION_KEY, next);
  };

  const record = (userId: string | null, action: string, entity: string, entityId: string | null, before: unknown = null, after: unknown = null) => {
    sync();
    memory.audit = [
      { id: uid(), userId, action, entity, entityId, before, after, at: new Date(now()).toISOString() },
      ...memory.audit,
    ].slice(0, 1000);
    save();
  };
  const audit = (userId: string | null, action: string, after: unknown = null) => record(userId, action, "session", userId, null, after);

  const notify = (n: Omit<Notification, "id" | "createdAt" | "readAt">) => {
    sync();
    memory.notifications = [{ ...n, id: `n-${uid()}`, createdAt: new Date(now()).toISOString(), readAt: null }, ...memory.notifications];
    save();
  };

  const recentFailures = (email: string) =>
    (memory.failures[email] ?? []).filter((t) => now() - t < LOCKOUT_WINDOW_MS);

  const auth = {
    kind: "demo" as const,

    async signInWithPassword(rawEmail: string, pass: string): Promise<SignInResult> {
      sync();
      const email = rawEmail.trim().toLowerCase();
      if (recentFailures(email).length >= MAX_FAILED_ATTEMPTS) return { ok: false, error: "rate_limited" };

      const user = SEED_USERS.find((u) => u.email === email);
      if (!user || pass !== password) {
        memory.failures[email] = [...recentFailures(email), now()];
        save();
        audit(null, "auth.sign_in_failed", { email });
        return { ok: false, error: "invalid" };
      }
      if (!user.active) return { ok: false, error: "paused" };

      delete memory.failures[email];
      setSession({ userId: user.id, lastSeen: now() });
      audit(user.id, "auth.sign_in");
      return { ok: true, user };
    },

    async sendMagicLink(rawEmail: string) {
      sync();
      // Demo mode never sends email; the UI shows the same "check your inbox" message either way.
      audit(null, "auth.magic_link_requested", { email: rawEmail.trim().toLowerCase() });
    },

    async signOut() {
      sync();
      if (session) audit(session.userId, "auth.sign_out");
      setSession(null);
    },

    async currentUser(): Promise<User | null> {
      sync();
      if (!session) return null;
      if (now() - session.lastSeen > IDLE_TIMEOUT_MS) {
        audit(session.userId, "auth.session_expired");
        setSession(null);
        return null;
      }
      const user = SEED_USERS.find((u) => u.id === session!.userId && u.active) ?? null;
      if (!user) setSession(null);
      else setSession({ ...session, lastSeen: now() });
      return user;
    },

    async listUsers() {
      sync();
      return SEED_USERS;
    },

    async listNotifications(userId: string) {
      sync();
      return memory.notifications
        .filter((n) => n.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async markNotificationRead(id: string) {
      sync();
      memory.notifications = memory.notifications.map((n) =>
        n.id === id && !n.readAt ? { ...n, readAt: new Date(now()).toISOString() } : n,
      );
      save();
    },

    async markAllNotificationsRead(userId: string) {
      sync();
      const at = new Date(now()).toISOString();
      memory.notifications = memory.notifications.map((n) =>
        n.userId === userId && !n.readAt ? { ...n, readAt: at } : n,
      );
      save();
    },

    async listAudit(limit = 50) {
      sync();
      return memory.audit.slice(0, limit);
    },
  };

  return {
    ...auth,
    ...createDemoLeads({ currentUser: auth.currentUser, users: SEED_USERS, audit: record, notify, now, persist: persistLeads, aiProvider }),
  };
};

/** Test helper: wipe demo state. */
export const resetDemoStore = (storage: Storage | undefined = globalThis.localStorage) => {
  write(storage, STORE_KEY, null);
  write(storage, SESSION_KEY, null);
};
