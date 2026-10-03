import { CONTRACT_TEMPLATES, templateFor } from "@/config/contracts";
import { fillContract, signedPdfBlocks } from "@/services/contracts";
import { sha256Hex, textPdf } from "@/services/pdf";
import { formatMoney } from "@/services/pricing";
import type { Contract, ContractsApi, PublicContract } from "../contractTypes";
import type { Activity, Company, Contact, Lead } from "../leadTypes";
import type { Quote } from "../quoteTypes";
import type { RecordFile } from "../recordTypes";
import type { Deal } from "../salesTypes";
import { AccessError, type Notification, type User } from "../types";

export interface ContractsStore {
  deals: Deal[];
  quotes: Quote[];
  leads: Lead[];
  companies: Company[];
  contacts: Contact[];
  files?: RecordFile[];
  contracts?: Contract[];
}

interface Ctx<S extends ContractsStore> {
  load: () => Promise<S>;
  save: () => Promise<void>;
  viewer: () => Promise<User>;
  now: () => number;
  users: User[];
  uid: (p: string) => string;
  audit: (userId: string | null, action: string, entity: string, entityId: string | null, before?: unknown, after?: unknown) => void;
  notify: (n: Omit<Notification, "id" | "createdAt" | "readAt">) => void;
  canSeeDeal: (user: User, d: Deal) => boolean;
  activity: (s: S, a: Omit<Activity, "id" | "at">) => void;
  attachSystemFile: (s: S, entity: "deal", entityId: string, f: Pick<RecordFile, "name" | "size" | "mime" | "url" | "kind">, by: string | null) => RecordFile;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const token = () => Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(16).padStart(2, "0")).join("");

