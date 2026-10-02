import type { ListType } from "./leads";

/**
 * Call scripts per list. DRAFT: the opener and questions come from the Call mockup; the co-founder owns the real
 * script and objection library (plans/sales_team_plan.md). Objection answers are placeholders until written,
 * so the BDR never reads an unapproved claim.
 */
export interface Script {
  draft: boolean;
  offerName: string;
  /** {{contact}} and {{bdr}} are filled in; the recording notice is part of the opener. */
  opener: string;
  questions: string[];
  objections: { label: string; answer: string }[];
}

const TO_WRITE = "[Answer to be written by the co-founder · objection library]";

export const SCRIPTS: Record<ListType, Script> = {
  trades: {
    draft: true,
    offerName: "Never miss a job",
    opener:
      "Hi {{contact}}, it's {{bdr}} with Gllarix. Quick heads-up, this call is recorded. Quick one: when your team is out on a job, who picks up the phone?",
    questions: ["How many calls do you miss in a week?", "What is an average job worth?", "What happens to calls after 18:00?"],
    objections: [
      { label: "AI sounds robotic", answer: TO_WRITE },
      { label: "I answer my own phone", answer: TO_WRITE },
      { label: "Send me info", answer: TO_WRITE },
      { label: "Too expensive", answer: TO_WRITE },
      { label: "We have a receptionist", answer: TO_WRITE },
    ],
  },
  developers: {
    draft: true,
    offerName: "3D sales platform",
    opener:
      "Hi {{contact}}, it's {{bdr}} with Arcadian. Quick heads-up, this call is recorded. I'm calling about your current project: how are buyers choosing units today?",
    questions: ["How many units are still unsold?", "How do buyers see layouts and views today?", "Who handles calls to the sales office?"],
    objections: [
      { label: "We already have renders", answer: TO_WRITE },
      { label: "Send me info", answer: TO_WRITE },
      { label: "Too expensive", answer: TO_WRITE },
      { label: "Not the right time", answer: TO_WRITE },
    ],
  },
};

export const fillScript = (text: string, contact: string, bdr: string) =>
  text.replace(/{{contact}}/g, contact || "there").replace(/{{bdr}}/g, bdr);
