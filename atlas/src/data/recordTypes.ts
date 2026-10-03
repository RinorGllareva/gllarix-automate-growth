/**
 * Records on leads and clients: files (proposals, floor plans, signed contracts, reports), editable contacts and
 * lead tags. Demo mode keeps files in the browser (up to 2 MB each); Supabase Storage replaces that later.
 */
export type FileEntity = "lead" | "client" | "deal";

export interface RecordFile {
  id: string;
  entity: FileEntity;
  entityId: string;
  name: string;
  size: number;
  mime: string;
  /** Where it came from: uploaded by a person, or written by Atlas (a signed contract, a monthly report). */
  kind: "upload" | "contract" | "report";
  /** data: URL in demo mode; a signed storage URL later. */
  url: string;
  uploadedBy: string | null;
  uploadedByName: string | null;
  createdAt: string;
}

export interface ContactInput {
  /** Omit to add a new contact. */
  id?: string;
  firstName: string;
  lastName: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  isDecisionMaker: boolean;
}

export const MAX_DEMO_FILE_BYTES = 2 * 1024 * 1024;

export interface RecordsApi {
  listFiles(entity: FileEntity, id: string): Promise<RecordFile[]>;
  uploadFile(entity: FileEntity, id: string, input: { name: string; size: number; mime: string; url: string }): Promise<RecordFile>;
  /** The uploader or an admin. Files Atlas wrote (signed contracts) can't be deleted. */
  deleteFile(id: string): Promise<void>;
  saveContact(leadId: string, input: ContactInput): Promise<void>;
  setLeadTags(leadId: string, tags: string[]): Promise<void>;
}
