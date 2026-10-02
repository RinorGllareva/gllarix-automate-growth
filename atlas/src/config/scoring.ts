import type { ListType } from "./leads";

/**
 * Port of config/scoring.yaml v1 (CRM_BUILD_PROMPT Appendix 1). Change rules here, never in services.
 * Field paths: company.*, contact.* (primary contact), lead.*; or a signal key.
 */
export type Condition =
  | { field: string; in: (string | number)[] }
  | { field: string; between: [number, number] }
  | { field: string; eq: string | number | boolean }
  | { field: string; lt: number }
  | { field: string; gt: number }
  | { field: string; exists: true }
  | { field: string; matches: string }
  | { signal: string; eq: boolean }
  | { signal: string; gte: number }
  | { signal: string; lt: number };

export interface Rule {
  id: string;
  label: string;
  points?: number;
  exclude?: true;
  when: Condition;
  expiresDays?: number;
}

export const SCORING: { modelVersion: string; tiers: { A: number; B: number; C: number }; models: Record<ListType, Rule[]> } = {
  // v2 (2026-10-01): named_sales_director also matches "Head of Sales", "Director of Marketing", "VP Sales".
  modelVersion: "2026-10-01.v2",
  tiers: { A: 70, B: 50, C: 30 },
  models: {
    trades: [
      { id: "target_trade", label: "Target trade", points: 15, when: { field: "company.industry", in: ["hvac", "plumbing", "roofing", "electrical"] } },
      { id: "reviews_established", label: "Established (50–500 reviews)", points: 10, when: { field: "company.reviews_count", between: [50, 500] } },
      { id: "size_band", label: "3–50 employees", points: 5, when: { field: "company.employees_est", between: [3, 50] } },
      { id: "callable_market", label: "Callable market (US, CA)", points: 5, when: { field: "company.country", in: ["US", "CA"] } },
      { id: "english_market", label: "English-speaking market", points: 5, when: { field: "company.country", in: ["US", "CA", "GB", "IE", "AU"] } },
      { id: "reviews_missed_calls", label: "Reviews mention missed calls", points: 10, when: { signal: "reviews_missed_calls", eq: true }, expiresDays: 180 },
      { id: "runs_ads", label: "Runs LSA or Google Ads", points: 7, when: { signal: "runs_lsa_or_google_ads", eq: true }, expiresDays: 60 },
      { id: "no_online_booking", label: "No online booking", points: 5, when: { signal: "no_online_booking", eq: true }, expiresDays: 180 },
      { id: "after_hours_gap", label: "No answer after hours", points: 5, when: { signal: "no_answer_after_hours", eq: true }, expiresDays: 90 },
      { id: "hiring_front_desk", label: "Hiring receptionist or dispatcher", points: 5, when: { signal: "hiring_receptionist_or_dispatcher", eq: true }, expiresDays: 60 },
      { id: "no_chat", label: "No chat widget", points: 3, when: { signal: "no_chat_widget", eq: true }, expiresDays: 180 },
      { id: "direct_phone", label: "Verified direct phone", points: 5, when: { field: "contact.phone_verified", eq: true } },
      { id: "owner_named", label: "Owner or decision-maker named", points: 5, when: { field: "contact.is_decision_maker", eq: true } },
      { id: "valid_email", label: "Valid email", points: 5, when: { field: "contact.email_status", eq: "valid" } },
      { id: "franchise_chain", label: "Franchise or chain", points: -20, when: { signal: "is_franchise_or_chain", eq: true } },
      { id: "has_ai_receptionist", label: "Already uses an AI receptionist", points: -10, when: { signal: "uses_ai_receptionist", eq: true } },
      { id: "low_rating", label: "Rating under 3.5", points: -5, when: { field: "company.rating", lt: 3.5 } },
      { id: "stale_data", label: "Data older than 90 days", points: -5, when: { field: "company.updated_days_ago", gt: 90 } },
      { id: "suppressed", label: "On the opt-out list", exclude: true, when: { field: "lead.suppressed", eq: true } },
    ],
    developers: [
      { id: "active_offplan", label: "Active off-plan project", points: 15, when: { signal: "project_launch_12m", eq: true }, expiresDays: 365 },
      { id: "project_size", label: "30+ units", points: 10, when: { signal: "project_units", gte: 30 } },
      { id: "target_market", label: "Target market", points: 5, when: { field: "company.country", in: ["AE", "GB", "CH", "US", "XK"] } },
      { id: "is_developer", label: "Developer, not broker", points: 5, when: { field: "company.industry", eq: "property_developer" } },
      { id: "has_website", label: "Has website", points: 5, when: { field: "company.domain", exists: true } },
      { id: "no_3d_unit_picker", label: "No 3D or unit picker on site", points: 12, when: { signal: "no_3d_unit_picker", eq: true }, expiresDays: 180 },
      { id: "recent_launch_pr", label: "Launch or PR in last 90 days", points: 8, when: { signal: "launch_or_pr_90d", eq: true }, expiresDays: 90 },
      { id: "static_renders_only", label: "Static renders only", points: 5, when: { signal: "static_renders_only", eq: true }, expiresDays: 180 },
      { id: "expo_exhibitor", label: "Expo exhibitor", points: 5, when: { signal: "expo_exhibitor", eq: true }, expiresDays: 180 },
      { id: "hiring_sales", label: "Hiring sales staff", points: 5, when: { signal: "hiring_sales_staff", eq: true }, expiresDays: 60 },
      { id: "named_sales_director", label: "Named sales director", points: 7, when: { field: "contact.title", matches: "\\b(sales|marketing)\\b.*\\b(director|head|manager|lead)\\b|\\b(director|head|manager|vp|chief)\\b.*\\b(sales|marketing)\\b" } },
      { id: "verified_email", label: "Verified email", points: 4, when: { field: "contact.email_status", eq: "valid" } },
      { id: "direct_line", label: "Direct line", points: 4, when: { field: "contact.phone_verified", eq: true } },
      { id: "busy_sales_office", label: "Sales office phone listed", points: 5, when: { signal: "sales_office_phone_listed", eq: true } },
      { id: "has_3d_vendor", label: "Already has a 3D vendor", points: -15, when: { signal: "has_3d_vendor", eq: true } },
      { id: "single_house_builder", label: "Fewer than 5 units", points: -10, when: { signal: "project_units", lt: 5 } },
      { id: "suppressed", label: "On the opt-out list", exclude: true, when: { field: "lead.suppressed", eq: true } },
    ],
  },
};

