import type { ToolName } from "@/data/advisorTypes";

/**
 * The AI co-founder's evaluation set (backbone/08 "Evaluation set", Appendix 6 `evaluation.advisor`).
 * Each question must call these tools and cite these files; `says` checks the conclusion where the file decides it.
 * Run against the fake provider in tests, and against the real model before switching models.
 */
export interface EvalCase {
  n: number;
  question: string;
  tools: ToolName[];
  files?: string[];
  says?: RegExp;
}

export const ADVISOR_EVAL: EvalCase[] = [
  { n: 1, question: "Price for Standard + reviews in Switzerland, pilot", tools: ["run_price_quote"], says: /Standard \+ Review automation \(pilot\) in Switzerland/ },
  { n: 2, question: "Should we hire setter #1 now?", tools: ["run_scenario", "get_kpis"], files: ["context/07"], says: /Gate 1/ },
  { n: 3, question: "How much cash do we have vs the reserve?", tools: ["get_finance"], says: /reserve/ },
  { n: 4, question: "What's our break-even number of clients?", tools: ["get_finance"], files: ["backbone/03"], says: /paying Gllarix client/ },
  { n: 5, question: "Which lead source converts best?", tools: ["get_kpis"] },
  { n: 6, question: "Is Rinor over capacity next weekend?", tools: ["get_capacity"], says: /Rinor/ },
  { n: 7, question: "Plan the Dubai 3D showcase by 31 Oct", tools: ["propose_tasks", "get_capacity"] },
  { n: 8, question: "Can we cold-email Swiss developers?", tools: ["search_knowledge"], files: ["backbone/10"], says: /^No/ },
  { n: 9, question: "What should the BDR focus on this week?", tools: ["get_team_performance"] },
  { n: 10, question: "Which client is at churn risk?", tools: ["get_clients"] },
  { n: 11, question: "ROI of a $150/month list builder", tools: ["run_scenario"], files: ["backbone/09"] },
  { n: 12, question: "Should we build our own email sender?", tools: ["search_knowledge"], files: ["backbone/06"], says: /^Buy it/ },
  { n: 13, question: "What did we decide about the Arcadian scope?", tools: ["get_decisions"], says: /Arcadian offers only landing pages, 3D property visualization, and SaaS/ },
  { n: 14, question: "Margin on Sunrise HVAC this month", tools: ["get_clients", "get_time_report"], says: /Sunrise HVAC/ },
  { n: 15, question: "Quote for Marina Crest, a 3D platform in Dubai", tools: ["run_price_quote"], says: /Gulf pricing isn't researched yet/ },
  { n: 16, question: "Are we on track for €10k MRR by June?", tools: ["get_mrr_history"], files: ["plans/mrr_10k_strategy"] },
  { n: 17, question: "What do competitors charge per minute?", tools: ["get_market_notes"], says: /\/min/ },
  { n: 18, question: "Draft the setter job post", tools: ["draft_document"], files: ["backbone/05"] },
  { n: 19, question: "What happens to commission if a client cancels in week 3?", tools: ["search_knowledge"], files: ["backbone/05"], says: /clawed back/ },
  { n: 20, question: "Can the AI BDR cold-call US mobiles?", tools: ["search_knowledge"], files: ["backbone/14"], says: /^No/ },
];
