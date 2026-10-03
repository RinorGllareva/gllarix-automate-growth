import type { KpiKey } from "@/config/targets";
import type { KpiRow, WeeklyReport } from "@/data/salesTypes";

/**
 * The weekly review a founder would write before the Saturday 1:1, from the numbers alone: what went well, where the
 * funnel leaks, and one thing to focus on next week. In demo mode these rules write it; with AI connected, the
 * co-founder writes the same sections server-side from the same numbers. It never scores a person for pay:
 * bonuses come from approved meetings only.
 */
export interface Review {
  headline: string;
  tone: "good" | "watch" | "act";
  wins: string[];
  gaps: string[];
  focus: string;
  trend: { key: KpiKey; label: string; now: number | null; before: number | null; better: boolean | null; unit: KpiRow["unit"] }[];
}

const fmt = (v: number | null, unit: KpiRow["unit"]) => (v === null ? "—" : unit === "pct" ? `${Math.round(v * 100)}%` : unit === "rate" ? v.toFixed(1) : String(Math.round(v)));
const funnelRate = (r: WeeklyReport, key: string) => r.funnel.find((f) => f.key === key)?.rate ?? null;

export const performanceReview = (name: string, now: WeeklyReport, before: WeeklyReport | null): Review => {
  const k = (r: WeeklyReport | null, key: KpiKey) => r?.kpis.find((x) => x.key === key) ?? null;
  const first = name.split(" ")[0];
  const wins: string[] = [];
  const gaps: string[] = [];
  const keys: KpiKey[] = ["dials_per_day", "conversations_per_day", "meetings_booked", "show_rate", "approved_per_booked", "crm_same_day"];
  const trend = keys.map((key) => {
    const a = k(now, key);
    const b = k(before, key);
    return { key, label: a?.label ?? key, now: a?.value ?? null, before: b?.value ?? null, better: a?.value == null || b?.value == null ? null : a.value > b.value ? true : a.value < b.value ? false : null, unit: a?.unit ?? "count" };
  });

  for (const row of now.kpis) {
    if (row.value === null || !keys.includes(row.key)) continue;
    if (row.status === "on_track") wins.push(`${row.label}: ${fmt(row.value, row.unit)} (target ${row.target})`);
    else if (row.status === "off_track") gaps.push(`${row.label}: ${fmt(row.value, row.unit)} against ${row.target}`);
  }
  for (const t of trend) if (t.better && t.before !== null && !wins.some((w) => w.startsWith(t.label))) wins.push(`${t.label} up from ${fmt(t.before, t.unit)} to ${fmt(t.now, t.unit)}`);

  const dials = k(now, "dials_per_day");
  const convs = k(now, "conversations_per_day");
  const booked = k(now, "meetings_booked");
  const show = k(now, "show_rate");
  const approved = k(now, "approved_per_booked");
  const crm = k(now, "crm_same_day");
  const connect = funnelRate(now, "connects");
  const book = funnelRate(now, "booked");

  // The first leak in the funnel decides the focus: fix the earliest problem first.
  let focus: string;
  let tone: Review["tone"] = "good";
  if (dials?.value == null) {
    focus = `No calls logged this week. Check ${first} has a queue and the dialler works before anything else.`;
    tone = "act";
  } else if (dials.status === "off_track") {
    focus = `Activity: ${fmt(dials.value, "rate")} dials a day against ${dials.target}. Agree a daily block of calling hours in the 1:1.`;
    tone = "act";
  } else if (convs?.status === "off_track" || (connect !== null && connect < 0.15)) {
    focus = `Reaching people: dials are fine but few turn into conversations${connect !== null ? ` (${Math.round(connect * 100)}% connect)` : ""}. Check the list (direct lines, tier A/B) and the calling windows before blaming the rep.`;
    tone = "watch";
  } else if (booked?.status === "off_track" || (book !== null && book < 0.1)) {
    focus = `Turning conversations into meetings. Listen to 3 recorded calls together: the opener and the ask for the meeting. If the script is the issue, the founders fix it.`;
    tone = "watch";
  } else if (approved?.status === "off_track") {
    focus = `Meeting quality: too many meetings get rejected. Go through the rejection reasons and tighten the qualifying questions.`;
    tone = "watch";
  } else if (show?.status === "off_track") {
    focus = `Show rate: confirm every meeting by text the day before and send the agenda.`;
    tone = "watch";
  } else if (crm?.status === "off_track") {
    focus = `Keep the CRM same-day: log every outcome before the next call. Reports and bonuses depend on it.`;
    tone = "watch";
  } else {
    focus = `Keep the rhythm. Next stretch: ${booked?.value != null ? `${Math.round(booked.value) + 1} meetings next week` : "one more meeting next week"}.`;
  }
  if (gaps.length >= 3) tone = "act";

  const headline =
    tone === "good" ? `${first} is on target this week.` : tone === "watch" ? `${first} is close: one part of the funnel needs work.` : `${first} needs a conversation this week.`;
  return { headline, tone, wins: wins.slice(0, 4), gaps: gaps.slice(0, 4), focus, trend };
};