/** Human labels for signal keys (lead detail → Signals tab). */
export const SIGNAL_LABEL: Record<string, string> = {
  reviews_missed_calls: "Reviews mention missed calls",
  runs_lsa_or_google_ads: "Runs LSA or Google Ads",
  no_online_booking: "No online booking",
  no_answer_after_hours: "No answer after hours",
  hiring_receptionist_or_dispatcher: "Hiring receptionist or dispatcher",
  no_chat_widget: "No chat widget",
  is_franchise_or_chain: "Franchise or chain",
  uses_ai_receptionist: "Uses an AI receptionist",
  project_launch_12m: "Off-plan project launched in last 12 months",
  project_units: "Units in current project",
  no_3d_unit_picker: "No 3D or unit picker on site",
  launch_or_pr_90d: "Launch or PR in last 90 days",
  static_renders_only: "Static renders only",
  expo_exhibitor: "Expo exhibitor",
  hiring_sales_staff: "Hiring sales staff",
  sales_office_phone_listed: "Sales office phone listed",
  has_3d_vendor: "Has a 3D vendor",
  no_https: "No HTTPS",
  not_mobile_friendly: "Not mobile-friendly",
  no_contact_form: "No contact form",
  pagespeed_mobile: "PageSpeed (mobile)",
  website_unreachable: "Website didn't load",
};
