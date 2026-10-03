import { COMM_MIN, COMM_MONTHS, COMM_PCT } from "@/config/priceBook";
import { MEETING_BONUS_MINOR } from "@/config/targets";
import type { CommissionRules, CompanyProfile, PlanScenario, SettingsApi } from "../settingsTypes";
import { AccessError, ROLE_LABEL, type Notification, type Role, type User } from "../types";

export const DEFAULT_COMMISSION_RULES: CommissionRules = {
  pct: COMM_PCT,
  setupMin: COMM_MIN,
  months: COMM_MONTHS,
  meetingBonusMinor: MEETING_BONUS_MINOR,
};

export const EMPTY_PROFILE: CompanyProfile = {
  entities: {
    gllarix: { legalName: "", address: "", registration: "", vatId: "" },
    arcadian: { legalName: "", address: "", registration: "", vatId: "" },
  },
  governingLaw: "",
  signatory: "",
};

export interface SettingsStore {
  companyProfile?: CompanyProfile;
  commissionRules?: CommissionRules;
  planScenarios?: PlanScenario[];
  leads: { ownerId: string | null; stage: string }[];
  deals: { ownerId: string | null; stage: string }[];
  tasks: { assigneeIds: string[]; status: string; deletedAt: string | null }[];
  inboundRequests?: { assignedTo: string | null; status: string }[];
}

interface Ctx<S extends SettingsStore> {
  load: () => Promise<S>;
  save: () => Promise<void>;
  viewer: () => Promise<User>;
  /** The shared user list every module reads; changed in place. */
  users: User[];
  /** Keep the changed list (demo auth store), so invited people can sign in after a reload. */
  saveUsers: (list: User[]) => void;
  audit: (userId: string | null, action: string, entity: string, entityId: string | null, before?: unknown, after?: unknown) => void;
  notify: (n: Omit<Notification, "id" | "createdAt" | "readAt">) => void;
}

