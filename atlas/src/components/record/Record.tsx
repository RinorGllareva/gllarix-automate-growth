import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useUser } from "@/auth/AuthContext";
import { Avatar, Icon } from "@/components/ui/primitives";
import { data, type AtlasEvent } from "@/data";
import { timelineDate } from "@/lib/format";

/**
 * The one record layout (docs/pages/00-PAGE-STANDARD.md §2): breadcrumb, title, status and actions, a property row,
 * tabs on the left, the next step and key facts on the right. Used as a full page and in a side panel.
 */
// Written out in full so Tailwind sees every class.
const SIDE_COLS = {
  xl: { 300: "xl:grid-cols-[minmax(0,1fr)_300px]", 340: "xl:grid-cols-[minmax(0,1fr)_340px]", 380: "xl:grid-cols-[minmax(0,1fr)_380px]" },
  "2xl": { 300: "2xl:grid-cols-[minmax(0,1fr)_300px]", 340: "2xl:grid-cols-[minmax(0,1fr)_340px]", 380: "2xl:grid-cols-[minmax(0,1fr)_380px]" },
} as const;

export interface RecordTab {
  id: string;
  label: string;
  count?: number;
  content: ReactNode;
}

export const RecordPage = ({
  breadcrumb = [],
  title,
  status,
  actions,
  properties,
  tabs,
  side,
  sideWidth = 300,
  sideFrom = "xl",
  panel = false,
}: {
  breadcrumb?: { label: string; to?: string }[];
  title: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
  properties?: ReactNode;
  tabs: RecordTab[];
  side?: ReactNode;
  /** Width of the right column on wide screens (the deal's price panel needs more). */
  sideWidth?: 300 | 340 | 380;
  /** From which screen width the side column sits on the right ("2xl" when the page already has a list on the left). */
  sideFrom?: "xl" | "2xl";
  /** In a side panel: tabs live in local state, one column. */
  panel?: boolean;
}) => {
  const [params, setParams] = useSearchParams();
  const [local, setLocal] = useState(tabs[0]?.id ?? "");
  const fromUrl = params.get("tab");
  const current = (panel ? local : fromUrl) ?? tabs[0]?.id;
  const active = tabs.find((t) => t.id === current) ?? tabs[0];
  const pick = (id: string) => {
    if (panel) return setLocal(id);
    const next = new URLSearchParams(params);
    if (id === tabs[0]?.id) next.delete("tab");
    else next.set("tab", id);
    setParams(next, { replace: true });
  };
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-col gap-2">
        {breadcrumb.length ? (
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-[12px] text-text-3">
            {breadcrumb.map((b, i) => (
              <span key={i} className="flex items-center gap-1">
                {b.to ? (
                  <Link to={b.to} className="hover:text-text">
                    {b.label}
                  </Link>
                ) : (
                  <span>{b.label}</span>
                )}
                <span aria-hidden="true">/</span>
              </span>
            ))}
          </nav>
        ) : null}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-2">
            {status ? <div className="flex flex-wrap items-center gap-2">{status}</div> : null}
            <h1 className={`m-0 font-semibold leading-tight tracking-[-0.01em] ${panel ? "text-[20px]" : "page-title"}`}>{title}</h1>
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
        {properties}
      </div>
      <div className={`grid items-start gap-6 ${side && !panel ? SIDE_COLS[sideFrom][sideWidth] : ""}`}>
        <div className="flex min-w-0 flex-col gap-4">
          {tabs.length > 1 ? (
            <div role="tablist" aria-label="Record sections" className="flex gap-6 overflow-x-auto border-b border-line text-[13px]">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  type="button"
                  aria-selected={t.id === active?.id}
                  onClick={() => pick(t.id)}
                  className={`-mb-px whitespace-nowrap border-b pb-2.5 ${t.id === active?.id ? "border-ice text-text" : "border-transparent text-text-3 hover:text-text-2"}`}
                >
                  {t.label}
                  {t.count ? <span className="ml-1.5 font-mono text-[11px] text-text-3">{t.count}</span> : null}
                </button>
              ))}
            </div>
          ) : null}
          <div role={tabs.length > 1 ? "tabpanel" : undefined}>{active?.content}</div>
        </div>
        {side ? <aside className="flex flex-col gap-4 self-start">{side}</aside> : null}
      </div>
    </div>
  );
};

/** One property in the row: small label above, value below. Put an inline editor in `value` to edit in place. */
export const PropertyRow = ({ items }: { items: { label: string; value: ReactNode; hidden?: boolean }[] }) => (
  <div className="flex flex-wrap items-start gap-x-8 gap-y-3 border-y border-line-soft py-3">
    {items
      .filter((i) => !i.hidden)
      .map((i) => (
        <div key={i.label} className="flex min-w-0 flex-col gap-1">
          <span className="text-[12px] text-text-3">{i.label}</span>
          <span className="flex min-h-7 items-center text-[13px]">{i.value}</span>
        </div>
      ))}
  </div>
);

/** A select that looks like text until you open it: edit a property in place. */
export const InlineSelect = <V extends string>({ label, value, options, onChange }: { label: string; value: V; options: { value: V; label: string; disabled?: boolean }[]; onChange: (v: V) => void }) => (
  <select aria-label={label} className="h-7 max-w-[200px] cursor-pointer truncate rounded-md border-0 bg-transparent px-0 text-[13px] text-text hover:bg-surface-2" value={value} onChange={(e) => onChange(e.target.value as V)}>
    {options.map((o) => (
      <option key={o.value} value={o.value} disabled={o.disabled}>
        {o.label}
      </option>
    ))}
  </select>
);

