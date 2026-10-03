import { useEffect, useState } from "react";
import { Field } from "@/components/ui/actions";
import { useToast } from "@/components/ui/overlay";
import { SkeletonRows } from "@/components/ui/primitives";
import { data, type CommissionRules, type CompanyProfile, type LegalEntity } from "@/data";

const BRANDS = [
  { key: "gllarix", label: "Gllarix" },
  { key: "arcadian", label: "Arcadian Labs" },
] as const;

/** Settings › Company: the legal details every contract uses instead of the "[to confirm]" placeholders. */
export const CompanySection = () => {
  const toast = useToast();
  const [p, setP] = useState<CompanyProfile | null>(null);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    data.getCompanyProfile().then(setP);
  }, []);
  if (!p) return <SkeletonRows rows={6} />;
  const setEntity = (brand: "gllarix" | "arcadian", patch: Partial<LegalEntity>) => {
    setP({
      ...p,
      entities: { ...p.entities, [brand]: { ...p.entities[brand], ...patch } },
    });
    setDirty(true);
  };
  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await data.saveCompanyProfile(p);
          toast("Company profile saved · new contract drafts use it", "good");
          setDirty(false);
        } catch (err) {
          toast((err as Error).message, "error");
        }
      }}
    >
      <div className="flex flex-col gap-1">
        <h1 className="page-title m-0">Company profile</h1>
        <p className="m-0 max-w-3xl text-[14px] text-text-2">Legal names, addresses and the governing-law clause. Contracts drafted after you save use these; until then they show "[to confirm]".</p>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        {BRANDS.map((b) => (
          <section key={b.key} aria-label={b.label} className="card grid gap-3 p-5 sm:grid-cols-2">
            <span className="text-[15px] font-semibold sm:col-span-2">{b.label}</span>
            <Field label="Legal name" wide>
              <input className="input" value={p.entities[b.key].legalName} onChange={(e) => setEntity(b.key, { legalName: e.target.value })} placeholder={`${b.label} LLC`} />
            </Field>
            <Field label="Registered address" wide>
              <textarea className="input h-auto min-h-16 py-2" value={p.entities[b.key].address} onChange={(e) => setEntity(b.key, { address: e.target.value })} />
            </Field>
            <Field label="Register number">
              <input className="input" value={p.entities[b.key].registration} onChange={(e) => setEntity(b.key, { registration: e.target.value })} />
            </Field>
            <Field label="VAT / tax id">
              <input className="input" value={p.entities[b.key].vatId} onChange={(e) => setEntity(b.key, { vatId: e.target.value })} />
            </Field>
          </section>
        ))}
      </div>
      <section aria-label="Contract terms" className="card grid gap-3 p-5">
        <Field label="Governing-law clause (confirm with your lawyer)">
          <textarea
            className="input h-auto min-h-20 py-2"
            value={p.governingLaw}
            onChange={(e) => (setP({ ...p, governingLaw: e.target.value }), setDirty(true))}
            placeholder="This agreement is governed by the law of … Disputes go first to a good-faith call between the founders and you."
          />
        </Field>
        <Field label="Signs for us">
          <input className="input" value={p.signatory} onChange={(e) => (setP({ ...p, signatory: e.target.value }), setDirty(true))} placeholder="Name, title" />
        </Field>
      </section>
      <button type="submit" className="btn-primary self-start" disabled={!dirty}>
        Save company profile
      </button>
    </form>
  );
};

/** Settings › Commissions: the rule new commission lines are made with. */
export const CommissionsSection = () => {
  const toast = useToast();
  const [r, setR] = useState<CommissionRules | null>(null);
  const [f, setF] = useState({ pct: "", setupMin: "", months: "", bonus: "" });
  useEffect(() => {
    data.getCommissionRules().then((x) => {
      setR(x);
      setF({
        pct: String(Math.round(x.pct * 1000) / 10),
        setupMin: String(x.setupMin),
        months: String(x.months),
        bonus: String(x.meetingBonusMinor / 100),
      });
    });
  }, []);
  if (!r) return <SkeletonRows rows={4} />;
  return (
    <form
      className="flex max-w-2xl flex-col gap-5"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          const next = {
            pct: Number(f.pct) / 100,
            setupMin: Number(f.setupMin),
            months: Number(f.months),
            meetingBonusMinor: Math.round(Number(f.bonus) * 100),
          };
          await data.saveCommissionRules(next);
          setR(next);
          toast("Commission rules saved · they apply to new lines", "good");
        } catch (err) {
          toast((err as Error).message, "error");
        }
      }}
    >
      <div className="flex flex-col gap-1">
        <h1 className="page-title m-0">Commission rules</h1>
        <p className="m-0 text-[14px] text-text-2">Paid only on cash collected, after the 30-day clawback window. Changes apply to new commission lines; lines already made keep their amount.</p>
      </div>
      <section className="card grid gap-4 p-5 sm:grid-cols-2">
        <Field label="Share of setup and monthly fees (%)">
          <input className="input" type="number" min={0} max={50} step={0.5} value={f.pct} onChange={(e) => setF({ ...f, pct: e.target.value })} />
        </Field>
        <Field label="Minimum setup commission">
          <input className="input" type="number" min={0} step={10} value={f.setupMin} onChange={(e) => setF({ ...f, setupMin: e.target.value })} />
        </Field>
        <Field label="Monthly payments that earn it">
          <input className="input" type="number" min={0} max={24} step={1} value={f.months} onChange={(e) => setF({ ...f, months: e.target.value })} />
        </Field>
        <Field label="Bonus per approved meeting (USD)">
          <input className="input" type="number" min={0} step={1} value={f.bonus} onChange={(e) => setF({ ...f, bonus: e.target.value })} />
        </Field>
      </section>
      <span className="text-[12px] text-text-3">
        Now: {Math.round(r.pct * 1000) / 10}% of setup (min {r.setupMin}) and {Math.round(r.pct * 1000) / 10}% of the first {r.months} monthly payments; ${r.meetingBonusMinor / 100} per approved
        meeting. Bonuses never come from AI scores.
      </span>
      <button type="submit" className="btn-primary self-start">
        Save rules
      </button>
    </form>
  );
};
