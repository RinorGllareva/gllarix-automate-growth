import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useUser } from "@/auth/AuthContext";
import { usePageChrome } from "@/components/shell/PageChrome";
import FilterChip from "@/components/ui/FilterChip";
import { Modal, useToast } from "@/components/ui/overlay";
import { Avatar, EmptyState, Pill, SkeletonRows, TierBadge } from "@/components/ui/primitives";
import { hueVar, LEAD_STAGE_HUE } from "@/config/colors";

/** Overdue in coral, due today in blue, later in the normal text color. */
const nextHue = (at: string | null) => {
  if (!at) return "var(--text-3)";
  const t = new Date(at).getTime();
  const endOfDay = new Date().setHours(23, 59, 59, 999);
  return t < Date.now() - 3_600_000 ? hueVar("coral") : t <= endOfDay ? hueVar("blue") : "var(--text)";
};
import { countryLabel, industryLabel, LIST_LABEL, OPEN_STAGES, STAGE_CHIP, STAGE_LABEL, STAGES, type ListType } from "@/config/leads";
import { data, PAGE_SIZE, type LeadPage, type LeadQuery, type LeadRow, type SortKey, type Source, type User } from "@/data";
import { DataTable } from "@/components/DataTable";
import { count, downloadText, localTime, nextActionText, since } from "@/lib/format";
import { CLEARED_QUERY, parseLeadQuery, serializeLeadQuery } from "@/lib/leadQuery";
import { QUEUE } from "@/config/queue";

const summarize = (selected: string[], labels: Record<string, string>, all: string) =>
  !selected.length ? all : selected.length <= 2 ? selected.map((v) => labels[v] ?? v).join(", ") : `${selected.length} selected`;

