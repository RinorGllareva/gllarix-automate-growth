/** People › Hiring and Training (spec/backbone/05: SOP 8 hiring, the scorecard, the 10-day training with gates). */

export const HIRING_STAGES = ["applied", "screen", "roleplay", "trial", "offer", "hired"] as const;
export type HiringStage = (typeof HIRING_STAGES)[number];
export type CandidateStatus = HiringStage | "bench" | "rejected";

export const HIRING_STAGE_LABEL: Record<CandidateStatus, string> = {
  applied: "Applied",
  screen: "15-min screen",
  roleplay: "Paid roleplay",
  trial: "Paid trial week",
  offer: "Offer",
  hired: "Hired",
  bench: "Bench",
  rejected: "Not a fit",
};

/** What happens at each step (SOP 8). */
export const HIRING_STAGE_HELP: Record<HiringStage, string> = {
  applied: "2-minute English voice note",
  screen: "15-minute call",
  roleplay: "Cold call, feedback, a second try",
  trial: "~$100–125 paid trial week",
  offer: "Contractor agreement, 30-day trial",
  hired: "Starts training",
};

export const SCORECARD = [
  { key: "english", label: "Spoken English, C1 on the phone", weight: 25 },
  { key: "us_sales", label: "US phone-sales experience", weight: 20 },
  { key: "roleplay", label: "Roleplay and coachability", weight: 20 },
  { key: "self_direction", label: "Self-direction", weight: 15 },
  { key: "power", label: "Backup power and internet", weight: 10 },
  { key: "honesty", label: "Honesty and written clarity", weight: 10 },
] as const;
export type ScoreKey = (typeof SCORECARD)[number]["key"];

export const RED_FLAGS = ["Inflated claims", "Defensive after feedback", "No backup power", "Late to the screen"] as const;
export type RedFlag = (typeof RED_FLAGS)[number];

export interface Opening {
  id: string;
  role: string;
  status: "open" | "draft" | "waiting" | "filled" | "closed";
  /** When to hire (the stage gate). */
  when: string;
  pay: string;
  owns: string;
  /** Job post text (copy-paste). */
  post: string;
  ownerId: string | null;
  createdAt: string;
}

export interface Candidate {
  id: string;
  openingId: string;
  name: string;
  email: string | null;
  source: "Venezuela groups" | "LinkedIn" | "Referral" | "Other";
  status: CandidateStatus;
  /** 1–5 per criterion; null = not scored yet. */
  scores: Partial<Record<ScoreKey, number>>;
  redFlags: RedFlag[];
  notes: string;
  /** Link to the voice note (e.g. a WhatsApp or Drive link). */
  voiceNoteUrl: string | null;
  createdAt: string;
  stageChangedAt: string;
}

/** The 10-day program (spec/backbone/05 Training). */
export const TRAINING_BLOCKS = [
  { key: "company", days: "Days 1–2", title: "Company, brands and customers", content: "Both brands, what we don't sell, the ICPs (trades; developers for the US), pain maths", gate: "Explains the offer in 60 seconds", kind: "check" },
  { key: "script", days: "Days 3–4", title: "Script and objections", content: "Script, discovery questions, top objections: \"AI sounds robotic\", \"I answer my own phone\", \"send me info\", \"too expensive\", \"we have a receptionist\"", gate: "5 roleplays scored 7/10 or more", kind: "roleplays", need: 5 },
  { key: "compliance", days: "Day 5", title: "Compliance", content: "AI disclosure, recording notice, manual dialing, opt-out, honest claims", gate: "Passes the quiz (8/10 or more)", kind: "quiz" },
  { key: "live", days: "Days 6–7", title: "Half days live", content: "Recorded calls, feedback in the next overlap", gate: "First approved meeting", kind: "meeting" },
  { key: "closing", days: "Days 8–9", title: "Closing", content: "Discovery → live demo line → fixed price → Stripe link → onboarding handoff; the 3D pitch for US developers", gate: "3 closing roleplays scored 7/10 or more", kind: "roleplays", need: 3 },
  { key: "certify", days: "Day 10", title: "Full live day", content: "A full day on the phone, alone", gate: "Certified to close alone", kind: "check" },
] as const;
export type BlockKey = (typeof TRAINING_BLOCKS)[number]["key"];

export const TRAINING_ASSETS = [
  "Offer sheet",
  "Demo line",
  "Script with objections",
  "CRM access",
  "500+ leads in the queue",
  "Stripe link and terms",
  "Intake form",
  "Loom demo",
] as const;

export interface BlockProgress {
  /** Roleplay or quiz scores (out of 10), newest last. */
  scores: number[];
  passedAt: string | null;
  passedBy: string | null;
  note: string;
}

export interface Trainee {
  id: string;
  /** Atlas user being trained (null for a hire who has no account yet). */
  userId: string | null;
  name: string;
  role: string;
  candidateId: string | null;
  startDate: string;
  blocks: Record<BlockKey, BlockProgress>;
  certifiedAt: string | null;
  createdAt: string;
}

export interface TrainingView {
  trainees: (Trainee & {
    /** Approved meeting found for this person (live block gate), if any. */
    firstApprovedMeetingAt: string | null;
    /** Index of the current block (0–5), 6 when certified. */
    current: number;
    /** Day number in the program (1–10), from the start date and working days. */
    day: number;
  })[];
  assets: Record<string, boolean>;
  canEdit: boolean;
  /** Objections BDRs tapped on calls in the last 30 days (founders only), most heard first. */
  objections: ObjectionCount[];
}

export interface ObjectionCount {
  label: string;
  count: number;
  /** An approved answer exists in the script. */
  answered: boolean;
}

export interface PeopleApi {
  /** Admins: openings with their candidates. */
  hiringBoard(): Promise<{ openings: Opening[]; candidates: Candidate[] }>;
  saveOpening(input: Partial<Opening> & { role: string }): Promise<Opening>;
  addCandidate(input: { openingId: string; name: string; email?: string | null; source: Candidate["source"]; voiceNoteUrl?: string | null; notes?: string }): Promise<Candidate>;
  updateCandidate(id: string, patch: Partial<Pick<Candidate, "status" | "scores" | "redFlags" | "notes" | "voiceNoteUrl" | "email">>): Promise<Candidate>;
  /** Hired → starts the 10-day program (and fills the opening). */
  startTraining(input: { candidateId?: string; userId?: string; name?: string; role: string; startDate: string }): Promise<Trainee>;
  /** Admins see everyone; anyone else sees their own program. */
  trainingView(): Promise<TrainingView>;
  addBlockScore(traineeId: string, block: BlockKey, score: number): Promise<void>;
  /** Pass (or reopen) a block's gate. Gates with evidence (roleplays, quiz, approved meeting) check it first. */
  setBlockPassed(traineeId: string, block: BlockKey, passed: boolean, note?: string): Promise<void>;
  setTrainingAsset(asset: string, ready: boolean): Promise<void>;
}
