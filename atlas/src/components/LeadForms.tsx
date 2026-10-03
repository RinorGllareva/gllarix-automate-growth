import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Field, useRun } from "@/components/ui/actions";
import { Modal, useToast } from "@/components/ui/overlay";
import { INDUSTRY_LABEL, LIST_LABEL, type ListType } from "@/config/leads";
import { COUNTRY_RULES } from "@/config/countryRules";
import { data, type Brand, type Company } from "@/data";

const COUNTRIES = Object.keys(COUNTRY_RULES).sort();

/**
 * "+ New lead": the minimum to start calling. Duplicates (same phone, website, or name in the same city) open the
 * existing lead instead of creating a second one. `onCreated` lets Deals continue straight into a deal.
 */
export const NewLeadModal = ({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated?: (leadId: string) => void }) => {
  const toast = useToast();
  const navigate = useNavigate();
  const blank = { company: "", phone: "", website: "", country: "US", city: "", industry: "", listType: "trades" as ListType, brand: "gllarix" as Brand, firstName: "", lastName: "", title: "", email: "" };
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof blank) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal open={open} onClose={onClose} title="New lead" width={600}>
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const r = await data.createLead({
              company: f.company,
              phone: f.phone || null,
              website: f.website || null,
              country: f.country || null,
              city: f.city || null,
              industry: f.industry || null,
              listType: f.listType,
              brand: f.brand,
              contact: f.firstName.trim() ? { firstName: f.firstName, lastName: f.lastName, title: f.title || null, email: f.email || null, phone: null } : null,
            });
            toast(r.duplicateOf ? "Already a lead: opening it" : `${f.company} added`, r.duplicateOf ? "info" : "good");
            setF(blank);
            onClose();
            if (onCreated) onCreated(r.leadId);
            else navigate(`/leads/${r.leadId}`);
          } catch (err) {
            toast((err as Error).message, "error");
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Company" wide>
          <input className="input" required autoFocus value={f.company} onChange={set("company")} />
        </Field>
        <Field label="Phone">
          <input className="input" type="tel" value={f.phone} onChange={set("phone")} placeholder="+1 813 555 0100" />
        </Field>
        <Field label="Website">
          <input className="input" value={f.website} onChange={set("website")} placeholder="acme.com" />
        </Field>
        <Field label="Country">
          <select className="input" value={f.country} onChange={set("country")}>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {c === "GB" ? "UK" : c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="City">
          <input className="input" value={f.city} onChange={set("city")} />
        </Field>
        <Field label="List">
          <select className="input" value={f.listType} onChange={(e) => setF({ ...f, listType: e.target.value as ListType, brand: e.target.value === "trades" ? "gllarix" : "arcadian", industry: "" })}>
            {Object.entries(LIST_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Industry">
          <select className="input" value={f.industry} onChange={set("industry")}>
            <option value="">Not sure</option>
            {Object.entries(INDUSTRY_LABEL)
              .filter(([k]) => (f.listType === "developers") === (k === "property_developer"))
              .map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
          </select>
        </Field>
        <fieldset className="m-0 grid gap-4 rounded-lg border border-line p-3 sm:col-span-2 sm:grid-cols-2">
          <legend className="px-1 text-[12px] text-text-3">Contact (optional)</legend>
          <Field label="First name">
            <input className="input" value={f.firstName} onChange={set("firstName")} />
          </Field>
          <Field label="Last name">
            <input className="input" value={f.lastName} onChange={set("lastName")} />
          </Field>
          <Field label="Role">
            <input className="input" value={f.title} onChange={set("title")} placeholder="Owner" />
          </Field>
          <Field label="Email">
            <input className="input" type="email" value={f.email} onChange={set("email")} />
          </Field>
        </fieldset>
        <span className="text-[12px] text-text-3 sm:col-span-2">Scored straight away. If the company is already in Atlas, you'll land on the existing lead.</span>
        <button type="submit" className="btn-primary sm:col-span-2" disabled={busy || !f.company.trim()}>
          Add lead
        </button>
      </form>
    </Modal>
  );
};

/** Edit the company behind a lead: everything the header shows. */
export const CompanyEditModal = ({ leadId, company, onClose, onSaved }: { leadId: string; company: Company; onClose: () => void; onSaved: () => void }) => {
  const run = useRun();
  const [f, setF] = useState({
    name: company.name,
    industry: company.industry ?? "",
    phone: company.phone ?? "",
    domain: company.domain ?? "",
    city: company.city ?? "",
    region: company.region ?? "",
    country: company.country ?? "",
    listType: company.listType,
    brands: company.brandInterest,
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal open onClose={onClose} title={`Edit · ${company.name}`} width={600}>
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await run(
            () =>
              data.updateCompany(leadId, {
                name: f.name,
                industry: f.industry || null,
                phone: f.phone || null,
                domain: f.domain || null,
                city: f.city || null,
                region: f.region || null,
                country: f.country || null,
                listType: f.listType,
                brandInterest: f.brands.length ? f.brands : company.brandInterest,
              }),
            "Company saved · rescored",
          );
          if (ok) {
            onSaved();
            onClose();
          }
        }}
      >
        <Field label="Company" wide>
          <input className="input" required value={f.name} onChange={set("name")} />
        </Field>
        <Field label="Phone">
          <input className="input" type="tel" value={f.phone} onChange={set("phone")} />
        </Field>
        <Field label="Website">
          <input className="input" value={f.domain} onChange={set("domain")} />
        </Field>
        <Field label="City">
          <input className="input" value={f.city} onChange={set("city")} />
        </Field>
        <Field label="Region / state">
          <input className="input" value={f.region} onChange={set("region")} />
        </Field>
        <Field label="Country">
          <select className="input" value={f.country} onChange={set("country")}>
            <option value="">Unknown</option>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {c === "GB" ? "UK" : c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Industry">
          <select className="input" value={f.industry} onChange={set("industry")}>
            <option value="">Not set</option>
            {Object.entries(INDUSTRY_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="List">
          <select className="input" value={f.listType} onChange={(e) => setF({ ...f, listType: e.target.value as ListType })}>
            {Object.entries(LIST_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <fieldset className="m-0 flex items-center gap-4 border-0 p-0 text-[13px]">
          <legend className="field-label mb-1.5">Interested in</legend>
          {(["gllarix", "arcadian"] as const).map((b) => (
            <label key={b} className="flex items-center gap-2">
              <input type="checkbox" checked={f.brands.includes(b)} onChange={(e) => setF({ ...f, brands: e.target.checked ? [...f.brands, b] : f.brands.filter((x) => x !== b) })} />
              {b === "gllarix" ? "Gllarix" : "Arcadian"}
            </label>
          ))}
        </fieldset>
        <button type="submit" className="btn-primary sm:col-span-2">
          Save company
        </button>
      </form>
    </Modal>
  );
};
