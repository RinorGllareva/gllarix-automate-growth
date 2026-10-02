import type { ParityResult } from "@/data/quoteTypes";
import { compute, emptySelection, type QuoteSelection } from "./pricing";

/** Parity fixtures from 09_DEAL_AND_QUOTE.md / CRM_BUILD_PROMPT A11. Admin › Price book runs them on demand. */
export const PARITY_FIXTURES: { name: string; selection: QuoteSelection; expected: { setup: number; monthly: number; firstYear?: number } }[] = [
  {
    name: "US · Standard + speed-to-lead + reviews + conversion page · pilot",
    selection: { ...emptySelection("us"), tiers: { rec: "rec_m", lp: "lp_2" }, qty: { stl: 1, rev: 1 }, pilot: true },
    expected: { setup: 1780, monthly: 786, firstYear: 10426 },
  },
  {
    name: "Same without pilot",
    selection: { ...emptySelection("us"), tiers: { rec: "rec_m", lp: "lp_2" }, qty: { stl: 1, rev: 1 } },
    expected: { setup: 4440, monthly: 1048 },
  },
  { name: "Kosovo · interactive 3D building", selection: { ...emptySelection("xk"), tiers: { d3: "d3_b" } }, expected: { setup: 3250, monthly: 125 } },
  { name: "Switzerland · 3D sales platform", selection: { ...emptySelection("ch"), tiers: { d3: "d3_p" } }, expected: { setup: 15000, monthly: 561 } },
];

export const runParity = (): ParityResult[] =>
  PARITY_FIXTURES.map((f) => {
    const r = compute(f.selection);
    const actual = { setup: r.setup, monthly: r.monthly, firstYear: r.firstYear };
    const pass = actual.setup === f.expected.setup && actual.monthly === f.expected.monthly && (f.expected.firstYear === undefined || actual.firstYear === f.expected.firstYear);
    return { name: f.name, expected: f.expected, actual, pass };
  });
