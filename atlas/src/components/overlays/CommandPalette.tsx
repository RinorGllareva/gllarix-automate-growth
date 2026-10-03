import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/auth/AuthContext";
import { Icon, ICONS } from "@/components/ui/primitives";
import { data, DEAL_STAGE_LABEL, type DealRow } from "@/data";
import { countryLabel } from "@/config/leads";
import { CLEARED_QUERY } from "@/lib/leadQuery";
import { canAccess, navForRole, type PageId } from "@/lib/nav";
import { isMac } from "@/lib/hotkeys";

interface Result {
  id: string;
  label: string;
  meta: string;
  href: string;
}

interface Group {
  name: string;
  items: Result[];
}

const ACTIONS: (Result & { page: PageId })[] = [
  { id: "a-call", label: "Start calling my queue", meta: "G C", href: "/call", page: "call" },
  { id: "a-import", label: "Import a CSV of leads", meta: "I", href: "/leads/import", page: "leads" },
  { id: "a-deal", label: "Create a deal", meta: "D", href: "/deals/new", page: "deals" },
  { id: "a-task", label: "New task", meta: "T", href: "/tasks", page: "tasks" },
  { id: "a-timer", label: "Start timer", meta: "S", href: "/time", page: "time" },
  { id: "a-advisor", label: "Ask the AI co-founder", meta: "A", href: "/advisor", page: "advisor" },
];

const RECENT_KEY = "atlas-recent";
const MAX_PER_GROUP = 5;

const readRecent = (): Result[] => {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as Result[];
  } catch {
    return [];
  }
};

const pushRecent = (r: Result) => {
  try {
    const next = [r, ...readRecent().filter((x) => x.id !== r.id)].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // storage blocked: recents are a convenience only
  }
};

const matches = (q: string, r: Result) => {
  const hay = `${r.label} ${r.meta}`.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => hay.includes(word));
};

interface CommandPaletteProps {
  initialQuery: string;
  onClose: () => void;
}