/** "The one thing to do on this record now." */
export const NextStepCard = ({ text, action }: { text: string; action?: ReactNode }) => (
  <section aria-label="Next step" className="card flex flex-col gap-2 border-ice/30 p-4">
    <span className="flex items-center gap-1.5 text-[12px] font-medium text-cyan">
      <Icon d="M5 12h14M13 6l6 6-6 6" size={13} /> Next step
    </span>
    <span className="text-[13px]">{text}</span>
    {action}
  </section>
);

/** Linked records as a small list, with "+ link / + create". */
export const RelatedList = ({ title, items, empty, action }: { title: string; items: { id: string; label: string; sub?: string; to?: string }[]; empty?: string; action?: ReactNode }) => (
  <section aria-label={title} className="card flex flex-col gap-2 p-4">
    <span className="flex items-center justify-between gap-2">
      <span className="text-[12px] font-medium text-text-3">
        {title}
        {items.length ? <span className="ml-1.5 font-mono">{items.length}</span> : null}
      </span>
      {action}
    </span>
    {items.map((i) =>
      i.to ? (
        <Link key={i.id} to={i.to} className="flex flex-col text-[13px] hover:text-cyan">
          <span className="truncate">{i.label}</span>
          {i.sub ? <span className="truncate text-[12px] text-text-3">{i.sub}</span> : null}
        </Link>
      ) : (
        <span key={i.id} className="flex flex-col text-[13px]">
          <span className="truncate">{i.label}</span>
          {i.sub ? <span className="truncate text-[12px] text-text-3">{i.sub}</span> : null}
        </span>
      ),
    )}
    {!items.length ? <span className="text-[12px] text-text-3">{empty ?? "Nothing linked yet."}</span> : null}
  </section>
);

const VERB: Record<string, string> = {
  create: "created",
  add: "added",
  update: "updated",
  delete: "deleted",
  restore: "restored",
  reply: "replied",
  note: "added a note",
  assign: "reassigned",
  field_update: "changed a field",
  import: "imported",
};

/** "ticket.update" + payload → "updated · priority: urgent". */
export const describeEvent = (e: AtlasEvent) => {
  const verb = e.type.split(".").slice(1).join(".") || e.type;
  const text = VERB[verb] ?? verb.replace(/_/g, " ");
  const p = e.payload;
  let detail = "";
  if (p && typeof p === "object" && !Array.isArray(p)) {
    const parts = Object.entries(p as Record<string, unknown>)
      .filter(([, v]) => v === null || ["string", "number", "boolean"].includes(typeof v))
      .slice(0, 4)
      .map(([k, v]) => `${k.replace(/([A-Z])/g, " $1").toLowerCase()}: ${v === null ? "—" : String(v).slice(0, 60)}`);
    detail = parts.join(" · ");
  }
  return { text, detail };
};

/**
 * Every record's history from the events table: who did what and when. Pages with their own timeline (calls, emails)
 * pass those as `extra` so it all reads as one list.
 */
export const ActivityTimeline = ({
  entity,
  id,
  extra = [],
  reloadKey,
}: {
  entity: string;
  id: string;
  extra?: { id: string; at: string; who: string | null; text: string; detail?: string }[];
  reloadKey?: unknown;
}) => {
  const user = useUser();
  const [events, setEvents] = useState<AtlasEvent[] | null>(null);
  const [mine, setMine] = useState(false);
  useEffect(() => {
    data.recordEvents(entity, id).then(setEvents, () => setEvents([]));
  }, [entity, id, reloadKey]);
  const items = useMemo(() => {
    const fromEvents = (events ?? []).map((e) => ({ id: e.id, at: e.at, who: e.actorName, whoId: e.actor, ...describeEvent(e) }));
    return [...fromEvents, ...extra.map((x) => ({ ...x, whoId: null as string | null, detail: x.detail ?? "" }))]
      .filter((x) => !mine || x.whoId === user.id)
      .sort((a, b) => b.at.localeCompare(a.at));
  }, [events, extra, mine, user.id]);
  if (!events) return <span className="text-[13px] text-text-3">Loading the history…</span>;
  return (
    <section aria-label="Activity" className="flex flex-col gap-3">
      <label className="flex items-center gap-2 self-end text-[12px] text-text-2">
        <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />
        Only mine
      </label>
      <ol className="m-0 flex list-none flex-col gap-0 p-0">
        {items.map((x) => (
          <li key={x.id} className="flex gap-3 border-l border-line pb-3 pl-4 text-[13px] last:pb-0">
            <span className="-ml-[21px] mt-1.5 h-2 w-2 shrink-0 rounded-full bg-line-strong" aria-hidden="true" />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span>
                {x.who ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Avatar id={x.whoId ?? x.who} name={x.who} size={18} />
                    <span className="font-medium">{x.who.split(" ")[0]}</span>
                  </span>
                ) : (
                  <span className="font-medium text-text-2">Atlas</span>
                )}{" "}
                <span className="text-text-2">{x.text}</span>
              </span>
              {x.detail ? <span className="truncate text-[12px] text-text-3">{x.detail}</span> : null}
            </span>
            <span className="shrink-0 font-mono text-[11px] text-text-3">{timelineDate(x.at, user.timezone)}</span>
          </li>
        ))}
      </ol>
      {!items.length ? <span className="text-[13px] text-text-3">No history yet. Changes made from now on show here.</span> : null}
    </section>
  );
};
