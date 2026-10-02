import type { ListType } from "./leads";

/**
 * Lead sources (CRM_BUILD_PROMPT M8). Official APIs and licensed lists only: no Google Maps scraping,
 * no automated LinkedIn. Costs are estimates in USD cents; check the providers' current pricing before going live.
 */

export type ConnectorId = "places_api" | "companies_house" | "zefix" | "csv_template";

export interface ConnectorConfig {
  id: ConnectorId;
  label: string;
  /** Where it finds companies. */
  countries: string[];
  listTypes: ListType[];
  /** Estimated cost per request (USD cents) and records per page. */
  costPerRequestMinor: number;
  pageSize: number;
  /** Default monthly cap (USD cents); hitting it pauses the list-build job and alerts admins. */
  defaultCapMinor: number;
  /** Cache lifetime. Google's Places terms allow caching content for up to 30 days (place IDs indefinitely). */
  cacheDays: number;
  needsKey: boolean;
  terms: string;
}

export const CONNECTORS: Record<ConnectorId, ConnectorConfig> = {
  places_api: {
    id: "places_api",
    label: "Google Places API (Text Search)",
    countries: ["US", "CA", "GB", "AE"],
    listTypes: ["trades", "developers"],
    costPerRequestMinor: 4,
    pageSize: 20,
    defaultCapMinor: 5000,
    cacheDays: 30,
    needsKey: true,
    terms: "Official API only. Content cached at most 30 days; place IDs kept as external ids. Show Google attribution where Places data is displayed.",
  },
  companies_house: {
    id: "companies_house",
    label: "UK Companies House API",
    countries: ["GB"],
    listTypes: ["developers"],
    costPerRequestMinor: 0,
    pageSize: 20,
    defaultCapMinor: 0,
    cacheDays: 30,
    needsKey: true,
    terms: "Free API key; 600 requests per 5 minutes. Officers give the director's name; no phone, so a website is needed to reach them.",
  },
  zefix: {
    id: "zefix",
    label: "Swiss Zefix (commercial register)",
    countries: ["CH"],
    listTypes: ["developers"],
    costPerRequestMinor: 0,
    pageSize: 20,
    defaultCapMinor: 0,
    cacheDays: 30,
    needsKey: true,
    terms: "Zefix public REST API (free credentials on request). Register data only; contacts come from the website.",
  },
  csv_template: {
    id: "csv_template",
    label: "CSV template (manual or licensed lists)",
    countries: [],
    listTypes: ["trades", "developers"],
    costPerRequestMinor: 0,
    pageSize: 0,
    defaultCapMinor: 0,
    cacheDays: 0,
    needsKey: false,
    terms: "For Dubai developers (DLD lists), expo exhibitor lists and other licensed data. Import through Leads › Import; keep the licence note in the source name.",
  },
};

export interface SearchPlan {
  id: string;
  connector: Exclude<ConnectorId, "csv_template">;
  listType: ListType;
  country: string;
  label: string;
  /** Text query (Places) or industry code (registries). */
  query: string;
  industry: string;
  region?: string;
}

/** What the list-build job searches for each list type, in rotation (context/03 target markets). */
export const SEARCH_PLANS: SearchPlan[] = [
  { id: "us-hvac-tx", connector: "places_api", listType: "trades", country: "US", region: "TX", label: "HVAC · Texas", query: "hvac contractor in Texas", industry: "hvac" },
  { id: "us-plumbing-fl", connector: "places_api", listType: "trades", country: "US", region: "FL", label: "Plumbing · Florida", query: "plumber in Florida", industry: "plumbing" },
  { id: "us-roofing-ga", connector: "places_api", listType: "trades", country: "US", region: "GA", label: "Roofing · Georgia", query: "roofing contractor in Georgia", industry: "roofing" },
  { id: "us-electrical-az", connector: "places_api", listType: "trades", country: "US", region: "AZ", label: "Electrical · Arizona", query: "electrician in Arizona", industry: "electrical" },
  { id: "gb-developers", connector: "companies_house", listType: "developers", country: "GB", label: "UK · SIC 41100 developers", query: "41100", industry: "property_developer" },
  { id: "ch-developers", connector: "zefix", listType: "developers", country: "CH", label: "Switzerland · Immobilienentwicklung", query: "Immobilien Entwicklung", industry: "property_developer" },
  { id: "ae-developers", connector: "places_api", listType: "developers", country: "AE", label: "Dubai · property developers", query: "property developer in Dubai", industry: "property_developer" },
];

export const LIST_BUILD = {
  /** Stop after this many API requests in one run, whatever the shortfall. */
  maxRequestsPerRun: 40,
  /** Website audits re-run after this many days. */
  reauditDays: 90,
  /** Enrichment job: audits per run. */
  auditsPerRun: 60,
  /** Failures in a row before admins are notified. */
  alertAfterFailures: 2,
  lawfulBasis: "Legitimate interest · B2B",
} as const;

/** CSV templates for manual or licensed lists. Headers match the import's auto-mapping. */
export const CSV_TEMPLATES = {
  dubai_developers: {
    label: "Dubai developers (DLD / licensed list)",
    fileName: "atlas-template-dubai-developers.csv",
    headers: ["Company", "Website", "Phone", "Contact name", "Title", "Email", "City", "Country", "Industry", "Notes"],
    example: ["Example Developments LLC", "exampledev.ae", "+971 4 000 0000", "Sara Example", "Sales Director", "sara@exampledev.ae", "Dubai", "AE", "property developer", "DLD project 1234 · 120 units · licensed list"],
  },
  expo_exhibitors: {
    label: "Expo exhibitors",
    fileName: "atlas-template-expo-exhibitors.csv",
    headers: ["Company", "Website", "Phone", "Contact name", "Title", "Email", "City", "Country", "Industry", "Notes"],
    example: ["Example Homes", "examplehomes.co.uk", "+44 20 0000 0000", "Tom Example", "Head of Sales", "tom@examplehomes.co.uk", "London", "GB", "property developer", "Cityscape 2026 · stand B12"],
  },
} as const;
