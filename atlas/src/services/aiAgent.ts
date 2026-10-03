import { COUNTRY_RULES } from "@/config/countryRules";
import type { AgentPlanItem, AgentSettings } from "@/data/aiTypes";
import type { InboundRequest } from "@/data/opsTypes";
import { localHHMM } from "./time";

/** Time zones to check per country. Countries spanning zones must be inside the window in all of them. */
export const AGENT_ZONES: Record<string, string[]> = {
  US: ["America/New_York", "America/Los_Angeles"],
  CA: ["America/Toronto", "America/Vancouver"],
  GB: ["Europe/London"],
  CH: ["Europe/Zurich"],
  AE: ["Asia/Dubai"],
  XK: ["Europe/Belgrade"],
  AL: ["Europe/Tirane"],
  NO: ["Europe/Oslo"],
};

export const DEFAULT_AGENT: AgentSettings = {
  mode: "off",
  hoursFrom: "09:00",
  hoursTo: "18:00",
  withinMinutes: 5,
  maxAttempts: 2,
  handoffTo: null,
  disclosure: "Hi {{name}}, this is an AI assistant calling for {{brand}}, because you asked us to get back to you. The call is recorded. Is now a good moment for two quick questions?",
  questions: ["What made you reach out today?", "Roughly how many calls do you miss in a week?", "Who decides on something like this?"],
  updatedAt: null,
  updatedBy: null,
};

const inWindow = (hhmm: string, from: string, to: string) => hhmm >= from && hhmm < to;

/**
 * Who the agent may call right now, and why not for the rest. Only open inbound requests with a phone number:
 * they asked to be contacted, which is the consent an AI voice needs. Countries where Atlas doesn't call stay with
 * a human; so does anyone outside the local calling window.
 */
export const agentPlan = (requests: Pick<InboundRequest, "id" | "name" | "company" | "phone" | "country" | "receivedAt" | "status" | "brand">[], s: AgentSettings, now: number): AgentPlanItem[] =>
  requests
    .filter((r) => r.status === "new" && r.phone)
    .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))
    .map((r) => {
      const base = {
        requestId: r.id,
        name: r.name,
        company: r.company,
        phone: r.phone!,
        country: r.country,
        receivedAt: r.receivedAt,
        opener: s.disclosure.replace(/{{name}}/g, r.name.split(" ")[0] || "there").replace(/{{brand}}/g, r.brand === "gllarix" ? "Gllarix" : "Arcadian Labs"),
      };
      const zones = r.country ? AGENT_ZONES[r.country] : undefined;
      const rule = r.country ? COUNTRY_RULES[r.country] : undefined;
      if (rule && !rule.call) return { ...base, allowed: false, reason: `We don't call in ${r.country}: a human replies by email` };
      if (!r.country || !zones || !rule) return { ...base, allowed: false, reason: "Country unknown or not set up for the agent: a human calls" };
      const times = zones.map((z) => localHHMM(now, z));
      const [from, to] = rule.callHoursLocal ? rule.callHoursLocal.split("-") : [s.hoursFrom, s.hoursTo];
      const winFrom = from > s.hoursFrom ? from : s.hoursFrom;
      const winTo = to < s.hoursTo ? to : s.hoursTo;
      if (!times.every((t) => inWindow(t, winFrom, winTo))) return { ...base, allowed: false, reason: `Outside ${winFrom}–${winTo} local (${times.join(" / ")}): queued for the next window` };
      const mins = Math.round((now - new Date(r.receivedAt).getTime()) / 60_000);
      return { ...base, allowed: true, reason: mins <= s.withinMinutes ? `Asked ${mins} min ago: call now` : `Asked ${mins < 120 ? `${mins} min` : `${Math.round(mins / 60)} h`} ago: call now, it's late` };
    });