const CommandPalette = ({ initialQuery, onClose }: CommandPaletteProps) => {
  const user = useUser();
  const navigate = useNavigate();
  const [query, setQuery] = useState(initialQuery);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [leadHits, setLeadHits] = useState<Result[]>([]);
  const [taskHits, setTaskHits] = useState<Result[]>([]);
  const [recordHits, setRecordHits] = useState<{ deals: Result[]; clients: Result[]; meetings: Result[]; docs: Result[] }>({ deals: [], clients: [], meetings: [], docs: [] });
  // Deals and clients are loaded once per palette and filtered locally; meetings are searched on the source.
  const cache = useRef<{ deals?: Promise<DealRow[]>; clients?: Promise<{ id: string; companyName: string; status: string; href: string }[]>; docs?: Promise<{ id: string; title: string; icon: string | null }[]> }>({});

  // Record search: deals, clients and meetings this person can see (the source applies the same access as each page).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setRecordHits({ deals: [], clients: [], meetings: [], docs: [] });
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(async () => {
      if (canAccess(user.role, "deals")) cache.current.deals ??= data.listDeals().catch(() => []);
      if (canAccess(user.role, "clients")) cache.current.clients ??= data.clientsOverview().then((o) => o.cards, () => []);
      if (canAccess(user.role, "docs")) cache.current.docs ??= data.listDocs().then((h) => h.docs, () => []);
      const [deals, clients, meetings, docs] = await Promise.all([
        cache.current.deals ?? Promise.resolve([] as DealRow[]),
        cache.current.clients ?? Promise.resolve([]),
        canAccess(user.role, "meetings") ? data.searchMeetings(q).catch(() => []) : Promise.resolve([]),
        cache.current.docs ?? Promise.resolve([]),
      ]);
      if (cancelled) return;
      const hit = (text: string) => matches(q, { id: "", label: text, meta: "", href: "" });
      const when = (iso: string) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: user.timezone }).format(new Date(iso));
      setRecordHits({
        deals: deals
          .filter((r) => hit(`${r.company.name} ${r.contactName ?? ""} ${r.deal.brand}`))
          .slice(0, MAX_PER_GROUP)
          .map((r) => ({ id: `d-${r.deal.id}`, label: r.company.name, meta: DEAL_STAGE_LABEL[r.deal.stage], href: `/deals/${r.deal.id}` })),
        clients: clients
          .filter((c) => hit(c.companyName))
          .slice(0, MAX_PER_GROUP)
          .map((c) => ({ id: `c-${c.id}`, label: c.companyName, meta: c.status, href: c.href })),
        docs: docs
          .filter((d) => hit(d.title))
          .slice(0, MAX_PER_GROUP)
          .map((d) => ({ id: `doc-${d.id}`, label: `${d.icon ?? "📄"} ${d.title}`, meta: "Doc", href: `/docs/${d.id}` })),
        meetings: meetings.slice(0, MAX_PER_GROUP).map((m) => ({ id: `m-${m.meeting.id}`, label: `${m.company.name} · ${m.meeting.withWhom}`, meta: when(m.meeting.scheduledAt), href: `/meetings/${m.meeting.id}` })),
      });
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [query, user.role, user.timezone]);

  // Task search (A15): titles of tasks this person can see.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || !canAccess(user.role, "tasks")) {
      setTaskHits([]);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      data
        .searchTasks(q)
        .then((rows) => {
          if (!cancelled) setTaskHits(rows.slice(0, MAX_PER_GROUP).map((r) => ({ id: `t-${r.task.id}`, label: r.task.title, meta: `${r.spaceName} / ${r.listName}`, href: `/tasks/${r.task.id}` })));
        })
        .catch(() => setTaskHits([]));
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [query, user.role]);

  // Record search: leads by company, phone (any format) or domain. Respects the same access as the Leads list.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || !canAccess(user.role, "leads")) {
      setLeadHits([]);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      data
        .listLeads({ ...CLEARED_QUERY, q, sort: "score", dir: "desc", page: 1 })
        .then((page) => {
          if (cancelled) return;
          setLeadHits(
            page.rows.slice(0, MAX_PER_GROUP).map((r) => ({
              id: `l-${r.lead.id}`,
              label: `${r.company.name} · ${r.company.city ?? countryLabel(r.company.country)}`,
              meta: `${r.lead.tier} ${r.lead.score}`,
              href: `/leads/${r.lead.id}`,
            })),
          );
        })
        .catch(() => setLeadHits([]));
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [query, user.role]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const groups = useMemo<Group[]>(() => {
    const pages: Result[] = navForRole(user.role).map((p) => ({
      id: `p-${p.id}`,
      label: p.label,
      meta: `G ${p.key}`,
      href: p.path,
    }));
    const actions = ACTIONS.filter((a) => canAccess(user.role, a.page) && (a.id !== "a-import" || user.role === "admin"));
    const q = query.trim();
    const all: Group[] = q
      ? [
          { name: "Leads", items: leadHits },
          { name: "Deals", items: recordHits.deals },
          { name: "Clients", items: recordHits.clients },
          { name: "Meetings", items: recordHits.meetings },
          { name: "Docs", items: recordHits.docs },
          { name: "Tasks", items: taskHits },
          { name: "Pages", items: pages.filter((r) => matches(q, r)).slice(0, MAX_PER_GROUP) },
          { name: "Actions", items: actions.filter((r) => matches(q, r)).slice(0, MAX_PER_GROUP) },
        ]
      : [
          { name: "Recent", items: readRecent().filter((r) => pages.some((p) => p.href === r.href) || actions.some((a) => a.id === r.id)) },
          { name: "Actions", items: actions },
          { name: "Pages", items: pages },
        ];
    return all.filter((g) => g.items.length);
  }, [query, user.role, leadHits, taskHits, recordHits]);

  const flat = groups.flatMap((g) => g.items);
  const current = Math.min(active, Math.max(flat.length - 1, 0));

  const open = (r: Result, newTab: boolean) => {
    pushRecent(r);
    if (newTab) window.open(r.href, "_blank", "noopener");
    else navigate(r.href);
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((current + 1) % Math.max(flat.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((current - 1 + flat.length) % Math.max(flat.length, 1));
    } else if (e.key === "Enter" && flat[current]) {
      e.preventDefault();
      open(flat[current], e.metaKey || e.ctrlKey);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  let index = -1;

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-bg-deep/80 px-4 pt-24" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="flex max-h-[70vh] w-full max-w-[700px] flex-col self-start border border-line-strong rounded-lg bg-surface"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <label className="flex h-16 shrink-0 items-center gap-3 border-b border-line px-5">
          <Icon d={ICONS.search} className="text-cyan" />
          <input
            ref={inputRef}
            type="search"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-results"
            aria-activedescendant={flat[current] ? `palette-${flat[current].id}` : undefined}
            aria-label="Search or run a command"
            placeholder="Search or run a command"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            className="min-w-0 flex-1 border-0 bg-transparent font-sans text-[20px] font-light text-text outline-none placeholder:text-text-3"
          />
          <span className="border border-line-strong px-1.5 py-0.5 font-mono text-[11px] text-label">ESC</span>
        </label>

        <div id="palette-results" role="listbox" className="min-h-0 overflow-y-auto">
          {groups.length ? (
            groups.map((g) => (
              <div key={g.name} className="flex flex-col gap-0.5 border-b border-line-soft px-2 py-3">
                <span className="px-3 pb-2 pt-1 text-[12px] font-medium text-text-3">{g.name}</span>
                {g.items.map((r) => {
                  index += 1;
                  const isActive = index === current;
                  const myIndex = index;
                  return (
                    <button
                      key={`${g.name}-${r.id}`}
                      id={`palette-${r.id}`}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      onMouseMove={() => setActive(myIndex)}
                      onClick={(e) => open(r, e.metaKey || e.ctrlKey)}
                      className={`flex h-11 items-center gap-3 px-3 text-left text-[14px] ${
                        isActive ? "bg-ice text-ice-ink" : "text-text"
                      }`}
                    >
                      <span>{r.label}</span>
                      <span className="ml-auto font-mono text-[11px] opacity-70">{r.meta}</span>
                    </button>
                  );
                })}
              </div>
            ))
          ) : (
            <p className="m-0 px-5 py-6 text-[14px] text-text-2">
              Nothing matches "{query}". Search finds leads, deals, clients, meetings, docs, tasks and pages.
            </p>
          )}
        </div>

        <div className="flex shrink-0 gap-5 px-5 py-3 text-[11px] text-text-3">
          <span>↑↓ move</span>
          <span>↵ open</span>
          <span>{isMac() ? "⌘↵" : "Ctrl ↵"} open in new tab</span>
        </div>
      </section>
    </div>
  );
};

export default CommandPalette;