const LeadsList = () => {
  const user = useUser();
  const isAdmin = user.role === "admin";
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const query = useMemo(() => parseLeadQuery(params), [params]);

  const [page, setPage] = useState<LeadPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [facets, setFacets] = useState<{ countries: string[]; sources: Source[] }>({ countries: [], sources: [] });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignOpen, setAssignOpen] = useState(false);
  const [cadenceOpen, setCadenceOpen] = useState(false);
  const [search, setSearch] = useState(query.q);
  const lastClicked = useRef<number | null>(null);

  const setQuery = useCallback(
    (patch: Partial<LeadQuery>) => {
      const next = { ...query, page: 1, ...patch };
      setParams(serializeLeadQuery(next), { replace: true });
    },
    [query, setParams],
  );

  const load = useCallback(() => {
    setError(null);
    data
      .listLeads(query)
      .then(setPage)
      .catch((e: Error) => setError(e.message));
  }, [query]);

  useEffect(load, [load]);
  useEffect(() => {
    data.listUsers().then(setUsers);
    data.leadFacets().then(setFacets).catch(() => undefined);
  }, []);
  // Debounced quick search into the URL.
  useEffect(() => {
    if (search === query.q) return;
    const t = window.setTimeout(() => setQuery({ q: search }), 250);
    return () => window.clearTimeout(t);
  }, [search, query.q, setQuery]);

  usePageChrome(
    page
      ? { context: `${count(page.visibleTotal)} leads · ${count(page.visibleAB)} tier A/B` }
      : null,
  );

  const owners = users.filter((u) => ["admin", "bdr", "closer"].includes(u.role) && u.active);
  const ownerLabels = Object.fromEntries([["none", "Unassigned"], ...users.map((u) => [u.id, u.name])]);
  const sourceLabels = Object.fromEntries(facets.sources.map((s) => [s.id, s.name]));
  const stageLabels = Object.fromEntries(STAGES.map((s) => [s, STAGE_LABEL[s]]));
  const isOpenStages = query.stages.length === OPEN_STAGES.length && OPEN_STAGES.every((s) => query.stages.includes(s));

  const onSort = (key: SortKey) =>
    setQuery({ sort: key, dir: query.sort === key ? (query.dir === "desc" ? "asc" : "desc") : key === "company" || key === "owner" || key === "next" ? "asc" : "desc", page: query.page });

  const rows = page?.rows ?? [];
  const toggleRow = (index: number, shift: boolean) => {
    const next = new Set(selected);
    const id = rows[index].lead.id;
    const turnOn = !next.has(id);
    if (shift && lastClicked.current !== null) {
      const [a, b] = [Math.min(lastClicked.current, index), Math.max(lastClicked.current, index)];
      for (let i = a; i <= b; i += 1) {
        if (turnOn) next.add(rows[i].lead.id);
        else next.delete(rows[i].lead.id);
      }
    } else if (turnOn) next.add(id);
    else next.delete(id);
    lastClicked.current = index;
    setSelected(next);
  };
  const pageIds = rows.map((r) => r.lead.id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  const runBulk = async (action: () => Promise<string>) => {
    try {
      toast(await action(), "good");
      setSelected(new Set());
      load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const pages = page ? Math.max(1, Math.ceil(page.total / PAGE_SIZE)) : 1;
  const filtersNarrow = [query.tiers, query.lists, query.countries, query.stages, query.owners, query.sources, query.brands].some((f) => f.length > 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="page-title m-0">Leads</h1>
        <div className="flex flex-wrap items-center gap-2">
          {selected.size ? <span className="mr-2 text-[12px] text-text-2">{count(selected.size)} selected</span> : null}
          {isAdmin ? (
            <button type="button" className="btn-outline h-9 text-[11px]" disabled={!selected.size} onClick={() => setAssignOpen(true)}>
              Assign
            </button>
          ) : null}
          <button type="button" className="btn-outline h-9 text-[11px]" disabled={!selected.size} onClick={() => setCadenceOpen(true)}>
            Add to cadence
          </button>
          {isAdmin ? (
            <>
              <button
                type="button"
                className="btn-outline h-9 text-[11px]"
                disabled={!selected.size}
                onClick={() => runBulk(async () => `Rescored ${count(await data.rescore([...selected]))} leads`)}
              >
                Rescore
              </button>
              <button
                type="button"
                className="btn-outline h-9 text-[11px]"
                disabled={!selected.size}
                onClick={() =>
                  runBulk(async () => {
                    const csv = await data.exportLeads([...selected]);
                    downloadText(`atlas-leads-${new Date().toISOString().slice(0, 10)}.csv`, csv);
                    return `Exported ${count(selected.size)} leads · logged in the audit log`;
                  })
                }
              >
                Export CSV
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-9 w-60 items-center rounded-lg border border-line-strong bg-inset px-3 focus-within:border-cyan">
          <span className="sr-only">Quick search</span>
          <input
            type="search"
            placeholder="Company, phone or domain"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border-0 bg-transparent text-[13px] text-text outline-none placeholder:text-text-3"
          />
        </label>
        <FilterChip
          label="Tier"
          summary={summarize(query.tiers, {}, "All")}
          options={["A", "B", "C", "D"].map((t) => ({ value: t, label: `Tier ${t}` }))}
          selected={query.tiers}
          onChange={(v) => setQuery({ tiers: v as LeadQuery["tiers"] })}
          active={query.tiers.length > 0}
        />
        <FilterChip
          label="List"
          summary={summarize(query.lists, LIST_LABEL, "All lists")}
          options={(["trades", "developers"] as ListType[]).map((l) => ({ value: l, label: LIST_LABEL[l] }))}
          selected={query.lists}
          onChange={(v) => setQuery({ lists: v as ListType[] })}
          active={query.lists.length > 0}
        />
        <FilterChip
          label="Country"
          summary={summarize(query.countries, Object.fromEntries(facets.countries.map((c) => [c, countryLabel(c)])), "All")}
          options={facets.countries.map((c) => ({ value: c, label: countryLabel(c) }))}
          selected={query.countries}
          onChange={(v) => setQuery({ countries: v })}
          active={query.countries.length > 0}
        />
        <FilterChip
          label="Stage"
          summary={isOpenStages ? "Open" : summarize(query.stages, stageLabels, "All")}
          options={STAGES.map((s) => ({ value: s, label: STAGE_LABEL[s] }))}
          selected={query.stages}
          onChange={(v) => setQuery({ stages: v as LeadQuery["stages"] })}
          active={query.stages.length > 0 && !isOpenStages}
        />
        {isAdmin ? (
          <FilterChip
            label="Owner"
            summary={summarize(query.owners, ownerLabels, "Anyone")}
            options={[...owners.map((u) => ({ value: u.id, label: u.name })), { value: "none", label: "Unassigned" }]}
            selected={query.owners}
            onChange={(v) => setQuery({ owners: v })}
            active={query.owners.length > 0}
          />
        ) : null}
        <FilterChip
          label="Source"
          summary={summarize(query.sources, sourceLabels, "All")}
          options={facets.sources.map((s) => ({ value: s.id, label: s.name }))}
          selected={query.sources}
          onChange={(v) => setQuery({ sources: v })}
          active={query.sources.length > 0}
        />
        <FilterChip
          label="Brand"
          summary={summarize(query.brands, { gllarix: "Gllarix", arcadian: "Arcadian" }, "Both")}
          options={[
            { value: "gllarix", label: "Gllarix" },
            { value: "arcadian", label: "Arcadian" },
          ]}
          selected={query.brands}
          onChange={(v) => setQuery({ brands: v as LeadQuery["brands"] })}
          active={query.brands.length > 0}
        />
        {filtersNarrow || query.q ? (
          <button
            type="button"
            className="btn-ghost ml-1"
            onClick={() => {
              setSearch("");
              setQuery({ ...CLEARED_QUERY });
            }}
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {page && selected.size > 0 && selected.size < page.total && pageIds.every((id) => selected.has(id)) ? (
        <div className="flex items-center gap-3 border border-line px-4 py-2.5 text-[13px] text-text-2">
          {count(selected.size)} selected.
          <button type="button" className="btn-ghost" onClick={() => setSelected(new Set(page.matchingIds))}>
            Select all {count(page.total)} matching
          </button>
        </div>
      ) : null}

      <DataTable<LeadRow>
        id="leads"
        label="Leads table"
        minWidth={1060}
        rowHeight={40}
        rows={rows}
        rowKey={(r) => r.lead.id}
        rowHref={(r) => `/leads/${r.lead.id}`}
        sort={{ key: query.sort, dir: query.dir }}
        onSort={(k) => onSort(k as SortKey)}
        selection={{
          isSelected: (id) => selected.has(id),
          toggle: (_id, i, shift) => toggleRow(i, shift),
          allSelected: allOnPage,
          label: (r) => `Select ${r.company.name}`,
          toggleAll: () => {
            const next = new Set(selected);
            pageIds.forEach((id) => (allOnPage ? next.delete(id) : next.add(id)));
            setSelected(next);
          },
        }}
        rowStyle={(r) => (selected.has(r.lead.id) ? { boxShadow: `inset 3px 0 0 ${hueVar("cyan")}` } : undefined)}
        columns={[
          { key: "score", header: "Score", width: "64px", sortable: true, render: (r) => <TierBadge tier={r.lead.tier} score={r.lead.score} /> },
          {
            key: "company",
            header: "Company",
            width: "minmax(160px,1.8fr)",
            sortable: true,
            render: (r) => (
              <Link to={`/leads/${r.lead.id}`} className="block truncate text-[13px] font-medium text-text hover:text-cyan">
                {r.company.name}
                {r.lead.suppressed ? <span className="ml-2 text-[12px] font-medium text-coral">Opt-out</span> : null}
                {r.lead.tags?.length ? <span className="ml-2 text-[12px] font-normal text-text-3">{r.lead.tags.map((t) => `#${t}`).join(" ")}</span> : null}
              </Link>
            ),
          },
          { key: "industry", header: "Industry", width: "minmax(80px,1fr)", hideable: true, render: (r) => <span className="block truncate text-text-2">{industryLabel(r.company.industry)}</span> },
          {
            key: "location",
            header: "Location",
            width: "minmax(120px,1.4fr)",
            hideable: true,
            render: (r) => (
              <span className="block truncate text-text-2">
                {[r.company.city, r.company.region && r.company.country === "US" ? r.company.region : null].filter(Boolean).join(", ")} · {countryLabel(r.company.country)}
              </span>
            ),
          },
          { key: "local", header: "Local", width: "56px", hideable: true, render: (r) => <span className="num text-text-2">{localTime(r.company.timezone)}</span> },
          {
            key: "stage",
            header: "Stage",
            width: "minmax(96px,1fr)",
            sortable: true,
            hideable: true,
            render: (r) => (
              <Pill hue={LEAD_STAGE_HUE[r.lead.stage]} dot>
                {STAGE_CHIP[r.lead.stage]}
              </Pill>
            ),
          },
          {
            key: "owner",
            header: "Owner",
            width: "minmax(80px,0.9fr)",
            sortable: true,
            hideable: true,
            render: (r) => (
              <span className="flex min-w-0 items-center gap-1.5 text-text-2">
                <Avatar id={r.lead.ownerId} name={r.ownerName ?? "Unassigned"} size={20} />
                <span className="truncate" title={r.ownerName ?? undefined}>
                  {r.ownerName?.split(" ")[0] ?? "Unassigned"}
                </span>
              </span>
            ),
          },
          {
            key: "next",
            header: "Next action",
            width: "minmax(110px,1.3fr)",
            sortable: true,
            hideable: true,
            render: (r) => (
              <span className="block truncate" style={{ color: nextHue(r.lead.nextActionAt) }}>
                {nextActionText(r.lead.nextActionType, r.lead.nextActionAt, user.timezone)}
              </span>
            ),
          },
          { key: "last", header: "Last", width: "48px", sortable: true, hideable: true, render: (r) => <span className="num text-text-3">{since(r.lead.lastTouchAt)}</span> },
        ]}
        empty={
          error ? (
            <div className="flex items-center gap-4 text-[14px] text-coral">
              {error}
              <button type="button" className="btn-outline h-9" onClick={load}>
                Retry
              </button>
            </div>
          ) : !page ? (
            <SkeletonRows rows={8} />
          ) : page.visibleTotal === 0 ? (
            <EmptyState
              title={isAdmin ? "No leads yet. Import a CSV or run a list build." : "No leads are assigned to you yet. An admin assigns leads from the Leads list."}
              action={
                isAdmin ? (
                  <Link to="/leads/import" className="btn-outline">
                    Import CSV →
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <EmptyState
              title="No leads match these filters."
              action={
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => {
                    setSearch("");
                    setQuery({ ...CLEARED_QUERY });
                  }}
                >
                  Clear filters
                </button>
              }
            />
          )
        }
        footer={
          page && rows.length ? (
            <div className="flex items-center justify-between">
              <span>
                Showing {count(rows.length)} of {count(page.total)} · sorted by {query.sort === "score" ? "score, then local time" : query.sort === "last" ? "last touch" : query.sort === "next" ? "next action" : query.sort}
              </span>
              <span className="flex items-center gap-3 font-mono">
                {query.page} / {pages}
                <button type="button" aria-label="Previous page" disabled={query.page <= 1} onClick={() => setQuery({ page: query.page - 1 })} className="px-1 hover:text-text disabled:opacity-40">
                  ‹
                </button>
                <button type="button" aria-label="Next page" disabled={query.page >= pages} onClick={() => setQuery({ page: query.page + 1 })} className="px-1 hover:text-text disabled:opacity-40">
                  ›
                </button>
              </span>
            </div>
          ) : null
        }
      />

      <CadenceModal
        open={cadenceOpen}
        count={selected.size}
        onClose={() => setCadenceOpen(false)}
        onSave={(cadenceId) => {
          setCadenceOpen(false);
          runBulk(async () => {
            const n = await data.setCadence([...selected], cadenceId);
            return cadenceId ? `${count(n)} leads on cadence ${cadenceId} (closed, opted-out or erased leads are skipped)` : `${count(n)} leads taken off their cadence`;
          });
        }}
      />

      <AssignModal
        open={assignOpen}
        count={selected.size}
        owners={owners}
        onClose={() => setAssignOpen(false)}
        onAssign={(ownerId, listType) => {
          setAssignOpen(false);
          runBulk(async () => `Assigned ${count(await data.bulkAssign([...selected], ownerId, listType))} leads`);
        }}
      />
    </div>
  );
};

const AssignModal = ({
  open,
  count: n,
  owners,
  onClose,
  onAssign,
}: {
  open: boolean;
  count: number;
  owners: User[];
  onClose: () => void;
  onAssign: (ownerId: string | null, listType?: ListType) => void;
}) => {
  const [owner, setOwner] = useState("");
  const [list, setList] = useState("");
  return (
    <Modal open={open} onClose={onClose} title={`Assign ${n} leads`}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          onAssign(owner === "none" ? null : owner, (list || undefined) as ListType | undefined);
        }}
      >
        <label className="flex flex-col gap-2">
          <span className="field-label">Owner</span>
          <select className="input" value={owner} onChange={(e) => setOwner(e.target.value)} required>
            <option value="" disabled>
              Choose an owner
            </option>
            {owners.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
            <option value="none">Unassigned</option>
          </select>
        </label>
        <label className="flex flex-col gap-2">
          <span className="field-label">List</span>
          <select className="input" value={list} onChange={(e) => setList(e.target.value)}>
            <option value="">Keep each lead's list</option>
            <option value="trades">Trades</option>
            <option value="developers">Developers</option>
          </select>
        </label>
        <button type="submit" className="btn-primary justify-between" disabled={!owner}>
          <span>Assign</span>
          <span aria-hidden="true">→</span>
        </button>
      </form>
    </Modal>
  );
};

export default LeadsList;

/** Bulk: put the selected leads on a cadence (it restarts at day 1), or take them off. */
const CadenceModal = ({ open, count: n, onClose, onSave }: { open: boolean; count: number; onClose: () => void; onSave: (cadenceId: string | null) => void }) => {
  const [cadence, setCadence] = useState(Object.keys(QUEUE.cadences)[0]);
  return (
    <Modal open={open} onClose={onClose} title={`Cadence for ${n} leads`}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(cadence === "none" ? null : cadence);
        }}
      >
        <label className="flex flex-col gap-1.5">
          <span className="field-label">Cadence</span>
          <select className="input" value={cadence} onChange={(e) => setCadence(e.target.value)}>
            {Object.entries(QUEUE.cadences).map(([id, steps]) => (
              <option key={id} value={id}>
                {id} · {steps.length} steps over {steps[steps.length - 1].day} days
              </option>
            ))}
            <option value="none">No cadence (take them off)</option>
          </select>
        </label>
        <span className="text-[12px] text-text-3">Each step still passes compliance (country rules, calling hours, opt-out) before it's queued or sent.</span>
        <button type="submit" className="btn-primary justify-between">
          <span>Save</span>
          <span aria-hidden="true">→</span>
        </button>
      </form>
    </Modal>
  );
};
