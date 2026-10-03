import type { ReactNode } from "react";
import { hueTint, hueVar, personHue, pillStyle, type Hue } from "@/config/colors";

export const Icon = ({ d, size = 18, className }: { d: string; size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d={d} />
  </svg>
);

export const ICONS = {
  arrow: "M5 12h14M13 6l6 6-6 6",
  search: "M11 18a7 7 0 1 0 0-14a7 7 0 0 0 0 14M20 20l-4-4",
  bell: "M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0",
  close: "M6 6l12 12M18 6L6 18",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6a3 3 0 0 0 0 6",
  eyeOff: "M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2",
  sun: "M12 16a4 4 0 1 0 0-8a4 4 0 0 0 0 8M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  moon: "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z",
  panel: "M4 5h16v14H4zM9 5v14",
  chevronLeft: "M15 6l-6 6 6 6",
  chevronRight: "M9 6l6 6-6 6",
  list: "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01",
  board: "M4 5h4.5v14H4zM10 5h4.5v9H10zM16 5h4v11h-4z",
  timeline: "M4 6h9M8 12h10M6 18h8",
  workload: "M5 19V11M10 19V6M15 19v-9M20 19v-5",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.7 1.8L21.5 18.5l-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z",
  plus: "M12 5v14M5 12h14",
  more: "M6 12h.01M12 12h.01M18 12h.01",
  inbox: "M4 13l2.5-7h11l2.5 7v6H4zM4 13h5l1 2h4l1-2h5",
  user: "M12 12a4 4 0 1 0 0-8a4 4 0 0 0 0 8M5 20a7 7 0 0 1 14 0",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  clock: "M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18M12 7v5l3 2",
  tag: "M3 12V4h8l9 9-8 8zM7.5 8h.01",
  flag: "M5 21V4M5 4h11l-2 4 2 4H5",
  status: "M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18M12 7v5h4",
};

/** Colored pill for a stage, status or category (config/colors.ts). */
export const Pill = ({ hue, children, dot = false, className = "" }: { hue: Hue; children: ReactNode; dot?: boolean; className?: string }) => (
  <span className={`inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-md border px-2 text-[11px] font-medium leading-none ${className}`} style={pillStyle(hue)}>
    {dot ? <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: hueVar(hue) }} /> : null}
    {children}
  </span>
);

/** Small square color marker. */
export const Dot = ({ hue, size = 8 }: { hue: Hue; size?: number }) => <span className="inline-block shrink-0 rounded-full" style={{ width: size, height: size, background: hueVar(hue) }} />;

/** Initials avatar in the person's color. */
export const Avatar = ({ id, name, size = 24, title, round = true }: { id: string | null | undefined; name: string | null | undefined; size?: number; title?: string; round?: boolean }) => {
  const hue = personHue(id);
  const initials = (name ?? "?")
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      title={title ?? name ?? undefined}
      className={`inline-flex shrink-0 items-center justify-center font-medium leading-none ${round ? "rounded-full" : ""}`}
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.4)), color: hueVar(hue), background: hueTint(hue, 22), border: `1px solid color-mix(in srgb, var(--${hue}) 50%, transparent)` }}
    >
      {initials}
    </span>
  );
};

/** System / Light / Dark switch (user menu). */
export const ThemeSwitch = ({ value, onChange }: { value: "system" | "light" | "dark"; onChange: (v: "system" | "light" | "dark") => void }) => (
  <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 border border-line-strong">
    {(["system", "light", "dark"] as const).map((v) => (
      <button
        key={v}
        type="button"
        role="radio"
        aria-checked={value === v}
        onClick={() => onChange(v)}
        className={`h-8 text-[12px] font-medium ${value === v ? "bg-ice text-ice-ink" : "text-text-2 hover:bg-surface-2 hover:text-text"}`}
      >
        {v}
      </button>
    ))}
  </div>
);

/** Atlas hexagon mark (Sidebar / Login mockups). */
export const AtlasMark = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
    <path d="M12 2.5l8.2 4.75v9.5L12 21.5l-8.2-4.75v-9.5z" />
    <path d="M12 8v8M8 10.3l8 3.4" />
  </svg>
);

export type Tier = "A" | "B" | "C" | "D";

