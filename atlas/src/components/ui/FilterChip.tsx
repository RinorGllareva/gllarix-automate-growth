import { useEffect, useId, useRef, useState } from "react";

export interface ChipOption {
  value: string;
  label: string;
}

interface FilterChipProps {
  label: string;
  /** Summary shown on the chip, e.g. "A, B" or "All lists". */
  summary: string;
  options: ChipOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  /** Ice background when the filter narrows the list. */
  active: boolean;
}

/** Filter chip with a multi-select popover (Leads mockup). */
const FilterChip = ({ label, summary, options, selected, onChange, active }: FilterChipProps) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const toggle = (value: string) =>
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className={`flex h-9 items-center gap-2 border px-3 text-[13px] ${
          active ? "border-ice bg-ice text-ice-ink" : "border-line-strong text-text hover:border-line-button"
        }`}
      >
        <span className="text-[10px] uppercase tracking-[0.2em] opacity-80">{label}</span>
        <span>{summary}</span>
        <span aria-hidden="true">⌄</span>
      </button>
      {open ? (
        <div id={id} role="group" aria-label={`${label} filter`} className="absolute left-0 top-10 z-30 flex max-h-80 min-w-56 flex-col overflow-y-auto border border-line-strong bg-surface py-1">
          {options.map((o) => (
            <label key={o.value} className="flex h-9 cursor-pointer items-center gap-2.5 px-3 text-[13px] text-text-2 hover:bg-surface-2 hover:text-text">
              <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggle(o.value)} className="h-4 w-4 accent-[var(--cyan)]" />
              {o.label}
            </label>
          ))}
          <div className="mt-1 flex justify-between border-t border-line-soft px-3 pb-1 pt-2">
            <button type="button" className="btn-ghost" onClick={() => onChange(options.map((o) => o.value))}>
              All
            </button>
            <button type="button" className="btn-ghost" onClick={() => onChange([])}>
              Clear
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default FilterChip;
