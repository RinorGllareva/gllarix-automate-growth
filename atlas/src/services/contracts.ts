import { GOVERNING_LAW, PROVIDER, type ContractTemplate } from "@/config/contracts";
import type { Contract, ContractSignature } from "@/data/contractTypes";
import type { Brand } from "@/data/leadTypes";
import type { PdfBlock } from "./pdf";

export interface ContractVars {
  brand: Brand;
  client: string;
  clientPlace: string;
  country: string | null;
  signer: string;
  /** Pre-formatted money, e.g. "$1,500". */
  setup: string;
  deposit: string;
  monthly: string;
  items: string[];
  pilot: boolean;
}

/** Template + deal facts → the contract text ("## Heading" blocks). Unknown placeholders stay visible. */
export const fillContract = (t: ContractTemplate, v: ContractVars) => {
  const vars: Record<string, string> = {
    provider: PROVIDER[v.brand],
    client: v.client,
    clientPlace: v.clientPlace || "[address to confirm]",
    signer: v.signer || "[the person signing]",
    setup: v.setup,
    deposit: v.deposit,
    monthly: v.monthly,
    items: v.items.length ? v.items.map((i) => `- ${i}`).join("\n") : "- [package to confirm]",
    pilotTerms: v.pilot ? "\nPilot: setup at the pilot rate, monthly at the pilot discount for 12 months, first month free, in exchange for a case study and feedback." : "",
    law: GOVERNING_LAW(v.country),
  };
  const fill = (s: string) => s.replace(/{{(\w+)}}/g, (m, k: string) => vars[k] ?? m);
  return t.sections.map((s) => `## ${s.heading}\n${fill(s.body)}`).join("\n\n");
};

/** "## Heading\nbody" blocks back into sections, for showing and for the PDF. */
export const contractSections = (body: string) =>
  body
    .split(/\n(?=## )/)
    .map((block) => {
      const [first, ...rest] = block.trim().split("\n");
      return first.startsWith("## ") ? { heading: first.slice(3).trim(), body: rest.join("\n").trim() } : { heading: "", body: block.trim() };
    })
    .filter((s) => s.heading || s.body);

/** The signed PDF: the text, the signature, and an audit trail that says what was signed, by whom and when. */
export const signedPdfBlocks = (c: Pick<Contract, "title" | "body" | "sentTo" | "sentAt" | "viewedAt" | "version">, companyName: string, sig: ContractSignature): PdfBlock[] => [
  ...contractSections(c.body).flatMap((s) => [...(s.heading ? [{ text: s.heading, heading: true }] : []), { text: s.body }]),
  { text: "Signature", heading: true },
  { text: `Signed for ${companyName} by ${sig.name}${sig.title ? `, ${sig.title}` : ""} (${sig.email}) on ${sig.at.slice(0, 16).replace("T", " ")} UTC, by typing their name and ticking "I agree".` },
  { text: "Audit trail", heading: true },
  {
    text: [
      `Document: ${c.title}, version ${c.version}`,
      c.sentAt ? `Sent to ${c.sentTo ?? "the client"} on ${c.sentAt.slice(0, 16).replace("T", " ")} UTC` : null,
      c.viewedAt ? `First opened on ${c.viewedAt.slice(0, 16).replace("T", " ")} UTC` : null,
      `Signed on ${sig.at.slice(0, 16).replace("T", " ")} UTC`,
      `SHA-256 of the signed text: ${sig.hash}`,
    ]
      .filter(Boolean)
      .join("\n"),
  },
];
