/**
 * Contracts and e-signature: a contract is filled from a deal and its latest quote, sent as a private link, and
 * signed by typing a name. The signed PDF (with an audit page) is stored on the deal and shows on the client.
 */
export type ContractStatus = "draft" | "sent" | "viewed" | "signed" | "void";

export interface ContractSignature {
  name: string;
  title: string | null;
  email: string;
  at: string;
  /** SHA-256 of the exact text that was signed. */
  hash: string;
}

export interface Contract {
  id: string;
  dealId: string;
  version: number;
  templateKey: string;
  title: string;
  /** The filled text, one section per block: "## Heading\nbody". Editable while it's a draft. */
  body: string;
  status: ContractStatus;
  token: string;
  /** Quote version the prices came from. */
  quoteVersion: number | null;
  sentTo: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  signature: ContractSignature | null;
  /** RecordFile id of the signed PDF. */
  signedFileId: string | null;
  createdBy: string;
  createdAt: string;
}

export interface PublicContract {
  title: string;
  brandName: string;
  companyName: string;
  body: string;
  status: ContractStatus;
  draftTemplate: boolean;
  signature: ContractSignature | null;
  signedPdfUrl: string | null;
}

export interface ContractsApi {
  listContracts(dealId: string): Promise<Contract[]>;
  /** Fills the brand's template from the deal and its latest saved quote. Earlier unsigned drafts are voided. */
  createContract(dealId: string): Promise<Contract>;
  saveContractDraft(id: string, body: string): Promise<void>;
  /** Locks the text and makes the signing link live; returns the link path (/c/:token). */
  sendContract(id: string, to: string): Promise<string>;
  voidContract(id: string): Promise<void>;
  /** Public: no sign-in. Opening it the first time marks it viewed. */
  publicContract(token: string): Promise<PublicContract | null>;
  signContract(token: string, input: { name: string; title: string | null; email: string; agree: boolean }): Promise<PublicContract>;
}
