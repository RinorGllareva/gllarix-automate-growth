/**
 * Small chart kit (dataviz rules): one y-axis, recessive grid, thin marks with 4px rounded data ends, 2px gaps between
 * stacked segments, hover tooltips with hit areas wider than the marks, a legend for ≥ 2 series plus direct end labels,
 * and text in text tokens (never the series color). Series colors come from --chart-1 / --chart-2 (validated per theme).
 */
import { useEffect, useRef, useState, type ReactNode } from "react";

const useWidth = (fallback = 640) => {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => e && e.contentRect.width > 0 && setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
};

/** 0, then 3–4 round steps up to the max (and down to the min when negative). */
const ticks = (min: number, max: number) => {
  const span = Math.max(1, max - Math.min(0, min));
  const raw = span / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const lo = Math.min(0, Math.floor(min / step) * step);
  const hi = Math.max(step, Math.ceil(max / step) * step);
  const out: number[] = [];
  for (let v = lo; v <= hi + 1e-9; v += step) out.push(Math.round(v));
  return out;
};

export const Legend = ({ items }: { items: { name: string; color: string; dashed?: boolean }[] }) => (
  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-text-2">
    {items.map((i) => (
      <span key={i.name} className="flex items-center gap-1.5">
        <span className="inline-block h-0 w-4 rounded-full" style={{ borderTop: `2px ${i.dashed ? "dashed" : "solid"} ${i.color}` }} aria-hidden="true" />
        {i.name}
      </span>
    ))}
  </div>
);