const TIER_CLASS: Record<Tier, string> = {
  A: "border-mint bg-mint-tint text-mint",
  B: "border-cyan bg-cyan-tint text-cyan",
  C: "border-lavender bg-lavender-tint text-lavender",
  D: "border-line-strong bg-surface-2 text-text-3",
};

/** Bordered mono label, e.g. "A 80". */
export const TierBadge = ({ tier, score }: { tier: Tier; score?: number }) => (
  <span
    className={`inline-flex h-6 min-w-10 items-center justify-center rounded-md border px-1.5 font-mono text-[11px] ${TIER_CLASS[tier]}`}
    aria-label={score === undefined ? `Tier ${tier}` : `Tier ${tier}, score ${score}`}
  >
    {tier}
    {score === undefined ? null : ` ${score}`}
  </span>
);

export type Brand = "gllarix" | "arcadian";

export const BrandChip = ({ brand }: { brand: Brand }) => <Pill hue={brand === "gllarix" ? "cyan" : "amber"}>{brand === "gllarix" ? "Gllarix" : "Arcadian"}</Pill>;

export const StageChip = ({ children, hue = "text-3" }: { children: ReactNode; hue?: Hue }) => (
  <Pill hue={hue} dot>
    {children}
  </Pill>
);

export type Status = "on_track" | "watch" | "off_track";

const STATUS: Record<Status, { label: string; hue: Hue }> = {
  on_track: { label: "On track", hue: "mint" },
  watch: { label: "Watch", hue: "amber" },
  off_track: { label: "Off track", hue: "coral" },
};

export const StatusChip = ({ status }: { status: Status }) => (
  <Pill hue={STATUS[status].hue} dot>
    {STATUS[status].label}
  </Pill>
);

export const KpiCard = ({
  index,
  title,
  value,
  caption,
  tone = "text",
}: {
  index?: string;
  title: string;
  value: ReactNode;
  caption?: string;
  tone?: "text" | "mint" | "cyan" | "lavender" | "amber" | "coral";
}) => {
  const toneClass = { text: "text-text", mint: "text-mint", cyan: "text-cyan", lavender: "text-lavender", amber: "text-amber", coral: "text-coral" }[tone];
  return (
    <div className="card flex flex-col gap-2 p-[18px]">
      <div className="flex items-baseline gap-2">
        {index ? <span className="font-mono text-[11px] text-text-3">{index}</span> : null}
        <span className="text-[13px] font-medium text-text-2">{title}</span>
      </div>
      <span className={`text-[28px] font-semibold leading-none tracking-[-0.02em] tabular-nums ${toneClass}`}>{value}</span>
      {caption ? <span className="text-[12px] text-text-3">{caption}</span> : null}
    </div>
  );
};

/** One sentence on why it's empty, plus the next action. */
export const EmptyState = ({ title, action }: { title: string; action?: ReactNode }) => (
  <div className="flex flex-col items-start gap-4 border border-dashed border-line px-6 py-10">
    <p className="m-0 max-w-xl text-[15px] leading-relaxed text-text-2">{title}</p>
    {action}
  </div>
);

export const SkeletonRows = ({ rows = 3 }: { rows?: number }) => (
  <div className="flex flex-col" role="status" aria-label="Loading">
    {Array.from({ length: rows }, (_, i) => (
      <div key={i} className="flex h-[52px] items-center gap-4 border-b border-line-soft px-4">
        <span className="skeleton h-3 w-10" />
        <span className="skeleton h-3 w-56" />
        <span className="skeleton ml-auto h-3 w-24" />
      </div>
    ))}
  </div>
);

export const Toggle = ({
  checked,
  onChange,
  label,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  /** What the switch controls, when the visible label is just "On"/"Off". */
  ariaLabel?: string;
}) => (
  <label className="inline-flex cursor-pointer items-center gap-3 text-[13px] text-text-2">
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={`relative h-[22px] w-10 shrink-0 rounded-full border transition-colors disabled:cursor-not-allowed ${checked ? "border-transparent bg-app" : "border-line-strong bg-inset"}`}
    >
      <span
        className={`absolute top-[2px] h-4 w-4 rounded-full shadow-card transition-[left,background-color] ${checked ? "left-[20px] bg-ice-ink" : "left-[2px] bg-text-3"}`}
      />
    </button>
    {label}
  </label>
);
