import { useEffect, useState } from "react";
import {
  BrandChip,
  EmptyState,
  KpiCard,
  SkeletonRows,
  StageChip,
  StatusChip,
  TierBadge,
  Toggle,
} from "@/components/ui/primitives";
import { Drawer, Modal, Toast, useToast } from "@/components/ui/overlay";
import FilterChip from "@/components/ui/FilterChip";

/** Swatches read their hex from the live CSS variables, so drift from tokens.css is visible. */
const SWATCHES = [
  ["Ground", "--bg"],
  ["Surface", "--surface"],
  ["Hairline", "--line"],
  ["Text", "--text"],
  ["Secondary", "--text-2"],
  ["Muted", "--text-3"],
  ["Ice (active)", "--ice"],
  ["Cyan · Gllarix", "--cyan"],
  ["Mint · good", "--mint"],
  ["Lavender", "--lavender"],
  ["Amber · Arcadian", "--amber"],
  ["Coral · stop", "--coral"],
] as const;

const Swatch = ({ name, variable }: { name: string; variable: string }) => {
  const [hex, setHex] = useState("");
  useEffect(() => {
    setHex(getComputedStyle(document.documentElement).getPropertyValue(variable).trim().toUpperCase());
  }, [variable]);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="h-14 border border-line" style={{ background: `var(${variable})` }} />
      <span className="text-[12px]">{name}</span>
      <span className="font-mono text-[11px] text-text-3">{hex || variable}</span>
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section aria-label={title} className="flex flex-col gap-4">
    <span className="label-caps">{title}</span>
    {children}
  </section>
);

