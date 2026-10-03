import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/overlay";
import { Pill } from "@/components/ui/primitives";
import { data, type Contract, type ContractStatus } from "@/data";
import { tableDate } from "@/lib/format";
import { contractSections } from "@/services/contracts";

const STATUS: Record<ContractStatus, { label: string; hue: "text-3" | "blue" | "cyan" | "mint" | "coral" }> = {
  draft: { label: "Draft", hue: "text-3" },
  sent: { label: "Sent", hue: "blue" },
  viewed: { label: "Opened", hue: "cyan" },
  signed: { label: "Signed", hue: "mint" },
  void: { label: "Void", hue: "coral" },
};

/**
 * Deal › Contract: fill the agreement from the latest quote, check or edit the draft, send the signing link,
 * and find the signed PDF (also on the client's files).
 */
const ContractPanel = ({ dealId, canEdit, contactEmail, hasQuote }: { dealId: string; canEdit: boolean; contactEmail: string | null; hasQuote: boolean }) => {
  const toast = useToast();
  const [list, setList] = useState<Contract[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [to, setTo] = useState(contactEmail ?? "");
  const load = useCallback(() => data.listContracts(dealId).then(setList, () => setList([])), [dealId]);
  useEffect(() => {
    load();
  }, [load]);
  if (!list) return null;
  const current = list.find((c) => c.status !== "void") ?? null;
  const run = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn();
      toast(msg, "good");
      load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const link = current ? `${location.origin}/c/${current.token}` : "";

  if (!current)
    return (
      <div className="flex flex-col items-start gap-3 text-[13px]">
        <span className="text-text-2">
          {hasQuote ? "Fill the agreement from the latest quote: package, prices, pilot terms and service levels." : "Save a quote first. The contract takes its package and prices from it."}
        </span>
        {canEdit ? (
          <button type="button" className="btn-primary" disabled={!hasQuote} onClick={() => run(() => data.createContract(dealId), "Contract drafted from the quote")}>
            Create contract
          </button>
        ) : null}
        {list.length ? <span className="text-[12px] text-text-3">{list.length} earlier version{list.length > 1 ? "s" : ""} voided.</span> : null}
      </div>
    );

  return (
    <div className="flex flex-col gap-4 text-[13px]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">
          {current.title} v{current.version}
        </span>
        <Pill hue={STATUS[current.status].hue} dot>
          {STATUS[current.status].label}
        </Pill>
        <span className="text-text-3">
          {current.signature
            ? `Signed by ${current.signature.name} · ${tableDate(current.signature.at)}`
            : current.viewedAt
              ? `Opened ${tableDate(current.viewedAt)}`
              : current.sentAt
                ? `Sent to ${current.sentTo} · ${tableDate(current.sentAt)}`
                : `From quote v${current.quoteVersion}`}
        </span>
      </div>

      {editing !== null ? (
        <div className="flex flex-col gap-2">
          <textarea aria-label="Contract text" className="input h-auto min-h-[320px] py-3 font-mono text-[12px] leading-relaxed" value={editing} onChange={(e) => setEditing(e.target.value)} />
          <span className="text-[12px] text-text-3">Each section starts with "## Heading". Keep [brackets] until the detail is confirmed.</span>
          <div className="flex gap-2">
            <button type="button" className="btn-primary" onClick={() => run(() => data.saveContractDraft(current.id, editing), "Draft saved").then(() => setEditing(null))}>
              Save draft
            </button>
            <button type="button" className="btn-outline" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <details className="rounded-lg border border-line bg-surface">
          <summary className="cursor-pointer px-4 py-2.5 text-text-2">Read the contract</summary>
          <div className="flex max-h-[360px] flex-col gap-3 overflow-y-auto px-4 pb-4">
            {contractSections(current.body).map((s, i) => (
              <div key={i}>
                <span className="block font-medium">{s.heading}</span>
                <span className="block whitespace-pre-wrap text-text-2">{s.body}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {canEdit && current.status !== "signed" && editing === null ? (
        <div className="flex flex-col gap-3">
          {current.status === "draft" ? (
            <button type="button" className="btn-outline self-start" onClick={() => setEditing(current.body)}>
              Edit the text
            </button>
          ) : null}
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex min-w-[240px] flex-1 flex-col gap-1.5">
              <span className="field-label">Signer's email</span>
              <input className="input" type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="owner@client.example" />
            </label>
            <button type="button" className="btn-primary" onClick={() => run(() => data.sendContract(current.id, to), current.status === "draft" ? "Signing link ready" : "Signing link sent again")}>
              {current.status === "draft" ? "Send for signature" : "Send again"}
            </button>
          </div>
          {current.status !== "draft" ? (
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md bg-inset px-2.5 py-1.5 text-[12px] text-text-2">{link}</code>
              <button
                type="button"
                className="btn-outline h-8 text-[12px]"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(link);
                    toast("Signing link copied", "good");
                  } catch {
                    toast(link, "info");
                  }
                }}
              >
                Copy link
              </button>
              <a href={link} target="_blank" rel="noreferrer" className="btn-ghost h-8 text-[12px]">
                Open ↗
              </a>
            </div>
          ) : null}
          <div className="flex gap-2">
            <button type="button" className="btn-ghost text-[12px]" onClick={() => run(() => data.createContract(dealId), "New version drafted from the latest quote")}>
              Redo from the latest quote
            </button>
            <button type="button" className="btn-ghost text-[12px] text-coral" onClick={() => run(() => data.voidContract(current.id), "Contract voided")}>
              Void
            </button>
          </div>
        </div>
      ) : null}
      {current.status === "signed" ? <span className="text-[12px] text-text-3">The signed PDF with its audit trail is in the deal's and the client's files.</span> : null}
    </div>
  );
};

export default ContractPanel;
