/**
 * Port of config/country_rules.yaml v1 (CRM_BUILD_PROMPT Appendix 3).
 * Summary from planning notes, not legal advice: every market is unverified until a founder confirms it with counsel.
 */
export interface CountryRule {
  call: boolean;
  email: boolean | "conditional";
  notes: string;
  verified: boolean;
  callRequires?: string[];
  callBlock?: string[];
  callHoursLocal?: string;
  /** Cold texts without consent (Appendix 3 `sms_cold`; missing = not allowed). */
  smsCold?: boolean;
  /** Autodialed or prerecorded calls to mobiles (`autodialer_to_mobile`; Atlas dials by hand everywhere). */
  autodialerToMobile?: boolean;
}

/** `call_block` values: number flags that block a cold call. */
export const CALL_BLOCK_LABEL: Record<string, string> = {
  directory_asterisk: "marked with an asterisk in the Swiss directory (no advertising calls)",
};

/** Personal data of lost or never-worked leads is erased after this many months (A10; admins can change it). */
export const RETENTION_MONTHS_DEFAULT = 12;

export const COUNTRY_RULES: Record<string, CountryRule> = {
  US: { call: true, email: true, smsCold: false, autodialerToMobile: false, notes: "CAN-SPAM opt-out + address; manual dialing", verified: false },
  CA: { call: true, email: "conditional", notes: "CASL: only conspicuously published business addresses, relevant to role", verified: false },
  GB: { call: true, callRequires: ["tps_ctps_screen"], email: "conditional", notes: "PECR: corporate subscribers yes, sole traders no", verified: false },
  CH: { call: true, callBlock: ["directory_asterisk"], email: false, notes: "UWG: no mass cold email", verified: false },
  DE: { call: false, email: false, notes: "UWG: LinkedIn, events, referrals only", verified: false },
  AT: { call: false, email: false, notes: "As DE", verified: false },
  AE: { call: true, callHoursLocal: "09:00-18:00", email: true, notes: "Verify current telemarketing rules and PDPL", verified: false },
  XK: { call: true, email: true, notes: "Opt-out in every message", verified: false },
  AL: { call: true, email: true, notes: "Opt-out in every message", verified: false },
  NO: { call: true, email: "conditional", notes: "Check per country", verified: false },
  SE: { call: true, email: "conditional", notes: "Check per country", verified: false },
  DK: { call: true, email: "conditional", notes: "Check per country", verified: false },
};

/** Markets where neither calls nor email are allowed: imports warn about these rows. */
export const hasNoAllowedChannel = (country: string | null) => {
  const rule = country ? COUNTRY_RULES[country] : undefined;
  return Boolean(rule && !rule.call && rule.email === false);
};