const QUEUE_ROLES: Role[] = ["bdr", "closer"];
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const createDemoSettings = <S extends SettingsStore>(ctx: Ctx<S>) => {
  const { load, save, viewer, users, audit, notify } = ctx;

  const persistUsers = (_s: S) => ctx.saveUsers(users.map((u) => ({ ...u })));
  const admin = async () => {
    const user = await viewer();
    if (user.role !== "admin") throw new AccessError(403, "Founders manage settings.");
    return user;
  };
  const activeAdmins = () => users.filter((u) => u.role === "admin" && u.active);
  const rulesOf = (s: S) => s.commissionRules ?? DEFAULT_COMMISSION_RULES;

  const api: SettingsApi = {
    async inviteUser(input) {
      const me = await admin();
      const s = await load();
      const email = input.email.trim().toLowerCase();
      if (!input.name.trim()) throw new Error("Give them a name.");
      if (!EMAIL.test(email)) throw new Error("That email doesn't look right.");
      if (users.some((u) => u.email === email)) throw new Error("Someone already uses that email.");
      if (input.dailyCapacity !== null && !(input.dailyCapacity > 0 && input.dailyCapacity <= 300)) throw new Error("Daily queue: 1–300 calls, or none.");
      const user: User = {
        id: `u-${email.split("@")[0].replace(/[^a-z0-9]/g, "")}-${users.length + 1}`,
        name: input.name.trim(),
        email,
        role: input.role,
        timezone: input.timezone || "Europe/Zurich",
        dailyCapacity: QUEUE_ROLES.includes(input.role) ? (input.dailyCapacity ?? 150) : input.dailyCapacity,
        active: true,
      };
      users.push(user);
      persistUsers(s);
      audit(me.id, "user.invite", "user", user.id, null, {
        email,
        role: user.role,
      });
      await save();
      return user;
    },

    async updateUser(id, patch) {
      const me = await admin();
      const s = await load();
      const u = users.find((x) => x.id === id);
      if (!u) throw new AccessError(404);
      if (patch.name !== undefined && !patch.name.trim()) throw new Error("A user needs a name.");
      if (patch.role && patch.role !== "admin" && u.role === "admin" && activeAdmins().length <= 1) throw new Error("Keep at least one founder with admin rights.");
      if (patch.dailyCapacity !== undefined && patch.dailyCapacity !== null && !(patch.dailyCapacity > 0 && patch.dailyCapacity <= 300)) throw new Error("Daily queue: 1–300 calls, or none.");
      const before = {
        name: u.name,
        role: u.role,
        timezone: u.timezone,
        dailyCapacity: u.dailyCapacity,
      };
      Object.assign(u, {
        ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
        ...(patch.role ? { role: patch.role } : {}),
        ...(patch.timezone ? { timezone: patch.timezone } : {}),
        ...(patch.dailyCapacity !== undefined ? { dailyCapacity: patch.dailyCapacity } : {}),
      });
      persistUsers(s);
      audit(me.id, "user.update", "user", id, before, patch);
      if (patch.role && patch.role !== before.role)
        notify({
          userId: id,
          type: "task",
          text: `Your role is now ${ROLE_LABEL[patch.role]}`,
          href: "/today",
        });
      await save();
    },

    async deactivateUser(id, handOverTo) {
      const me = await admin();
      const s = await load();
      const u = users.find((x) => x.id === id);
      if (!u) throw new AccessError(404);
      if (u.id === me.id) throw new Error("You can't pause your own account.");
      if (u.role === "admin" && activeAdmins().length <= 1) throw new Error("Keep at least one founder with admin rights.");
      const to = handOverTo ? users.find((x) => x.id === handOverTo && x.active && x.id !== id) : null;
      if (handOverTo && !to) throw new Error("Hand over to someone active.");
      let moved = 0;
      if (to) {
        for (const l of s.leads) if (l.ownerId === id && l.stage !== "won" && l.stage !== "lost") ((l.ownerId = to.id), moved++);
        for (const d of s.deals) if (d.ownerId === id && d.stage !== "won" && d.stage !== "lost") ((d.ownerId = to.id), moved++);
        for (const t of s.tasks)
          if (!t.deletedAt && t.status !== "done" && t.status !== "cancelled" && t.assigneeIds.includes(id)) {
            t.assigneeIds = [...new Set(t.assigneeIds.map((a) => (a === id ? to.id : a)))];
            moved++;
          }
        for (const r of s.inboundRequests ?? []) if (r.assignedTo === id && (r.status === "new" || r.status === "contacted")) ((r.assignedTo = to.id), moved++);
        if (moved)
          notify({
            userId: to.id,
            type: "task",
            text: `${me.name.split(" ")[0]} handed you ${u.name.split(" ")[0]}'s open work (${moved} items)`,
            href: "/today",
          });
      }
      u.active = false;
      persistUsers(s);
      audit(me.id, "user.deactivate", "user", id, { active: true }, { active: false, handOverTo: to?.id ?? null, moved });
      await save();
      return { moved };
    },

    async reactivateUser(id) {
      const me = await admin();
      const s = await load();
      const u = users.find((x) => x.id === id);
      if (!u) throw new AccessError(404);
      u.active = true;
      persistUsers(s);
      audit(me.id, "user.reactivate", "user", id, { active: false }, { active: true });
      await save();
    },

    async getCompanyProfile() {
      await viewer();
      const s = await load();
      return s.companyProfile ?? EMPTY_PROFILE;
    },

    async saveCompanyProfile(p) {
      const me = await admin();
      const s = await load();
      const clean = (x: string) => x.trim();
      const before = s.companyProfile ?? null;
      s.companyProfile = {
        entities: {
          gllarix: {
            legalName: clean(p.entities.gllarix.legalName),
            address: clean(p.entities.gllarix.address),
            registration: clean(p.entities.gllarix.registration),
            vatId: clean(p.entities.gllarix.vatId),
          },
          arcadian: {
            legalName: clean(p.entities.arcadian.legalName),
            address: clean(p.entities.arcadian.address),
            registration: clean(p.entities.arcadian.registration),
            vatId: clean(p.entities.arcadian.vatId),
          },
        },
        governingLaw: clean(p.governingLaw),
        signatory: clean(p.signatory),
      };
      audit(me.id, "settings.company_profile", "settings", null, before, s.companyProfile);
      await save();
    },

    async getCommissionRules() {
      await viewer();
      return rulesOf(await load());
    },

    async saveCommissionRules(r) {
      const me = await admin();
      const s = await load();
      if (!(r.pct >= 0 && r.pct <= 0.5)) throw new Error("Commission share: 0–50%.");
      if (!(r.setupMin >= 0)) throw new Error("Minimum: zero or more.");
      if (!(Number.isInteger(r.months) && r.months >= 0 && r.months <= 24)) throw new Error("Recurring months: 0–24.");
      if (!(r.meetingBonusMinor >= 0)) throw new Error("Meeting bonus: zero or more.");
      const before = rulesOf(s);
      s.commissionRules = {
        pct: r.pct,
        setupMin: r.setupMin,
        months: r.months,
        meetingBonusMinor: Math.round(r.meetingBonusMinor),
      };
      audit(me.id, "settings.commission_rules", "settings", null, before, s.commissionRules);
      await save();
    },

    async listPlanScenarios() {
      await admin();
      const s = await load();
      return [...(s.planScenarios ?? [])].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
    },

    async savePlanScenario(name, settings) {
      const me = await admin();
      const s = await load();
      if (!name.trim()) throw new Error("Name the scenario.");
      if (!/^\d{4}-\d{2}$/.test(settings.start)) throw new Error("Pick a start month.");
      if (settings.hires.some((h) => !h.label.trim() || h.fromMonth < 0 || h.fromMonth > 11 || !(h.monthlyUsd >= 0))) throw new Error("Each hire needs a name, a start month in the plan and a monthly cost.");
      const list = (s.planScenarios ??= []);
      const existing = list.find((x) => x.name.toLowerCase() === name.trim().toLowerCase());
      const row: PlanScenario = { id: existing?.id ?? `ps-${Date.now().toString(36)}-${list.length}`, name: name.trim(), settings: JSON.parse(JSON.stringify(settings)), savedBy: me.id, savedAt: new Date().toISOString() };
      if (existing) Object.assign(existing, row);
      else list.push(row);
      audit(me.id, "plan.scenario_save", "plan_scenario", row.id, null, { name: row.name });
      await save();
      return row;
    },

    async deletePlanScenario(id) {
      const me = await admin();
      const s = await load();
      const before = (s.planScenarios ?? []).find((x) => x.id === id);
      if (!before) throw new AccessError(404);
      s.planScenarios = (s.planScenarios ?? []).filter((x) => x.id !== id);
      audit(me.id, "plan.scenario_delete", "plan_scenario", id, { name: before.name }, null);
      await save();
    },
  };

  return { api, rulesOf };
};
