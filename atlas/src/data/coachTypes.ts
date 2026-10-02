import type { AgendaPoint, Insight, ScoredCall, TranscriptLine } from "@/services/coach";

export type { AgendaPoint, Insight, ScoredCall, TranscriptLine };

/** One scored (or not scored) work call (call_reviews). */
export interface CallReview {
  id: string;
  activityId: string;
  /** null once anonymised (after the transcript retention period). */
  userId: string | null;
  leadId: string | null;
  companyName: string;
  at: string;
  durationS: number;
  disposition: string | null;
  localHour: number | null;
  rubricVersion: string;
  result: ScoredCall;
  /** null after the transcript retention period. */
  lines: TranscriptLine[] | null;
  recording: { url: string | null; expiresAt: string };
  model: string;
  costMinor: number;
  human: { reviewerId: string; score: number; at: string; gap: number; flagged: boolean } | null;
  humanRequested: { week: string; assigneeId: string; reason: "sample" | "dispute" } | null;
  disputed: { by: string; at: string; note: string; resolvedAt: string | null } | null;
  anonymized: boolean;
  createdAt: string;
}

export interface OneOnOne {
  userId: string;
  week: string;
  points: AgendaPoint[];
  generatedAt: string;
  editedBy: string | null;
  editedAt: string | null;
}

export interface ScorecardComment {
  id: string;
  /** Whose scorecard. */
  userId: string;
  authorId: string;
  body: string;
  reviewId: string | null;
  kind: "comment" | "dispute";
  at: string;
}

export interface CoachingSettings {
  /** Legal go/no-go: counsel confirmed the obligations (A17). Off = no AI scoring anywhere. */
  aiScoringVerified: boolean;
  verifiedBy: string | null;
  verifiedAt: string | null;
  recordingDays: number;
  transcriptDays: number;
}

export interface StatCell {
  key: string;
  label: string;
  value: string;
  target: string;
  status: "met" | "watch" | "neutral";
}

export interface PersonCard {
  /** Fixed by role, never by any score. */
  n: string;
  userId: string | null;
  name: string;
  role: string;
  stats: StatCell[];
  focus: string | null;
  href: string | null;
}

export interface TeamOverview {
  week: string;
  weekLabel: string;
  aiOn: boolean;
  /** Admins: one card per person (plus the Codex agent). */
  cards: PersonCard[];
  /** Viewers: team totals only. */
  totals: StatCell[];
  insights: Insight[] | null;
  scoredCalls: number;
  humanChecks: { reviewId: string; companyName: string; repName: string; at: string; reason: "sample" | "dispute" }[];
  rubricFlags: { reviewId: string; gap: number; at: string }[];
  guardrails: string[];
}

export interface ScorecardKpi {
  label: string;
  values: (string | null)[];
  target: string;
  status: "on_track" | "watch" | null;
}

export interface Scorecard {
  userId: string;
  name: string;
  role: string;
  tenure: string;
  weeks: { key: string; label: string }[];
  kpis: ScorecardKpi[];
  aiOn: boolean;
  quality: {
    scored: number;
    humanChecked: number;
    overall: number | null;
    items: { key: string; label: string; value: number | null }[];
    compliancePassRate: number | null;
  } | null;
  agenda: OneOnOne | null;
  earnings: { month: string; lines: { label: string; amountMinor: number | null; currency: "USD" | "EUR" }[]; totalMinor: number; currency: "USD" | "EUR" };
  comments: (ScorecardComment & { authorName: string })[];
  reviews: { id: string; companyName: string; at: string; durationS: number; total: number | null; status: string; disputed: boolean; compliancePass: boolean }[];
  canEditAgenda: boolean;
}

export interface CallReviewView {
  review: CallReview;
  repName: string;
  canHumanCheck: boolean;
  canDispute: boolean;
  aiOn: boolean;
}

export interface TeamApi {
  /** BDRs and closers get { redirectTo: their id }. Viewers get totals only. */
  teamOverview(week?: string): Promise<TeamOverview | { redirectTo: string }>;
  scorecard(userId: string, weeks?: number): Promise<Scorecard>;
  getCallReview(id: string): Promise<CallReviewView>;
  /** Admin: confirm a score. |AI − human| > 15 flags the rubric for review. */
  humanCheck(id: string, score: number): Promise<void>;
  /** The rep disputes a score: marks it for a human re-check and notifies the co-founder. */
  disputeReview(id: string, note: string): Promise<void>;
  addScorecardComment(userId: string, body: string): Promise<void>;
  updateAgenda(userId: string, week: string, points: AgendaPoint[]): Promise<void>;
  /** Generates every person's weekly 1:1 agenda. */
  prepareOneOnOnes(week?: string): Promise<number>;
  /** Admin: the legal go/no-go for AI scoring. */
  setAiScoring(verified: boolean): Promise<void>;
  /** Transcribe + score new calls, weekly human-check sample, agendas, retention. Idempotent. */
  runCoachingJobs(): Promise<{ scored: number; notScored: number; sampled: number; agendas: number; expiredRecordings: number; anonymised: number }>;
  coachingSettings(): Promise<CoachingSettings>;
}
