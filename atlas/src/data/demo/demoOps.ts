import { RHYTHM, SOP_SEED } from "@/config/operations";
import type { Company } from "../leadTypes";
import type { OpsApi, Sop } from "../opsTypes";
import type { Client, Payment } from "../quoteTypes";
import type { Deal } from "../salesTypes";
import { AccessError, type User } from "../types";

export interface OpsStore {
  clients: Client[];
  deals: Deal[];
  companies: Company[];
  payments: Payment[];
  sops?: Sop[];
  opsChecks?: Record<string, { at: string; by: string }>;
}

interface Ctx<S extends OpsStore> {
  load: () => Promise<S>;
  save: () => Promise<void>;
  viewer: () => Promise<User>;
  now: () => number;
  uid: (p: string) => string;
  audit: (userId: string | null, action: string, entity: string, entityId: string | null, before?: unknown, after?: unknown) => void;
}

const DAY = 86_400_000;

export const createDemoOps = <S extends OpsStore>(ctx: Ctx<S>) => {
  const { load, save, viewer, now, uid, audit } = ctx;
  const iso = () => new Date(now()).toISOString();
  const internal = (u: User) => {
    if (u.role === "viewer") throw new AccessError(403);
  };

  const ready = async () => {
    const s = await load();
    if (!s.sops || !s.opsChecks) {
      const at = iso();
      // SOP 8 (hiring) was due 2 Oct and is being written alongside the Hiring page.
      s.sops = SOP_SEED.map((x) => ({ id: uid("sop"), ...x, status: x.num === 8 ? "draft" : "not_started", link: null, updatedAt: at }));
      s.opsChecks = {};
      await save();
    }
    return s as S & Required<Pick<OpsStore, "sops" | "opsChecks">>;
  };

  /** Days since the deposit (payment, else the won date) for clients still onboarding. */
  const capacity = (s: S) => {
    const t = now();
    const onboarding = s.clients
      .filter((c) => c.status === "onboarding")
      .map((c) => {
        const deal = s.deals.find((d) => d.id === c.dealId);
        const dep = s.payments.find((p) => p.dealId === c.dealId && p.type === "setup_deposit" && p.status === "paid")?.paidAt ?? deal?.wonAt ?? c.createdAt;
        return { clientId: c.id, companyName: s.companies.find((x) => x.id === c.companyId)?.name ?? "—", waitingDays: Math.max(0, Math.floor((t - new Date(dep).getTime()) / DAY)) };
      })
      .sort((a, b) => b.waitingDays - a.waitingDays);
    const live = s.clients.filter((c) => c.liveAt && t - new Date(c.liveAt).getTime() <= 90 * DAY);
    const days = live
      .map((c) => {
        const deal = s.deals.find((d) => d.id === c.dealId);
        const dep = s.payments.find((p) => p.dealId === c.dealId && p.type === "setup_deposit" && p.status === "paid")?.paidAt ?? deal?.wonAt;
        return dep ? (new Date(c.liveAt!).getTime() - new Date(dep).getTime()) / DAY : null;
      })
      .filter((d): d is number => d !== null);
    const reasons: string[] = [];
    if (onboarding.length > 2) reasons.push(`${onboarding.length} setups queued (more than 2)`);
    const late = onboarding.filter((o) => o.waitingDays > 7);
    if (late.length) reasons.push(`${late.length} setup${late.length > 1 ? "s" : ""} waiting over 7 days`);
    return { onboarding, avgDepositToLiveDays: days.length ? days.reduce((a, b) => a + b, 0) / days.length : null, hireImplementer: reasons.length > 0, reasons };
  };

  const api: Omit<OpsApi, "automationLedger"> = {
    async opsHome() {
      const user = await viewer();
      internal(user);
      const s = await ready();
      return { sops: [...s.sops].sort((a, b) => a.num - b.num), checks: s.opsChecks, capacity: capacity(s), canEdit: user.role === "admin" };
    },

    async updateSop(id, patch) {
      const user = await viewer();
      if (user.role !== "admin") throw new AccessError(403, "Founders own the SOPs.");
      const s = await ready();
      const sop = s.sops.find((x) => x.id === id);
      if (!sop) throw new AccessError(404);
      if (patch.link && !/^https?:\/\/|^\//.test(patch.link)) throw new Error("Use a full link (https://…) or an Atlas path.");
      if (patch.status === "done" && !(patch.link ?? sop.link)) throw new Error("Add the link to the written SOP before marking it done.");
      Object.assign(sop, patch, { updatedAt: iso() });
      audit(user.id, "ops.sop_update", "sop", id, null, patch);
      await save();
    },

    async setOpsCheck(key, done) {
      const user = await viewer();
      internal(user);
      const [item] = key.split(":");
      const r = RHYTHM.find((x) => x.key === item);
      if (!r || r.auto) throw new AccessError(404);
      const s = await ready();
      if (done) s.opsChecks[key] = { at: iso(), by: user.id };
      else delete s.opsChecks[key];
      await save();
    },
  };

  return { api };
};
