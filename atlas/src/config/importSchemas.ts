import type { ImportEntity } from "@/data/foundationTypes";

/** What the Import Center can import besides leads (leads have their own wizard with scoring and country checks). */
export interface ImportFieldDef {
  key: string;
  label: string;
  required?: boolean;
  /** Header names that map here automatically (lower case, spaces for _ - .). */
  synonyms: string[];
  hint?: string;
}

export const IMPORT_SCHEMAS: Record<ImportEntity, { label: string; help: string; fields: ImportFieldDef[] }> = {
  expense: {
    label: "Expenses",
    help: "Bank or card exports. Duplicates are matched on day, vendor and amount, so you can import the same month twice.",
    fields: [
      { key: "date", label: "Date", required: true, synonyms: ["date", "booking date", "transaction date", "value date", "datum", "buchungsdatum", "posted"] },
      { key: "vendor", label: "Vendor", required: true, synonyms: ["vendor", "merchant", "payee", "description", "counterparty", "name", "empfänger", "beschreibung"] },
      { key: "amount", label: "Amount", required: true, synonyms: ["amount", "value", "total", "debit", "betrag", "sum"], hint: "Negative bank amounts are imported as costs" },
      { key: "currency", label: "Currency", synonyms: ["currency", "ccy", "währung"] },
      { key: "category", label: "Category", synonyms: ["category", "type", "kategorie"], hint: "people, tools, data, usage, freelance, marketing, admin or fees" },
      { key: "recurring", label: "Recurring", synonyms: ["recurring", "monthly", "subscription"] },
      { key: "note", label: "Note", synonyms: ["note", "notes", "memo", "reference", "comment"] },
    ],
  },
  candidate: {
    label: "Candidates",
    help: "Applications from a form, a spreadsheet or LinkedIn. Duplicates are matched on email, or on name within the opening.",
    fields: [
      { key: "name", label: "Name", required: true, synonyms: ["name", "full name", "candidate", "applicant"] },
      { key: "email", label: "Email", synonyms: ["email", "e-mail", "email address"] },
      { key: "source", label: "Source", synonyms: ["source", "channel", "where"], hint: "Venezuela groups, LinkedIn, Referral or Other" },
      { key: "voiceNoteUrl", label: "Voice note link", synonyms: ["voice note", "voice", "audio", "recording"] },
      { key: "notes", label: "Notes", synonyms: ["notes", "note", "comments", "about"] },
    ],
  },
  task: {
    label: "Tasks",
    help: "Notion, Asana, ClickUp or Trello exports into one list. Open tasks with the same title in that list are skipped.",
    fields: [
      { key: "title", label: "Title", required: true, synonyms: ["title", "name", "task", "task name", "summary"] },
      { key: "due", label: "Due date", synonyms: ["due", "due date", "deadline", "date"] },
      { key: "estimate", label: "Estimate (hours)", synonyms: ["estimate", "hours", "estimated hours", "time estimate"] },
      { key: "priority", label: "Priority", synonyms: ["priority", "prio"], hint: "low, normal, high or urgent" },
      { key: "description", label: "Description", synonyms: ["description", "notes", "details", "body"] },
    ],
  },
};

const clean = (h: string) => h.toLowerCase().replace(/[_\-.]+/g, " ").replace(/\s+/g, " ").trim();

/** Header → field key by name; each field is used at most once, exact names before partial ones. */
export const autoMapColumns = (headers: string[], fields: ImportFieldDef[]) => {
  const used = new Set<string>();
  const mapping: Record<string, string | null> = Object.fromEntries(headers.map((h) => [h, null]));
  for (const pass of ["exact", "contains"] as const) {
    for (const header of headers) {
      if (mapping[header]) continue;
      const h = clean(header);
      const hit = fields.find((f) => !used.has(f.key) && [clean(f.label), ...f.synonyms].some((s) => (pass === "exact" ? h === s : s.length > 3 && h.includes(s))));
      if (hit) {
        mapping[header] = hit.key;
        used.add(hit.key);
      }
    }
  }
  return mapping;
};
