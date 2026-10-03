import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { AtlasMark } from "@/components/ui/primitives";
import { BY_ID, MARKETS } from "@/config/priceBook";
import { data, type PublicQuote } from "@/data";
import { formatMoney } from "@/services/pricing";

/** Public quote page (/q/:token): summary, inclusions, caps, terms; accept, then pay the deposit. ?print=1 opens the print dialog (save as PDF). */
const QuotePage = () => {
  const { token = "" } = useParams();
  const [params] = useSearchParams();
  const [pq, setPq] = useState<PublicQuote | null | undefined>(undefined);
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => data.publicQuote(token).then(setPq), [token]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (pq && params.get("print") === "1") window.setTimeout(() => window.print(), 300);
  }, [pq, params]);

  if (pq === undefined) return <div className="min-h-screen bg-bg-deep" />;
  if (pq === null)
    return (
      <div className="min-h-screen bg-bg-deep px-6 py-10 text-text">
        <p className="mx-auto max-w-2xl text-[16px] text-text-2">This quote isn't available. Ask us for a fresh link.</p>
      </div>
    );

  const q = pq.quote;
  const m = MARKETS[q.selection.market];
  const fmt = (minor: number) => formatMoney(minor / 100, q.selection.market);
  const rec = q.selection.tiers.rec ? BY_ID[q.selection.tiers.rec] : null;

  const accept = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await data.acceptQuote(token, name);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const pay = async () => {
    setBusy(true);
    try {
      const session = await data.startCheckout(token);
      window.location.assign(session.url);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-deep px-6 py-10 text-text print:bg-white print:text-black sm:px-12">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <div className="flex items-center gap-3">
          <AtlasMark size={28} />
          <span className="text-[15px] font-medium tracking-[0.28em]">{pq.brands.map((b) => (b === "gllarix" ? "GLLARIX" : "ARCADIAN")).join(" × ")}</span>
        </div>
        <div className="flex flex-col gap-2">
          <span className="label-caps">
            Quote v{q.version} · {m.label} · prices in {m.currency}, excluding VAT
          </span>
          <h1 className="page-title m-0 leading-tight">{pq.companyName}</h1>
          {pq.contactName ? <span className="text-[14px] text-text-2">For {pq.contactName}{pq.ownerName ? ` · from ${pq.ownerName}` : ""}</span> : null}
        </div>

        <section aria-label="What's included" className="border border-line">
          {q.lines.map((l) => (
            <div key={l.id} className="flex flex-col gap-1 border-b border-line-soft px-5 py-3.5 last:border-b-0">
              <span className="text-[14px]">
                {l.name}
                {l.q > 1 ? ` × ${l.q}` : ""}
              </span>
              {BY_ID[l.id]?.note ? <span className="text-[13px] text-text-2">{BY_ID[l.id].note}</span> : null}
            </div>
          ))}
        </section>

        <section aria-label="Price" className="grid gap-4 sm:grid-cols-3">
          <div className="border border-line p-4">
            <span className="label-caps">Setup</span>
            <div className="num mt-2 text-[28px] font-light">{fmt(q.setupMinor)}</div>
            <span className="text-[12px] text-text-3">50% at signing · 50% at launch</span>
          </div>
          <div className="border border-line p-4">
            <span className="label-caps">Monthly</span>
            <div className="num mt-2 text-[28px] font-light">{fmt(q.monthlyMinor)}</div>
            <span className="text-[12px] text-text-3">{q.selection.billing === "annual" ? "Prepaid yearly, 12 for 10" : q.selection.pilot ? "First month free" : "From launch"}</span>
          </div>
          <div className="border border-line p-4">
            <span className="label-caps">First year</span>
            <div className="num mt-2 text-[28px] font-light">{fmt(q.firstYearMinor)}</div>
            <span className="text-[12px] text-text-3">{rec ? "Before any extra minutes" : " "}</span>
          </div>
        </section>

        {rec ? (
          <p className="m-0 text-[14px] text-text-2">
            Includes {rec.mins?.toLocaleString("en-US")} minutes of AI calls per month; extra minutes at {m.symbol}
            {q.selection.overRate.toFixed(2)} per minute, billed in arrears.
          </p>
        ) : null}
        {pq.notIncluded ? <p className="m-0 text-[14px] text-text-2">{pq.notIncluded}</p> : null}

        <section aria-label="Terms" className="flex flex-col gap-2">
          <span className="label-caps">Terms</span>
          <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-[14px] text-text-2">
            {pq.terms.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>

        <div className="print:hidden">
          {pq.expired ? (
            <p className="m-0 text-[14px] text-coral">This quote has expired. Reply to our email and we'll send a fresh one.</p>
          ) : q.status === "paid" ? (
            <p className="m-0 text-[16px] text-mint">Deposit received. Thank you! We'll be in touch about onboarding.</p>
          ) : q.acceptedAt ? (
            <div className="flex flex-col gap-3">
              <p className="m-0 text-[14px] text-text-2">
                Accepted by {q.acceptedByName}. The next step is the {fmt(q.depositMinor)} deposit (50% of setup).
              </p>
              <button type="button" className="btn-primary self-start" disabled={busy} onClick={pay}>
                Pay the {fmt(q.depositMinor)} deposit →
              </button>
            </div>
          ) : (
            <form onSubmit={accept} className="flex max-w-md flex-col gap-4">
              <label className="flex flex-col gap-2">
                <span className="field-label">Your full name</span>
                <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="flex items-start gap-3 text-[14px] text-text-2">
                <input type="checkbox" required checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--cyan)]" />
                I accept this quote and its terms on behalf of {pq.companyName}.
              </label>
              <button type="submit" className="btn-primary self-start" disabled={busy || !agree || !name.trim()}>
                Accept quote
              </button>
            </form>
          )}
          {error ? (
            <p role="alert" className="m-0 mt-3 text-[14px] text-coral">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default QuotePage;
