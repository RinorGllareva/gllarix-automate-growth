/**
 * Wave 1 foundations (docs/pages/00-PAGE-STANDARD.md, 01-INTEGRATIONS-AND-PLUGINS.md):
 * the events table, outbound webhooks, custom fields, saved views and the Import Center.
 */

// ---------------------------------------------------------------- events

/** One write anywhere in Atlas. Automations, alerts, webhooks, the audit log and record timelines read the same stream. */
export interface AtlasEvent {
  id: string;
  /** "lead.create", "deal.stage_change", "invoice.paid", … (entity.verb). */
  type: string;
  entity: string;
  entityId: string | null;
  /** User id; null for jobs, webhooks and the public pages. */
  actor: string | null;
  actorName: string | null;
  payload: unknown;
  at: string;
}

export interface EventQuery {
  type?: string;
  entity?: string;
  entityId?: string;
  actor?: string;
  /** ISO time; only events after it. */
  since?: string;
  limit?: number;
}

/** Outbound webhook: Atlas posts matching events to a URL, signed with HMAC-SHA256. */
export interface Webhook {
  id: string;
  url: string;
  /** Event types, or prefixes ending in "*" ("deal.*"). */
  events: string[];
  active: boolean;
  /** Shown once at creation; signs every delivery. */
  secret: string;
  createdBy: string;
  createdAt: string;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventId: string;
  eventType: string;
  at: string;
  /** "simulated": demo mode records what it would send and never calls the URL. */
  status: "simulated" | "delivered" | "failed";
  signature: string;
  body: string;
}

// ---------------------------------------------------------------- custom fields

export const FIELD_ENTITIES = ["lead", "deal", "client", "ticket", "candidate"] as const;
export type FieldEntity = (typeof FIELD_ENTITIES)[number];
export const FIELD_ENTITY_LABEL: Record<FieldEntity, string> = { lead: "Leads", deal: "Deals", client: "Clients", ticket: "Support tickets", candidate: "Candidates" };

export const FIELD_TYPES = ["text", "number", "money", "date", "select", "multi_select", "person", "link", "checkbox"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];
export const FIELD_TYPE_LABEL: Record<FieldType, string> = {
  text: "Text",
  number: "Number",
  money: "Money",
  date: "Date",
  select: "Select",
  multi_select: "Multi-select",
  person: "Person",
  link: "Link",
  checkbox: "Checkbox",
};

export interface FieldDef {
  id: string;
  entity: FieldEntity;
  /** Stable key used in imports, exports and filters ("contract_end"). */
  key: string;
  label: string;
  type: FieldType;
  /** Select and multi-select. */
  options: string[];
  /** Money: the currency it's in. */
  currency?: "USD" | "EUR";
  /** Shown as a column in the entity's table by default. */
  inTable: boolean;
  order: number;
  createdAt: string;
}

/** string for text/date/select/link/person (user id), number for number/money (minor units), string[] for multi-select, boolean for checkbox. */
export type FieldValue = string | number | boolean | string[] | null;
export type CustomValues = Record<string, FieldValue>;

// ---------------------------------------------------------------- saved views

export interface ViewFilter {
  key: string;
  /** select / multi-select / person: any of these. */
  values?: string[];
  /** date: inclusive range, "YYYY-MM-DD". */
  from?: string;
  to?: string;
  /** number: inclusive range. */
  min?: number;
  max?: number;
  /** text: contains. */
  text?: string;
}

export interface ViewState {
  q: string;
  filters: ViewFilter[];
  sort: { key: string; dir: "asc" | "desc" } | null;
}

export interface PageView {
  id: string;
  /** The list it belongs to ("support", "payments", …). */
  page: string;
  name: string;
  ownerId: string;
  ownerName: string | null;
  /** Founders can share a view with the whole team. */
  shared: boolean;
  state: ViewState;
  createdAt: string;
}

// ---------------------------------------------------------------- Import Center

export const IMPORT_ENTITIES = ["expense", "candidate", "task"] as const;
export type ImportEntity = (typeof IMPORT_ENTITIES)[number];

export interface EntityImportInput {
  entity: ImportEntity;
  fileName: string;
  /** "Bank export", "Notion tasks": mappings are saved per source. */
  sourceName: string;
  /** Rows already mapped: Atlas field key (or "custom:<key>") → cell text. */
  rows: Record<string, string>[];
  /** Expense: currency when the file has none. Task: the list. Candidate: the opening. */
  target?: string;
  /** Check everything, write nothing. */
  dryRun?: boolean;
}

export type ImportRowStatus = "create" | "duplicate" | "error";

export interface EntityImportResult {
  job: EntityImportJob | null;
  rows: { row: number; status: ImportRowStatus; label: string; reason: string | null }[];
}

export interface EntityImportJob {
  id: string;
  entity: ImportEntity;
  fileName: string;
  sourceName: string;
  createdBy: string;
  createdAt: string;
  rows: number;
  created: number;
  duplicates: number;
  failed: number;
  createdIds: string[];
  undoneAt: string | null;
}

export interface FoundationsApi {
  /** Founders see every event; anyone else only events on records they can open. */
  listEvents(q?: EventQuery): Promise<AtlasEvent[]>;
  /** The timeline of one record (record pages). */
  recordEvents(entity: string, id: string): Promise<AtlasEvent[]>;
  listWebhooks(): Promise<{ webhooks: Webhook[]; deliveries: WebhookDelivery[] }>;
  saveWebhook(input: { id?: string; url: string; events: string[]; active: boolean }): Promise<Webhook>;
  deleteWebhook(id: string): Promise<void>;

  listFieldDefs(entity?: FieldEntity): Promise<FieldDef[]>;
  saveFieldDef(input: Omit<FieldDef, "id" | "createdAt" | "order" | "key"> & { id?: string; key?: string }): Promise<FieldDef>;
  /** Removes the field and its values. */
  deleteFieldDef(id: string): Promise<void>;
  moveFieldDef(id: string, direction: "up" | "down"): Promise<void>;
  /** Values for records the viewer can open (unknown or hidden ids are left out). */
  customValues(entity: FieldEntity, ids: string[]): Promise<Record<string, CustomValues>>;
  setCustomValue(entity: FieldEntity, id: string, key: string, value: FieldValue): Promise<void>;

  /** My views plus the team's shared ones. */
  listPageViews(page: string): Promise<PageView[]>;
  /** Same name (mine) replaces it. Only founders share. */
  savePageView(input: { page: string; name: string; state: ViewState; shared?: boolean }): Promise<PageView>;
  deletePageView(id: string): Promise<void>;

  runEntityImport(input: EntityImportInput): Promise<EntityImportResult>;
  listEntityImports(): Promise<EntityImportJob[]>;
  undoEntityImport(id: string): Promise<{ removed: number }>;
  /** Column mapping saved per entity and source name. */
  getImportMapping(entity: string, sourceName: string): Promise<Record<string, string | null> | null>;
  saveImportMapping(entity: string, sourceName: string, mapping: Record<string, string | null>): Promise<void>;
}
