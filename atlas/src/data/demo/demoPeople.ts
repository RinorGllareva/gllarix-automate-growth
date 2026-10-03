import { SCRIPTS } from "@/config/scripts";
import { countObjections, emptyBlocks, gateEvidence, programDay } from "@/services/people";
import { HIRING_STAGE_LABEL, HIRING_STAGES, SCORECARD, TRAINING_ASSETS, TRAINING_BLOCKS, type Candidate, type Opening, type PeopleApi, type Trainee } from "../peopleTypes";
import type { Meeting } from "../queueTypes";
import { AccessError, type Notification, type User } from "../types";

export interface PeopleStore {
  meetings: Meeting[];
  activities: { type: string; detail: string | null; at: string }[];
  openings?: Opening[];
  candidates?: Candidate[];
  trainees?: Trainee[];
  trainingAssets?: Record<string, boolean>;
}

interface Ctx<S extends PeopleStore> {
  load: () => Promise<S>;
  save: () => Promise<void>;
  viewer: () => Promise<User>;
  now: () => number;
  users: User[];
  uid: (p: string) => string;
  audit: (userId: string | null, action: string, entity: string, entityId: string | null, before?: unknown, after?: unknown) => void;
  notify: (n: Omit<Notification, "id" | "createdAt" | "readAt">) => void;
}

const DAY = 86_400_000;
const BDR_POST =
  "Remote Sales Rep (English): AI phone assistant for US businesses. Mon–Fri 08:00–16:00 Venezuela time. $500/month base + $15 per approved meeting + commission on every client; strong months $1,000+. You call US contractors, run short demos, close a fixed-price offer, and keep the CRM updated. Must have fluent spoken English, US phone-sales experience, and reliable power and internet. To apply: a 2-minute voice note in English selling something you use every day.";

