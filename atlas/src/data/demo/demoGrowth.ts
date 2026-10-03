import { MARKETS } from "@/config/marketing";
import { USD_PER_EUR } from "@/config/targets";
import type { Expense } from "../advisorTypes";
import type { Competitor, Experiment, GrowthApi, MarketingChannel, MarketRow } from "../growthTypes";
import type { Company, Lead, Source } from "../leadTypes";
import type { Meeting } from "../queueTypes";
import type { Deal } from "../salesTypes";
import { AccessError, type User } from "../types";

export interface GrowthStore {
  companies: Company[];
  leads: Lead[];
  sources: Source[];
  deals: Deal[];
  meetings: Meeting[];
  expenses: Expense[];
  marketingChannels?: MarketingChannel[];
  experiments?: Experiment[];
  competitors?: Competitor[];
}

interface Ctx<S extends GrowthStore> {
  load: () => Promise<S>;
  save: () => Promise<void>;
  viewer: () => Promise<User>;
  now: () => number;
  uid: (p: string) => string;
  audit: (userId: string | null, action: string, entity: string, entityId: string | null, before?: unknown, after?: unknown) => void;
}

const DAY = 86_400_000;
const READERS: User["role"][] = ["admin", "bdr", "closer", "viewer"];

export const createDemoGrowth = <S extends GrowthStore>(ctx: Ctx<S>) => {
  const { load, save, viewer, now, uid, audit } = ctx;
  const iso = (t = now()) => new Date(t).toISOString();
  const canRead = (u: User) => {
    if (!READERS.includes(u.role)) throw new AccessError(403);
  };
  const requireAdmin = (u: User) => {
    if (u.role !== "admin") throw new AccessError(403, "Founders edit marketing and competitors.");
  };

  /** Seeds from spec/backbone/10 (inbound channels, the first paid test) and 11 (the competitor map, checked 28 Sep). */
  const seed = (s: S) => {
    const at = iso();
    const ch = (name: string, build: string, owner: string, due: string, kpi: string, status: MarketingChannel["status"] = "not_started"): MarketingChannel => ({ id: uid("mc"), name, build, owner, due, kpi, status, note: "", updatedAt: at });
    s.marketingChannels = [
      ch("gllarix.com", "Clean up the claims; live demo number; missed-call calculator; booking link; pilot offer", "Rinor", "2026-10-11", "Visitor → booked meeting %", "in_progress"),
      ch("arcadian-labs.com", "Remove dropped services; 3 offers only; 3D showcase page; developer case study", "Rinor", "2026-10-11", "Developer inquiries per month", "in_progress"),
      ch("Trade + city landing pages", "One page per trade and city (\"AI receptionist for HVAC in Tampa\")", "Codex + Rinor", "2026-12-15", "Organic leads per month"),
      ch("Google Business Profiles", "One for each brand", "Co-founder", "2026-10-31", "Profile views, calls"),
      ch("Case studies", "Pilot #1 after 30 days: results page + a 90-second video", "Co-founder", "2026-12-15", "Used on 100% of calls"),
      ch("Referrals", "Ask on day 30; one month free or $250 credit per referred client that signs", "System", "2026-12-15", "Referred leads per month"),
      ch("Partners", "CGI studios and architects (3D); web agencies (white-label Gllarix)", "Co-founder", "2027-03-31", "Partner leads per quarter"),
      ch("Events", "Property expos: exhibitor lists for outreach; attend only with a meeting plan", "Co-founder", "2027-03-31", "Meetings per event"),
      ch("Diaspora networks", "Associations, groups, events (never surname-based lists)", "Co-founder", "Ongoing", "Meetings per month", "in_progress"),
      ch("Content (light)", "2 short LinkedIn posts a week: demo clips, pilot results, 3D walkthroughs", "Co-founder", "2026-11-01", "Replies, profile visits"),
    ];
    s.experiments = [
      {
        id: uid("ex"), name: "Google Search: \"answering service HVAC Tampa\"", channel: "Google Ads", budgetEur: 200, spentEur: 0, startDate: null, endDate: null,
        stopRule: "At least 2 qualified leads within the budget, or stop", goal: 2, qualifiedLeads: 0, status: "planned", note: "Not before the first case study.", createdAt: at,
      },
    ];
    const checked = "2026-09-28T12:00:00.000Z";
    const c = (brand: Competitor["brand"], name: string, type: string, priceSeen: string, howWeWin: string): Competitor => ({ id: uid("cp"), name, brand, type, priceSeen, howWeWin, source: null, lastCheckedAt: checked });
    s.competitors = [
      c("gllarix", "Goodcall", "Self-serve AI", "$79–249/mo, unlimited minutes", "Done for you: setup, booking, CRM, speed-to-lead, reviews; human onboarding"),
      c("gllarix", "Rosie", "Self-serve AI", "$49–299/mo (250–2,000 min)", "Same, plus multilingual and trades-specific flows"),
      c("gllarix", "Frontdesk", "Self-serve AI", "$99/mo + $0.25/min overage", "Same"),
      c("gllarix", "Smith.ai", "AI and human answering", "AI $150–500/mo; humans $300–2,100/mo", "Cheaper than humans; a bundle for local trades"),
      c("gllarix", "Podium", "Lead conversion + reviews", "$399–599/mo", "Voice-first; we answer the call"),
      c("gllarix", "NiceJob", "Reviews", "$75–125/mo", "Part of our bundle"),
      c("gllarix", "Voice AI agencies", "Done for you", "$500–1,000 setup, $500–1,500/mo", "Fixed packages, a live demo, pilot pricing, a trades focus"),
      c("arcadian", "Specialist 3D/CGI studios", "Custom", "Entry platforms $8,000–15,000; UK $15,000–50,000", "Lower entry price with a unit picker + landing page + Gllarix sales-office receptionist"),
      c("arcadian", "Matterport-style tour providers", "360° tours", "$350–1,000 per property", "We add the sales platform and lead capture"),
      c("arcadian", "Interactive real-estate SaaS (e.g. Treedis)", "Platform", "\"Contact sales\"", "Done for you and faster for small or mid developers"),
    ];
  };
  const ready = async () => {
    const s = await load();
    if (!s.marketingChannels || !s.experiments || !s.competitors) {
      seed(s);
      await save();
    }
    return s as S & Required<Pick<GrowthStore, "marketingChannels" | "experiments" | "competitors">>;
  };

  const kindOf = (s: S, companyId: string) => {
    const co = s.companies.find((c) => c.id === companyId);
    return s.sources.find((x) => x.id === co?.sourceId)?.kind ?? null;
  };
  const eurOf = (e: Expense) => (e.currency === "USD" ? e.amountMinor / USD_PER_EUR : e.amountMinor) / 100;

  const api: GrowthApi = {
    async marketingHome() {
      const user = await viewer();
      canRead(user);
      const s = await ready();
      const t = now();
      const leadById = new Map(s.leads.map((l) => [l.id, l]));
      const since = (d: number) => t - d * DAY;
      const weekStart = (() => {
        const d = new Date(t);
        const back = (d.getUTCDay() + 6) % 7;
        return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - back);
      })();
      const meetings90 = s.meetings.filter((m) => new Date(m.createdAt).getTime() >= since(90));
      const fromInbound = meetings90.filter((m) => {
        const lead = leadById.get(m.leadId);
        const k = lead ? kindOf(s, lead.companyId) : null;
        return k === "referral" || k === "inbound";
      }).length;
      const approved30 = s.meetings.filter((m) => m.approved === true && new Date(m.decidedAt ?? m.createdAt).getTime() >= since(30)).length;
      const monthKey = iso().slice(0, 7);
      const inboundLeadsMonth = s.companies.filter((c) => c.createdAt?.slice(0, 7) === monthKey && kindOf(s, c.id) === "inbound").length;
      // Sales and marketing cost in the last 30 days: monthly people/tools/data/marketing + one-off marketing spend.
      const recurring = s.expenses.filter((e) => e.recurring && ["people", "tools", "data", "marketing"].includes(e.category)).reduce((n, e) => n + eurOf(e), 0);
      const oneOffMarketing = s.expenses.filter((e) => !e.recurring && e.category === "marketing" && new Date(`${e.date}T12:00:00Z`).getTime() >= since(30)).reduce((n, e) => n + eurOf(e), 0);
      const marketingSpend30dEur = s.expenses.filter((e) => e.category === "marketing" && (e.recurring || new Date(`${e.date}T12:00:00Z`).getTime() >= since(30))).reduce((n, e) => n + eurOf(e), 0);
      return {
        channels: s.marketingChannels,
        experiments: [...s.experiments].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        kpis: {
          meetingsThisWeek: s.meetings.filter((m) => new Date(m.createdAt).getTime() >= weekStart).length,
          approved30d: approved30,
          inboundLeadsMonth,
          referralInboundShare: meetings90.length ? fromInbound / meetings90.length : null,
          costPerApprovedMeetingEur: approved30 ? (recurring + oneOffMarketing) / approved30 : null,
          marketingSpend30dEur,
        },
        canEdit: user.role === "admin",
      };
    },

    async updateChannel(id, patch) {
      const user = await viewer();
      requireAdmin(user);
      const s = await ready();
      const c = s.marketingChannels.find((x) => x.id === id);
      if (!c) throw new AccessError(404);
      Object.assign(c, patch, { updatedAt: iso() });
      audit(user.id, "marketing.channel_update", "marketing_channel", id, null, patch);
      await save();
    },

    async saveExperiment(input) {
      const user = await viewer();
      requireAdmin(user);
      const s = await ready();
      if (!input.name.trim()) throw new Error("Name the test.");
      const existing = input.id ? s.experiments.find((x) => x.id === input.id) : null;
      const next = { ...(existing ?? {}), ...input } as Experiment;
      if (!next.stopRule?.trim()) throw new Error("Every test needs a stop rule.");
      if (!(next.budgetEur > 0)) throw new Error("Set a budget.");
      if ((next.spentEur ?? 0) > next.budgetEur) throw new Error("Spend is over the budget: stop the test.");
      if (existing) {
        Object.assign(existing, next);
        audit(user.id, "marketing.test_update", "experiment", existing.id, null, { status: existing.status });
        await save();
        return existing;
      }
      const e: Experiment = { id: uid("ex"), name: input.name.trim(), channel: input.channel ?? "", budgetEur: next.budgetEur, spentEur: input.spentEur ?? 0, startDate: input.startDate ?? null, endDate: input.endDate ?? null, stopRule: next.stopRule.trim(), goal: input.goal ?? 1, qualifiedLeads: input.qualifiedLeads ?? 0, status: input.status ?? "planned", note: input.note ?? "", createdAt: iso() };
      s.experiments.push(e);
      audit(user.id, "marketing.test_create", "experiment", e.id);
      await save();
      return e;
    },

    async marketsHome() {
      const user = await viewer();
      canRead(user);
      const s = await ready();
      const t = now();
      const coById = new Map(s.companies.map((c) => [c.id, c]));
      const leadById = new Map(s.leads.map((l) => [l.id, l]));
      const inMarket = (m: (typeof MARKETS)[number], lead: Lead | undefined) => {
        const co = lead ? coById.get(lead.companyId) : undefined;
        return !!co && !!co.country && (m.countries as readonly string[]).includes(co.country) && (!m.listType || lead!.listType === m.listType);
      };
      const markets: MarketRow[] = MARKETS.map((m) => ({
        key: m.key, name: m.name, countries: [...m.countries], brand: m.brand, language: m.language, tz: m.tz, whoSells: m.whoSells, priceLevel: m.priceLevel, priority: m.priority,
        leads: s.leads.filter((l) => !l.excluded && inMarket(m, l)).length,
        openDeals: s.deals.filter((d) => d.stage !== "won" && d.stage !== "lost" && inMarket(m, leadById.get(d.leadId))).length,
        won: s.deals.filter((d) => d.stage === "won" && inMarket(m, leadById.get(d.leadId))).length,
        meetings30d: s.meetings.filter((x) => new Date(x.createdAt).getTime() >= t - 30 * DAY && inMarket(m, leadById.get(x.leadId))).length,
      }));
      return { markets, competitors: s.competitors, canEdit: user.role === "admin" };
    },

    async saveCompetitor(input) {
      const user = await viewer();
      requireAdmin(user);
      const s = await ready();
      if (!input.name.trim()) throw new Error("Name the competitor.");
      const existing = input.id ? s.competitors.find((x) => x.id === input.id) : null;
      if (existing) {
        Object.assign(existing, input, { name: input.name.trim(), lastCheckedAt: iso() });
        audit(user.id, "market.competitor_update", "competitor", existing.id);
        await save();
        return existing;
      }
      const c: Competitor = { id: uid("cp"), name: input.name.trim(), brand: input.brand, type: input.type ?? "", priceSeen: input.priceSeen ?? "", howWeWin: input.howWeWin ?? "", source: input.source ?? null, lastCheckedAt: iso() };
      s.competitors.push(c);
      audit(user.id, "market.competitor_add", "competitor", c.id);
      await save();
      return c;
    },

    async markCompetitorChecked(id) {
      const user = await viewer();
      requireAdmin(user);
      const s = await ready();
      const c = s.competitors.find((x) => x.id === id);
      if (!c) throw new AccessError(404);
      c.lastCheckedAt = iso();
      audit(user.id, "market.competitor_checked", "competitor", id);
      await save();
    },
  };

  return { api };
};