export const createDemoContracts = <S extends ContractsStore>(ctx: Ctx<S>) => {
  const { load, save, viewer, now, users, uid, audit, notify, canSeeDeal, activity, attachSystemFile } = ctx;
  const iso = () => new Date(now()).toISOString();
  const contractsOf = (s: S) => (s.contracts ??= []);
  const sellerOrAdmin = async (s: S, dealId: string) => {
    const user = await viewer();
    if (!["admin", "bdr", "closer"].includes(user.role)) throw new AccessError(403);
    const deal = s.deals.find((d) => d.id === dealId);
    if (!deal) throw new AccessError(404);
    if (!canSeeDeal(user, deal)) throw new AccessError(403);
    return { user, deal };
  };
  const companyOf = (s: S, deal: Deal) => {
    const lead = s.leads.find((l) => l.id === deal.leadId);
    return { lead, company: lead ? s.companies.find((c) => c.id === lead.companyId) : undefined };
  };
  const own = async (id: string) => {
    const s = await load();
    const c = contractsOf(s).find((x) => x.id === id);
    if (!c) throw new AccessError(404);
    const { user, deal } = await sellerOrAdmin(s, c.dealId);
    return { s, c, user, deal };
  };
  const publicView = (s: S, c: Contract): PublicContract => {
    const deal = s.deals.find((d) => d.id === c.dealId)!;
    const { company } = companyOf(s, deal);
    const file = c.signedFileId ? (s.files ?? []).find((f) => f.id === c.signedFileId) : null;
    return {
      title: c.title,
      brandName: deal.brand === "gllarix" ? "Gllarix" : "Arcadian Labs",
      companyName: company?.name ?? "",
      body: c.body,
      status: c.status,
      draftTemplate: CONTRACT_TEMPLATES.find((t) => t.key === c.templateKey)?.draft ?? true,
      signature: c.signature,
      signedPdfUrl: file?.url ?? null,
    };
  };

  const api: ContractsApi = {
    async listContracts(dealId) {
      const s = await load();
      await sellerOrAdmin(s, dealId);
      return contractsOf(s)
        .filter((c) => c.dealId === dealId)
        .sort((a, b) => b.version - a.version);
    },

    async createContract(dealId) {
      const s = await load();
      const { user, deal } = await sellerOrAdmin(s, dealId);
      if (deal.stage === "lost") throw new Error("This deal is lost.");
      const quote = s.quotes.filter((q) => q.dealId === deal.id && q.status !== "superseded").sort((a, b) => b.version - a.version)[0];
      if (!quote) throw new Error("Save a quote first: the contract takes its prices and package from the quote.");
      const { lead, company } = companyOf(s, deal);
      const contact = lead?.primaryContactId ? s.contacts.find((c) => c.id === lead.primaryContactId) : undefined;
      const t = templateFor(deal.brand);
      const m = quote.selection.market;
      const body = fillContract(t, {
        brand: deal.brand,
        client: company?.name ?? "[client]",
        clientPlace: [company?.city, company?.country].filter(Boolean).join(", "),
        country: company?.country ?? null,
        signer: contact ? `${contact.firstName} ${contact.lastName}`.trim() + (contact.title ? `, ${contact.title}` : "") : "",
        setup: formatMoney(quote.setupMinor / 100, m),
        deposit: formatMoney(quote.depositMinor / 100, m),
        monthly: formatMoney(quote.monthlyMinor / 100, m),
        items: quote.lines.map((l) => `${l.q > 1 ? `${l.q} × ` : ""}${l.name}`),
        pilot: quote.selection.pilot,
      });
      const all = contractsOf(s);
      // Only one live contract per deal: unsigned earlier versions are voided.
      for (const c of all) if (c.dealId === deal.id && c.status !== "signed") c.status = "void";
      const contract: Contract = {
        id: uid("ctr"), dealId: deal.id, version: all.filter((c) => c.dealId === deal.id).length + 1, templateKey: t.key, title: t.title, body, status: "draft",
        token: token(), quoteVersion: quote.version, sentTo: null, sentAt: null, viewedAt: null, signature: null, signedFileId: null, createdBy: user.id, createdAt: iso(),
      };
      all.push(contract);
      audit(user.id, "contract.create", "deal", deal.id, null, { contractId: contract.id, quoteVersion: quote.version });
      await save();
      return contract;
    },

    async saveContractDraft(id, body) {
      const { c, user } = await own(id);
      if (c.status !== "draft") throw new Error("Only a draft can be edited. Create a new version to change a sent contract.");
      if (!body.trim()) throw new Error("The contract can't be empty.");
      c.body = body;
      audit(user.id, "contract.edit", "contract", c.id, null, null);
      await save();
    },

    async sendContract(id, to) {
      const { s, c, user, deal } = await own(id);
      if (c.status === "signed" || c.status === "void") throw new Error(`This contract is ${c.status}.`);
      const email = to.trim().toLowerCase();
      if (!EMAIL.test(email)) throw new Error("Enter the signer's email.");
      Object.assign(c, { status: c.status === "draft" ? "sent" : c.status, sentTo: email, sentAt: iso() });
      const { lead, company } = companyOf(s, deal);
      if (lead) activity(s, { leadId: lead.id, userId: user.id, type: "email", title: `Contract sent for signature · ${c.title} v${c.version}`, detail: `To ${email}`, disposition: null, durationS: null });
      audit(user.id, "contract.send", "contract", c.id, null, { to: email, company: company?.name });
      await save();
      return `/c/${c.token}`;
    },

    async voidContract(id) {
      const { c, user } = await own(id);
      if (c.status === "signed") throw new Error("A signed contract can't be voided here. Ask a founder.");
      c.status = "void";
      audit(user.id, "contract.void", "contract", c.id, null, null);
      await save();
    },

    async publicContract(tk) {
      const s = await load();
      const c = contractsOf(s).find((x) => x.token === tk);
      if (!c || c.status === "draft" || c.status === "void") return null;
      if (c.status === "sent") {
        c.status = "viewed";
        c.viewedAt = iso();
        const deal = s.deals.find((d) => d.id === c.dealId)!;
        if (deal.ownerId) notify({ userId: deal.ownerId, type: "task", text: `${companyOf(s, deal).company?.name ?? "The client"} opened the contract`, href: `/deals/${deal.id}` });
        await save();
      }
      return publicView(s, c);
    },

    async signContract(tk, input) {
      const s = await load();
      const c = contractsOf(s).find((x) => x.token === tk);
      if (!c || c.status === "draft" || c.status === "void") throw new AccessError(404, "This signing link isn't valid any more.");
      if (c.status === "signed") throw new Error("This contract is already signed.");
      if (!input.agree) throw new Error('Tick "I agree" to sign.');
      const name = input.name.trim();
      if (name.split(/\s+/).length < 2) throw new Error("Type your full name to sign.");
      const email = input.email.trim().toLowerCase();
      if (!EMAIL.test(email)) throw new Error("Enter your email.");
      const deal = s.deals.find((d) => d.id === c.dealId)!;
      const { lead, company } = companyOf(s, deal);
      const at = iso();
      const signature = { name, title: input.title?.trim() || null, email, at, hash: await sha256Hex(c.body) };
      c.viewedAt ??= at;
      const pdf = textPdf(`${c.title} - ${company?.name ?? ""}`, signedPdfBlocks(c, company?.name ?? "the client", signature));
      const file = attachSystemFile(s, "deal", deal.id, { name: `${c.title} v${c.version} - signed.pdf`, size: Math.round((pdf.length * 3) / 4), mime: "application/pdf", url: `data:application/pdf;base64,${pdf}`, kind: "contract" }, null);
      Object.assign(c, { status: "signed", signature, signedFileId: file.id });
      if (lead) activity(s, { leadId: lead.id, userId: null, type: "note", title: `Contract signed by ${name}`, detail: `${c.title} v${c.version}`, disposition: null, durationS: null });
      users
        .filter((u) => u.active && (u.role === "admin" || u.id === deal.ownerId))
        .forEach((u) => notify({ userId: u.id, type: "payment_paid", text: `${company?.name ?? "A client"} signed the contract`, href: `/deals/${deal.id}` }));
      audit(null, "contract.sign", "contract", c.id, null, { name, email, hash: signature.hash });
      await save();
      return publicView(s, c);
    },
  };

  return { api };
};
