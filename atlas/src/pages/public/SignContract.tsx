import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { AtlasMark } from "@/components/ui/primitives";
import { data, type PublicContract } from "@/data";
import { contractSections } from "@/services/contracts";

/**
 * Public signing page (/c/:token): the contract text, then sign by typing a full name and ticking "I agree".
 * No account, no password and no payment details are asked for here.
 */
const SignContract = () => {
  const { token = "" } = useParams();
  const [c, setC] = useState<PublicContract | null | undefined>(undefined);
  const [f, setF] = useState({ name: "", title: "", email: "", agree: false });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => data.publicContract(token).then(setC, () => setC(null)), [token]);
  useEffect(() => {
    load();
  }, [load]);

  if (c === undefined) return <div className="min-h-screen bg-bg-deep" />;
  if (c === null)
    return (
      <div className="min-h-screen bg-bg-deep px-6 py-10 text-text">
        <p className="mx-auto max-w-2xl text-[16px] text-text-2">This signing link isn't valid any more. Ask us for a fresh one.</p>
      </div>
    );

  const sign = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setC(await data.signContract(token, { name: f.name, title: f.title || null, email: f.email, agree: f.agree }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-deep px-4 py-10 text-text sm:px-12">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <div className="flex items-center gap-3">
          <AtlasMark size={28} />
          <span className="text-[15px] font-medium">{c.brandName}</span>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[13px] text-text-3">Agreement for {c.companyName}</span>
          <h1 className="page-title m-0 leading-tight">{c.title}</h1>
          {c.draftTemplate ? (
            <p className="m-0 rounded-lg border border-amber/40 bg-amber/5 px-3.5 py-2.5 text-[13px] text-text-2">
              Draft wording: our lawyer still reviews this template. Parts in [brackets] are being confirmed. Reply to us with any question before you sign.
            </p>
          ) : null}
        </div>

        <article className="card flex flex-col gap-5 p-6 text-[14px] leading-relaxed">
          {contractSections(c.body).map((s, i) => (
            <section key={i} className="flex flex-col gap-1.5">
              {s.heading ? <h2 className="m-0 text-[15px] font-semibold">{s.heading}</h2> : null}
              <p className="m-0 whitespace-pre-wrap text-text-2">{s.body}</p>
            </section>
          ))}
        </article>

        {c.status === "signed" && c.signature ? (
          <section aria-label="Signed" className="card flex flex-col gap-2 border-mint/40 p-6">
            <span className="text-[16px] font-semibold text-mint">Signed. Thank you.</span>
            <span className="text-[14px] text-text-2">
              Signed by {c.signature.name}
              {c.signature.title ? `, ${c.signature.title}` : ""} on {new Date(c.signature.at).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" })}.
            </span>
            {c.signedPdfUrl ? (
              <a href={c.signedPdfUrl} download={`${c.title} - signed.pdf`} className="btn-primary self-start">
                Download the signed PDF
              </a>
            ) : null}
            <span className="break-all text-[11px] text-text-3">Fingerprint of the signed text (SHA-256): {c.signature.hash}</span>
          </section>
        ) : (
          <form onSubmit={sign} className="card flex flex-col gap-4 p-6" aria-label="Sign the agreement">
            <span className="text-[16px] font-semibold">Sign</span>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="field-label">Full name</span>
                <input className="input" required autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="field-label">Your role (optional)</span>
                <input className="input" autoComplete="organization-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="field-label">Email (we send the signed copy here)</span>
                <input className="input" type="email" required autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
              </label>
            </div>
            {f.name.trim() ? (
              <div className="rounded-lg border border-line bg-surface px-4 py-3">
                <span className="block text-[11px] text-text-3">Your signature</span>
                <span className="font-serif text-[26px] italic">{f.name}</span>
              </div>
            ) : null}
            <label className="flex items-start gap-2.5 text-[13px]">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--mint)]" checked={f.agree} onChange={(e) => setF({ ...f, agree: e.target.checked })} />
              <span>I agree to this agreement on behalf of {c.companyName}, and that typing my name here is my electronic signature.</span>
            </label>
            {error ? (
              <p role="alert" className="m-0 text-[13px] text-coral">
                {error}
              </p>
            ) : null}
            <button type="submit" className="btn-primary self-start" disabled={busy || !f.agree || !f.name.trim()}>
              {busy ? "Signing…" : "Sign the agreement"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default SignContract;