export const createDemoPeople = <S extends PeopleStore>(ctx: Ctx<S>) => {
  const { load, save, viewer, now, users, uid, audit, notify } = ctx;
  const iso = (t = now()) => new Date(t).toISOString();
  const today = () => iso().slice(0, 10);
  const admins = () => users.filter((u) => u.role === "admin" && u.active);
  const requireAdmin = (u: User) => {
    if (u.role !== "admin") throw new AccessError(403, "Hiring is for the founders.");
  };

  /** Roles from spec/backbone/05 and a BDR pipeline mid-way through SOP 8. */
  const seed = (s: S) => {
    const t = now();
    const at = (days: number) => iso(t - days * DAY);
    const founder = users.find((u) => u.role === "admin" && u.id !== "u-rinor")?.id ?? null;
    const opening = (role: string, status: Opening["status"], when: string, pay: string, owns: string, post = ""): Opening => ({ id: uid("op"), role, status, when, pay, owns, post, ownerId: founder, createdAt: at(4) });
    const bdr = opening("BDR, full-cycle (backup)", "open", "Now: a bench of 2 runners-up", "$500 base + $15 per approved meeting + 10% commission on cash collected", "150 contacts/day, bookings, closing standard Gllarix offers", BDR_POST);
    s.openings = [
      bdr,
      opening("List builder, part-time", "draft", "When the queue is short of A/B leads (the AI co-founder recommends now)", "$150–200/month", "Building and cleaning 300–400 leads a week"),
      opening("Setter #1", "waiting", "Gate 1: 3 paying clients", "~$350 full-time or $150–200 part-time + $15 per approved meeting", "Booking meetings on the channel that produced the clients"),
      opening("Implementer, part-time", "waiting", "Gate 2: €2,000 MRR for 2 months", "To define; a go-live bonus per client", "Gllarix setups, testing, support"),
    ];
    const cand = (name: string, status: Candidate["status"], source: Candidate["source"], days: number, scores: Candidate["scores"], redFlags: Candidate["redFlags"] = [], notes = ""): Candidate => ({
      id: uid("cd"), openingId: bdr.id, name, email: null, source, status, scores, redFlags, notes, voiceNoteUrl: null, createdAt: at(days + 3), stageChangedAt: at(days),
    });
    s.candidates = [
      cand("Valentina R.", "trial", "Referral", 1, { english: 5, us_sales: 4, roleplay: 4, self_direction: 4, power: 5, honesty: 4 }, [], "Strong second roleplay. Trial week Mon–Fri."),
      cand("Andrés P.", "roleplay", "Venezuela groups", 2, { english: 4, us_sales: 4, roleplay: 3 }, [], "Good energy; rushed the discovery questions."),
      cand("Mariana G.", "screen", "LinkedIn", 1, { english: 4, power: 4 }),
      cand("Luis C.", "applied", "Venezuela groups", 0, {}, [], "Voice note received."),
      cand("José T.", "applied", "LinkedIn", 0, {}),
      cand("Carlos M.", "rejected", "Venezuela groups", 3, { english: 4, us_sales: 3, roleplay: 2 }, ["Defensive after feedback"], "Argued with every point of feedback."),
      cand("Daniela S.", "bench", "Referral", 2, { english: 4, us_sales: 3, roleplay: 4, self_direction: 3, power: 4, honesty: 5 }, [], "Runner-up: keep warm."),
    ];
    const diego = users.find((u) => u.id === "u-bdr");
    const blocks = emptyBlocks();
    blocks.company = { scores: [], passedAt: at(3), passedBy: founder, note: "Clear 60-second pitch for trades." };
    blocks.script = { scores: [6, 7, 8], passedAt: null, passedBy: null, note: "Work on \"we have a receptionist\"." };
    s.trainees = diego ? [{ id: uid("tr"), userId: diego.id, name: diego.name, role: "BDR, full-cycle", candidateId: null, startDate: iso(t - 4 * DAY).slice(0, 10), blocks, certifiedAt: null, createdAt: at(5) }] : [];
    s.trainingAssets = Object.fromEntries(TRAINING_ASSETS.map((a, i) => [a, i < 5]));
  };
  const ready = async () => {
    const s = await load();
    if (!s.openings || !s.candidates || !s.trainees || !s.trainingAssets) {
      seed(s);
      await save();
    }
    return s as S & Required<Pick<PeopleStore, "openings" | "candidates" | "trainees" | "trainingAssets">>;
  };

  const firstApproved = (s: S, userId: string | null) =>
    userId
      ? s.meetings
          .filter((m) => m.bookedBy === userId && m.approved === true)
          .map((m) => m.decidedAt ?? m.scheduledAt)
          .sort()[0] ?? null
      : null;

  const api: PeopleApi = {
    async hiringBoard() {
      const user = await viewer();
      requireAdmin(user);
      const s = await ready();
      return { openings: s.openings, candidates: s.candidates };
    },

    async saveOpening(input) {
      const user = await viewer();
      requireAdmin(user);
      const s = await ready();
      if (!input.role.trim()) throw new Error("Name the role.");
      const existing = input.id ? s.openings.find((o) => o.id === input.id) : null;
      if (existing) {
        Object.assign(existing, { ...input, role: input.role.trim() });
        audit(user.id, "hiring.opening_update", "opening", existing.id);
        await save();
        return existing;
      }
      const o: Opening = { id: uid("op"), role: input.role.trim(), status: input.status ?? "draft", when: input.when ?? "", pay: input.pay ?? "", owns: input.owns ?? "", post: input.post ?? "", ownerId: user.id, createdAt: iso() };
      s.openings.push(o);
      audit(user.id, "hiring.opening_create", "opening", o.id);
      await save();
      return o;
    },

    async addCandidate(input) {
      const user = await viewer();
      requireAdmin(user);
      const s = await ready();
      if (!input.name.trim()) throw new Error("Add the candidate's name.");
      if (!s.openings.some((o) => o.id === input.openingId)) throw new AccessError(404);
      const c: Candidate = {
        id: uid("cd"), openingId: input.openingId, name: input.name.trim(), email: input.email?.trim() || null, source: input.source, status: "applied", scores: {}, redFlags: [],
        notes: input.notes?.trim() ?? "", voiceNoteUrl: input.voiceNoteUrl?.trim() || null, createdAt: iso(), stageChangedAt: iso(),
      };
      s.candidates.push(c);
      audit(user.id, "hiring.candidate_add", "candidate", c.id);
      await save();
      return c;
    },

    async updateCandidate(id, patch) {
      const user = await viewer();
      requireAdmin(user);
      const s = await ready();
      const c = s.candidates.find((x) => x.id === id);
      if (!c) throw new AccessError(404);
      if (patch.scores) for (const [k, v] of Object.entries(patch.scores)) if (v !== undefined && (!Number.isInteger(v) || v < 1 || v > 5 || !SCORECARD.some((x) => x.key === k))) throw new Error("Scores are 1–5.");
      if (patch.status && patch.status !== c.status) {
        // Moving forward skips no step: SOP 8 says every hire goes through the screen, the roleplay and the paid trial.
        const from = HIRING_STAGES.indexOf(c.status as (typeof HIRING_STAGES)[number]);
        const to = HIRING_STAGES.indexOf(patch.status as (typeof HIRING_STAGES)[number]);
        if (from >= 0 && to > from + 1) throw new Error(`Do the "${HIRING_STAGE_LABEL[HIRING_STAGES[from + 1]]}" step first.`);
        c.stageChangedAt = iso();
      }
      const before = { status: c.status };
      Object.assign(c, patch, patch.scores ? { scores: { ...c.scores, ...patch.scores } } : {});
      audit(user.id, "hiring.candidate_update", "candidate", c.id, before, { status: c.status });
      await save();
      return c;
    },

    async startTraining(input) {
      const user = await viewer();
      requireAdmin(user);
      const s = await ready();
      const cand = input.candidateId ? s.candidates.find((c) => c.id === input.candidateId) : null;
      if (input.candidateId && !cand) throw new AccessError(404);
      const person = input.userId ? users.find((u) => u.id === input.userId) : null;
      const name = person?.name ?? cand?.name ?? input.name?.trim();
      if (!name) throw new Error("Pick who is starting.");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) throw new Error("Pick a start date.");
      if (s.trainees.some((t) => (input.userId && t.userId === input.userId) || (cand && t.candidateId === cand.id))) throw new Error(`${name} already has a training program.`);
      const t: Trainee = { id: uid("tr"), userId: person?.id ?? null, name, role: input.role, candidateId: cand?.id ?? null, startDate: input.startDate, blocks: emptyBlocks(), certifiedAt: null, createdAt: iso() };
      s.trainees.push(t);
      if (cand) {
        cand.status = "hired";
        cand.stageChangedAt = iso();
        const op = s.openings.find((o) => o.id === cand.openingId);
        if (op) op.status = "filled";
      }
      audit(user.id, "training.start", "trainee", t.id, null, { name, startDate: t.startDate });
      if (person) notify({ userId: person.id, type: "briefing", text: `Your 10-day training starts ${t.startDate}.`, href: "/training" });
      await save();
      return t;
    },

    async trainingView() {
      const user = await viewer();
      const s = await ready();
      const isAdmin = user.role === "admin";
      const mine = s.trainees.filter((t) => isAdmin || t.userId === user.id);
      return {
        trainees: mine.map((t) => {
          const firstApprovedMeetingAt = firstApproved(s, t.userId);
          const current = t.certifiedAt ? TRAINING_BLOCKS.length : Math.max(0, TRAINING_BLOCKS.findIndex((b) => !t.blocks[b.key].passedAt));
          return { ...t, firstApprovedMeetingAt, current, day: programDay(t.startDate, today()) };
        }),
        assets: s.trainingAssets,
        canEdit: isAdmin,
        objections: isAdmin
          ? countObjections(
              s.activities.filter((a) => a.type === "call" && now() - new Date(a.at).getTime() < 30 * DAY).map((a) => a.detail),
              Object.values(SCRIPTS),
            )
          : [],
      };
    },

    async addBlockScore(traineeId, block, score) {
      const user = await viewer();
      requireAdmin(user);
      const s = await ready();
      const t = s.trainees.find((x) => x.id === traineeId);
      if (!t) throw new AccessError(404);
      const b = TRAINING_BLOCKS.find((x) => x.key === block);
      if (!b || (b.kind !== "roleplays" && b.kind !== "quiz")) throw new Error("This block has no scores.");
      if (!Number.isFinite(score) || score < 0 || score > 10) throw new Error("Scores are 0–10.");
      t.blocks[block].scores.push(Math.round(score * 10) / 10);
      audit(user.id, "training.score", "trainee", t.id, null, { block, score });
      await save();
    },

    async setBlockPassed(traineeId, block, passed, note) {
      const user = await viewer();
      requireAdmin(user);
      const s = await ready();
      const t = s.trainees.find((x) => x.id === traineeId);
      if (!t) throw new AccessError(404);
      const p = t.blocks[block];
      if (passed) {
        const ev = gateEvidence(block, p, firstApproved(s, t.userId));
        if (!ev.met) throw new Error(`Gate not met yet: ${ev.text}.`);
        const idx = TRAINING_BLOCKS.findIndex((b) => b.key === block);
        const earlier = TRAINING_BLOCKS.slice(0, idx).find((b) => !t.blocks[b.key].passedAt);
        if (earlier) throw new Error(`Pass "${earlier.title}" first.`);
      }
      Object.assign(p, { passedAt: passed ? iso() : null, passedBy: passed ? user.id : null, note: note ?? p.note });
      t.certifiedAt = TRAINING_BLOCKS.every((b) => t.blocks[b.key].passedAt) ? iso() : null;
      audit(user.id, passed ? "training.gate_pass" : "training.gate_reopen", "trainee", t.id, null, { block });
      if (t.certifiedAt) for (const a of admins().filter((a) => a.id !== user.id)) notify({ userId: a.id, type: "briefing", text: `${t.name} is certified to close alone.`, href: "/training" });
      if (t.certifiedAt && t.userId) notify({ userId: t.userId, type: "briefing", text: "You're certified to close alone. Well done.", href: "/training" });
      await save();
    },

    async setTrainingAsset(asset, isReady) {
      const user = await viewer();
      requireAdmin(user);
      const s = await ready();
      if (!TRAINING_ASSETS.includes(asset as (typeof TRAINING_ASSETS)[number])) throw new AccessError(404);
      s.trainingAssets[asset] = isReady;
      await save();
    },
  };

  return { api };
};