const Tip = ({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) => (
  <div
    role="tooltip"
    className="pointer-events-none absolute z-10 min-w-[150px] rounded-lg border border-line-strong bg-surface px-3 py-2 text-[12px] shadow-pop"
    style={{ left: Math.min(Math.max(0, x - 75), width - 170), top: Math.max(0, y - 8), transform: "translateY(-100%)" }}
  >
    {children}
  </div>
);

export interface BarDatum {
  key: string;
  label: string;
  /** Stacked from the baseline up; use one segment for a single series. */
  segments: { name: string; value: number; color: string }[];
}

/** Vertical bars (single or stacked). Negative single values hang below zero. */
export const BarChart = ({
  data,
  height = 200,
  format,
  reference,
  tooltip,
  ariaLabel,
}: {
  data: BarDatum[];
  height?: number;
  format: (v: number) => string;
  reference?: { value: number; label: string };
  tooltip: (d: BarDatum) => ReactNode;
  ariaLabel: string;
}) => {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const totals = data.map((d) => d.segments.reduce((n, s) => n + s.value, 0));
  const t = ticks(Math.min(0, ...totals, reference?.value ?? 0), Math.max(0, ...totals, reference?.value ?? 0));
  const lo = t[0];
  const hi = t[t.length - 1];
  const padL = 56;
  const padB = 22;
  const plotH = height - padB - 8;
  const y = (v: number) => 8 + ((hi - v) / (hi - lo)) * plotH;
  const colW = (width - padL) / Math.max(1, data.length);
  const barW = Math.max(6, Math.min(36, colW * 0.5));
  return (
    <div ref={ref} className="relative w-full" onMouseLeave={() => setHover(null)}>
      <svg width={width} height={height} role="img" aria-label={ariaLabel} className="block overflow-visible">
        {t.map((v) => (
          <g key={v}>
            <line x1={padL} x2={width} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={v === 0 ? 1.5 : 1} />
            <text x={padL - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill="var(--text-3)" className="tabular-nums">
              {format(v)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = padL + colW * i + colW / 2;
          let base = 0;
          const total = totals[i];
          return (
            <g key={d.key} onMouseEnter={() => setHover(i)}>
              <rect x={padL + colW * i} y={0} width={colW} height={height} fill={hover === i ? "var(--surface-2)" : "transparent"} opacity={0.6} />
              {total < 0 && d.segments.length === 1 ? (
                <path d={roundedDown(cx - barW / 2, y(0), barW, y(total) - y(0))} fill={d.segments[0].color} />
              ) : (
                d.segments.map((s, si) => {
                  if (s.value <= 0) return null;
                  const top = y(base + s.value);
                  const bottom = y(base);
                  base += s.value;
                  const last = d.segments.slice(si + 1).every((x) => x.value <= 0);
                  const h = Math.max(0, bottom - top - (si > 0 ? 2 : 0));
                  return last ? <path key={s.name} d={roundedUp(cx - barW / 2, top, barW, h)} fill={s.color} /> : <rect key={s.name} x={cx - barW / 2} y={top} width={barW} height={h} fill={s.color} />;
                })
              )}
              <text x={cx} y={height - 6} textAnchor="middle" fontSize={11} fill={hover === i ? "var(--text)" : "var(--text-3)"}>
                {d.label}
              </text>
            </g>
          );
        })}
        {reference ? (
          <g>
            <line x1={padL} x2={width} y1={y(reference.value)} y2={y(reference.value)} stroke="var(--text-3)" strokeDasharray="4 4" strokeWidth={1.5} />
            <text x={padL + 4} y={y(reference.value) - 5} fontSize={11} fill="var(--text-2)" paintOrder="stroke" stroke="var(--surface)" strokeWidth={3}>
              {reference.label}
            </text>
          </g>
        ) : null}
      </svg>
      {hover !== null ? (
        <Tip x={padL + colW * hover + colW / 2} y={y(Math.max(0, totals[hover]))} width={width}>
          {tooltip(data[hover])}
        </Tip>
      ) : null}
    </div>
  );
};

const roundedUp = (x: number, y: number, w: number, h: number) => {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
};
const roundedDown = (x: number, y: number, w: number, h: number) => {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y}V${y + h - r}Q${x},${y + h} ${x + r},${y + h}H${x + w - r}Q${x + w},${y + h} ${x + w},${y + h - r}V${y}Z`;
};

export interface LineSeries {
  name: string;
  color: string;
  values: (number | null)[];
  dashed?: boolean;
}

/** Lines over shared x labels, with a crosshair and one tooltip for every series at that point. */
export const LineChart = ({
  labels,
  series,
  height = 220,
  format,
  reference,
  ariaLabel,
  tickLabel = (l: string) => l,
}: {
  labels: string[];
  /** Short form for the axis (e.g. "Oct"); the tooltip shows the full label. */
  tickLabel?: (label: string) => string;
  series: LineSeries[];
  height?: number;
  format: (v: number) => string;
  reference?: { value: number; label: string };
  ariaLabel: string;
}) => {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const t = ticks(Math.min(0, ...all), Math.max(1, ...all, reference?.value ?? 0));
  const lo = t[0];
  const hi = t[t.length - 1];
  const padL = 56;
  const padR = 64; // room for the end labels
  const padB = 22;
  const plotH = height - padB - 8;
  const x = (i: number) => padL + (labels.length <= 1 ? 0 : (i / (labels.length - 1)) * (width - padL - padR));
  const y = (v: number) => 8 + ((hi - v) / (hi - lo)) * plotH;
  const path = (vals: (number | null)[]) => {
    let d = "";
    vals.forEach((v, i) => {
      if (v === null) return;
      d += `${d && vals[i - 1] !== null && vals[i - 1] !== undefined ? "L" : "M"}${x(i)},${y(v)}`;
    });
    return d;
  };
  return (
    <div
      ref={ref}
      className="relative w-full"
      onMouseLeave={() => setHover(null)}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const i = Math.round(((px - padL) / Math.max(1, width - padL - padR)) * (labels.length - 1));
        setHover(Math.max(0, Math.min(labels.length - 1, i)));
      }}
    >
      <svg width={width} height={height} role="img" aria-label={ariaLabel} className="block overflow-visible">
        {t.map((v) => (
          <g key={v}>
            <line x1={padL} x2={width - padR} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={v === 0 ? 1.5 : 1} />
            <text x={padL - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill="var(--text-3)">
              {format(v)}
            </text>
          </g>
        ))}
        {labels.map((l, i) => {
          const every = (width - padL - padR) / Math.max(1, labels.length - 1) < 34 ? 2 : 1;
          return i % every === 0 ? (
            <text key={l} x={x(i)} y={height - 6} textAnchor="middle" fontSize={11} fill={hover === i ? "var(--text)" : "var(--text-3)"}>
              {tickLabel(l)}
            </text>
          ) : null;
        })}
        {reference ? (
          <g>
            <line x1={padL} x2={width - padR} y1={y(reference.value)} y2={y(reference.value)} stroke="var(--text-3)" strokeDasharray="4 4" strokeWidth={1.5} />
            <text x={width - padR + 6} y={y(reference.value) + 4} fontSize={11} fill="var(--text-2)">
              {reference.label}
            </text>
          </g>
        ) : null}
        {hover !== null ? <line x1={x(hover)} x2={x(hover)} y1={8} y2={8 + plotH} stroke="var(--line-strong)" strokeWidth={1} /> : null}
        {series.map((s) => {
          const lastI = s.values.reduce<number>((acc, v, i) => (v !== null ? i : acc), -1);
          return (
            <g key={s.name}>
              <path d={path(s.values)} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dashed ? "5 4" : undefined} strokeLinejoin="round" strokeLinecap="round" />
              {/* A point with no neighbours draws no line: show it as a marker. */}
              {s.values.map((v, i) =>
                v !== null && (s.values[i - 1] ?? null) === null && (s.values[i + 1] ?? null) === null ? <circle key={i} cx={x(i)} cy={y(v)} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} /> : null,
              )}
              {hover !== null && s.values[hover] !== null ? <circle cx={x(hover)} cy={y(s.values[hover]!)} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} /> : null}
              {lastI >= 0 ? (
                <text x={x(lastI) + 8} y={y(s.values[lastI]!) + 4} fontSize={11} fill="var(--text-2)">
                  {format(s.values[lastI]!)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {hover !== null ? (
        <Tip x={x(hover)} y={8} width={width}>
          <div className="pb-1 font-medium text-text">{labels[hover]}</div>
          {series.map((s) =>
            s.values[hover] !== null ? (
              <div key={s.name} className="flex items-center justify-between gap-4 text-text-2">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                  {s.name}
                </span>
                <span className="num text-text">{format(s.values[hover]!)}</span>
              </div>
            ) : null,
          )}
        </Tip>
      ) : null}
    </div>
  );
};
