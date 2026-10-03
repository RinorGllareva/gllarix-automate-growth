/**
 * Docs and wiki: the company's pages (handbook, playbooks, SOPs), nested like Notion and written in Markdown.
 * Pages imported from a Notion export keep their Notion id so a second import updates instead of duplicating.
 */
export interface Doc {
  id: string;
  title: string;
  icon: string | null;
  parentId: string | null;
  body: string;
  source: "atlas" | "notion";
  notionId: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
}

export interface DocRow extends Omit<Doc, "body"> {
  updatedByName: string | null;
  /** Pages that link here. */
  backlinks: { id: string; title: string }[];
}

export interface NotionMove {
  tasksImportedAt: string | null;
  docsFromNotion: number;
  /** Links to Notion pages that weren't in the export. */
  brokenLinks: number;
  readOnlyAt: string | null;
  readOnlyBy: string | null;
}

export interface DocsApi {
  listDocs(): Promise<{ docs: DocRow[]; canEdit: boolean; move: NotionMove | null }>;
  getDoc(id: string): Promise<DocRow & { body: string }>;
  saveDoc(input: { id?: string; title: string; body: string; parentId: string | null; icon?: string | null }): Promise<Doc>;
  /** Admin. Archived pages leave the tree; their children move up one level. */
  archiveDoc(id: string): Promise<void>;
  /** Admin. Files from an unzipped Notion export; re-importing updates pages with the same Notion id. */
  importNotionDocs(files: { path: string; text: string }[]): Promise<{ created: number; updated: number; skipped: string[] }>;
  /** Admin: the last step of the move, done in Notion; recorded here so everyone knows Atlas is the source now. */
  setNotionReadOnly(done: boolean): Promise<void>;
}