const StyleGuide = () => {
  const toast = useToast();
  const [modal, setModal] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [toggle, setToggle] = useState(true);
  const [chips, setChips] = useState<string[]>(["A", "B"]);

  return (
    <div className="flex flex-col gap-9">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-3.5 text-[11px] uppercase tracking-[0.3em] text-label">
            <span className="h-px w-12 bg-cyan-line" />
            <span>Atlas UI · matches gllarix.com</span>
          </div>
          <h1 className="m-0 text-[56px] font-light leading-none tracking-[-0.03em]">Style guide</h1>
        </div>
        <span className="text-[13px] text-text-2">Geist + Geist Mono · square corners · 1 px hairlines · dark only</span>
      </div>

      <div className="grid gap-10 xl:grid-cols-[1.1fr_1fr_1fr]">
        <Section title="Color">
          <div className="grid grid-cols-3 gap-2.5">
            {SWATCHES.map(([name, v]) => (
              <Swatch key={v} name={name} variable={v} />
            ))}
          </div>
        </Section>

        <Section title="Type">
          <span className="text-[56px] font-light leading-none tracking-[-0.03em]">Display 56</span>
          <span className="page-title">Page title 40</span>
          <span className="text-[24px] font-light">Section 24 light</span>
          <span className="text-[15px] leading-relaxed text-text-2">
            Body 15 regular. Plain, short sentences. Secondary text uses the secondary token.
          </span>
          <span className="label-caps">Label 11 · tracked caps</span>
          <span className="num text-[14px]">$1,780 · 07:42 · A 80 · Mono for numbers</span>
        </Section>

        <Section title="Components">
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary">
              Primary →
            </button>
            <button type="button" className="btn-outline">
              Outline →
            </button>
            <button type="button" className="btn-danger">
              Danger
            </button>
          </div>
          <label className="flex flex-col gap-2">
            <span className="field-label">Input</span>
            <input className="input" defaultValue="Ridgeway Heating & Air" />
          </label>
          <label className="flex flex-col gap-2">
            <span className="field-label">Select</span>
            <select className="input" defaultValue="trades">
              <option value="trades">Trades</option>
              <option value="developers">Developers</option>
            </select>
          </label>
          <div className="flex flex-wrap items-center gap-6">
            <label className="inline-flex items-center gap-2.5 text-[13px] text-text-2">
              <input type="checkbox" defaultChecked className="h-4 w-4 accent-[var(--ice)]" />
              Checkbox
            </label>
            <Toggle checked={toggle} onChange={setToggle} label="Toggle" />
          </div>
          <div className="flex items-center gap-2">
            <TierBadge tier="A" score={80} />
            <TierBadge tier="B" score={55} />
            <TierBadge tier="C" score={38} />
            <TierBadge tier="D" score={12} />
            <span className="text-[12px] text-text-3">Tiers A–D</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <BrandChip brand="gllarix" />
            <BrandChip brand="arcadian" />
            <StageChip>Meeting booked</StageChip>
            <StatusChip status="on_track" />
            <StatusChip status="watch" />
            <StatusChip status="off_track" />
          </div>
        </Section>
      </div>

      <div className="grid gap-10 lg:grid-cols-2 2xl:grid-cols-3">
        <Section title="KPI card">
          <KpiCard index="01" title="Connect rate" value="30–40%" caption="Label under the number" tone="mint" />
        </Section>

        <Section title="Table row">
          <div className="card">
            <div className="grid h-[52px] grid-cols-[56px_1fr_120px] items-center gap-3 border-b border-line-soft px-4 text-[13px]">
              <TierBadge tier="A" score={78} />
              <span>
                Summit Roofing Co. <span className="text-text-3">· Atlanta, GA</span>
              </span>
              <span className="num text-right text-text-2">07:42 local</span>
            </div>
            <div className="grid h-[52px] grid-cols-[56px_1fr_120px] items-center gap-3 bg-surface-2 px-4 text-[13px]">
              <TierBadge tier="B" score={55} />
              <span>
                Summerfield Plumbing <span className="text-text-3">· Tulsa, OK</span>
              </span>
              <span className="num text-right text-text-2">06:42 local</span>
            </div>
          </div>
        </Section>

        <Section title="Navigation">
          <span className="flex h-11 items-center gap-3 bg-ice px-3.5 text-[14px] text-ice-ink">
            Active menu item<span className="ml-auto">→</span>
          </span>
          <span className="flex h-11 items-center gap-3 px-3.5 text-[14px] text-text-2">Inactive menu item</span>
          <div className="flex flex-wrap gap-2">
            <FilterChip label="Tier" summary={chips.length ? chips.join(", ") : "All"} options={["A", "B", "C", "D"].map((t) => ({ value: t, label: `Tier ${t}` }))} selected={chips} onChange={setChips} active={chips.length > 0} />
            <FilterChip label="List" summary="All lists" options={[{ value: "trades", label: "Trades" }]} selected={[]} onChange={() => undefined} active={false} />
          </div>
        </Section>
      </div>

      <div className="grid gap-10 lg:grid-cols-2 2xl:grid-cols-3">
        <Section title="Feedback">
          <Toast tone="good">Meeting booked · Harbor Air Services</Toast>
          <button type="button" className="btn-outline self-start" onClick={() => toast("Saved · changes are live", "good")}>
            Show a toast
          </button>
        </Section>

        <Section title="Empty and loading">
          <EmptyState
            title="No leads match these filters. Clear a filter or import a CSV."
            action={
              <button type="button" className="btn-outline">
                Import CSV →
              </button>
            }
          />
          <div className="card">
            <SkeletonRows rows={2} />
          </div>
        </Section>

        <Section title="Overlays">
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-outline" onClick={() => setModal(true)}>
              Open modal
            </button>
            <button type="button" className="btn-outline" onClick={() => setDrawer(true)}>
              Open side drawer
            </button>
          </div>
        </Section>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Modal">
        <p className="m-0 mb-5 text-[14px] text-text-2">Modals hold one decision. Esc or the close button dismisses them.</p>
        <div className="flex gap-2">
          <button type="button" className="btn-primary" onClick={() => setModal(false)}>
            Confirm →
          </button>
          <button type="button" className="btn-outline" onClick={() => setModal(false)}>
            Cancel
          </button>
        </div>
      </Modal>
      <Drawer open={drawer} onClose={() => setDrawer(false)} title="Side drawer">
        <p className="m-0 p-5 text-[14px] text-text-2">Drawers show detail without leaving the page, like the audit diff.</p>
      </Drawer>
    </div>
  );
};

export default StyleGuide;
