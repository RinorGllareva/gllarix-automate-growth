import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useUser } from "@/auth/AuthContext";
import Markdown from "@/components/Markdown";
import { ActivityTimeline, PropertyRow, RecordPage, RelatedList } from "@/components/record/Record";
import { RowMenu } from "@/components/ui/actions";
import { usePageChrome } from "@/components/shell/PageChrome";
import { useToast } from "@/components/ui/overlay";
import { EmptyState, Icon, ICONS, SkeletonRows } from "@/components/ui/primitives";
import { AccessError, data, type DocRow, type DocsApi } from "@/data";
import { timelineDate } from "@/lib/format";
import { NotionMoveChecklist } from "./NotionImport";

type Home = Awaited<ReturnType<DocsApi["listDocs"]>>;
type Page = Awaited<ReturnType<DocsApi["getDoc"]>>;

/** The page tree: children under their parent, collapsible, the open page highlighted. */
const Tree = ({ docs, current, parent = null, depth = 0 }: { docs: DocRow[]; current: string | null; parent?: string | null; depth?: number }) => {
  const kids = docs.filter((d) => d.parentId === parent);
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  if (!kids.length) return null;
  return (
    <ul className="m-0 flex list-none flex-col p-0" role={depth ? "group" : "tree"} aria-label={depth ? undefined : "Pages"}>
      {kids.map((d) => {
        const hasKids = docs.some((x) => x.parentId === d.id);
        const open = !closed[d.id];
        return (
          <li key={d.id} role="treeitem" aria-expanded={hasKids ? open : undefined} aria-selected={d.id === current}>
            <div className={`group flex h-8 items-center gap-1 rounded-md pr-2 text-[13px] ${d.id === current ? "bg-surface-2 text-text" : "text-text-2 hover:bg-surface-2/60 hover:text-text"}`} style={{ paddingLeft: 4 + depth * 14 }}>
              {hasKids ? (
                <button type="button" aria-label={open ? `Collapse ${d.title}` : `Expand ${d.title}`} className="flex h-5 w-5 items-center justify-center rounded text-text-3 hover:text-text" onClick={() => setClosed({ ...closed, [d.id]: open })}>
                  <Icon d="M9 6l6 6-6 6" size={12} className={`transition-transform ${open ? "rotate-90" : ""}`} />
                </button>
              ) : (
                <span className="w-5" />
              )}
              <Link to={`/docs/${d.id}`} className="flex min-w-0 flex-1 items-center gap-1.5 truncate">
                <span aria-hidden="true">{d.icon ?? "📄"}</span>
                <span className="truncate">{d.title}</span>
              </Link>
            </div>
            {hasKids && open ? <Tree docs={docs} current={current} parent={d.id} depth={depth + 1} /> : null}
          </li>
        );
      })}
    </ul>
  );
};

/** /docs and /docs/:id: the company wiki (handbook, playbooks, SOPs), written in Markdown, imported from Notion. */
const Docs = () => {
  const { id } = useParams();
  const user = useUser();
  const toast = useToast();
  const navigate = useNavigate();
  const [home, setHome] = useState<Home | null>(null);
  const [page, setPage] = useState<Page | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState<{ title: string; body: string; parentId: string | null; icon: string } | null>(null);
  const [hits, setHits] = useState<{ id: string; title: string; snippet: string }[] | null>(null);
  const [archived, setArchived] = useState<{ id: string; title: string; updatedAt: string }[] | null>(null);
  // A page just created opens straight in the editor once it has loaded.
  const editNext = useRef<string | null>(null);

  const loadHome = useCallback(() => data.listDocs().then(setHome, (e: Error) => setError(e.message)), []);
  useEffect(() => {
    loadHome();
  }, [loadHome]);
  // Full-text search over titles and page text, a beat after typing stops.
  useEffect(() => {
    const needle = q.trim();
    if (!needle) return setHits(null);
    const t = window.setTimeout(() => data.searchDocs(needle).then(setHits, () => setHits([])), 200);
    return () => window.clearTimeout(t);
  }, [q, home]);
  const currentId = id ?? home?.docs.find((d) => !d.parentId)?.id ?? null;
  useEffect(() => {
    setDraft(null);
    if (!currentId) return setPage(null);
    data.getDoc(currentId).then(
      (p) => {
        setPage(p);
        if (editNext.current === p.id) {
          editNext.current = null;
          setDraft({ title: p.title, body: p.body, parentId: p.parentId, icon: p.icon ?? "" });
        }
      },
      (e: Error) => (e instanceof AccessError && e.status === 404 ? setPage(null) : setError(e.message)),
    );
  }, [currentId, home]);
  usePageChrome({ context: page ? `Docs · ${page.title}` : "Docs and wiki" });

  const breadcrumbs = useMemo(() => {
    if (!page || !home) return [];
    const out: DocRow[] = [];
    for (let p = page.parentId; p; p = home.docs.find((d) => d.id === p)?.parentId ?? null) {
      const d = home.docs.find((x) => x.id === p);
      if (!d) break;
      out.unshift(d);
    }
    return out;
  }, [page, home]);

  if (error) return <EmptyState title={error} />;
  if (!home) return <SkeletonRows rows={8} />;

  const showArchived = async () => {
    if (archived) return setArchived(null);
    try {
      setArchived(await data.listArchivedDocs());
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const restore = async (d: { id: string; title: string }) => {
    try {
      await data.restoreDoc(d.id);
      toast(`${d.title} restored`, "good");
      setArchived(await data.listArchivedDocs());
      await loadHome();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const move = async (direction: "up" | "down") => {
    if (!page) return;
    try {
      await data.moveDoc(page.id, direction);
      await loadHome();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const siblings = page && home ? home.docs.filter((d) => d.parentId === page.parentId) : [];
  const at = page ? siblings.findIndex((d) => d.id === page.id) : -1;
  const save = async () => {
    if (!draft) return;
    try {
      const d = await data.saveDoc({ id: page?.id, title: draft.title, body: draft.body, parentId: draft.parentId, icon: draft.icon || null });
      toast("Page saved", "good");
      setDraft(null);
      await loadHome();
      navigate(`/docs/${d.id}`);
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const newPage = async (parentId: string | null) => {
    try {
      const d = await data.saveDoc({ title: "Untitled", body: "", parentId });
      editNext.current = d.id;
      await loadHome();
      navigate(`/docs/${d.id}`);
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="flex flex-col gap-3 lg:sticky lg:top-6 lg:self-start">
        <div className="flex items-center justify-between">
          <h1 className="page-title m-0 text-[22px]">Docs and wiki</h1>
          {home.canEdit ? (
            <button type="button" className="btn-ghost h-8 px-2" aria-label="New page" title="New page" onClick={() => newPage(null)}>
              <Icon d={ICONS.plus} size={16} />
            </button>
          ) : null}
        </div>
        <input type="search" className="input h-9" placeholder="Search titles and text" aria-label="Search docs" value={q} onChange={(e) => setQ(e.target.value)} />
        <nav aria-label="Docs" className="flex flex-col">
          {q.trim() ? (
            !hits ? (
              <span className="px-2 text-[13px] text-text-3">Searching…</span>
            ) : hits.length ? (
              hits.map((d) => (
                <Link key={d.id} to={`/docs/${d.id}`} className="flex flex-col gap-0.5 rounded-md px-2 py-1.5 text-[13px] text-text-2 hover:bg-surface-2 hover:text-text">
                  <span className="truncate font-medium text-text">{d.title}</span>
                  {d.snippet ? <span className="line-clamp-2 text-[12px] text-text-3">{d.snippet}</span> : null}
                </Link>
              ))
            ) : (
              <span className="px-2 text-[13px] text-text-3">Nothing matches "{q.trim()}".</span>
            )
          ) : (
            <Tree docs={home.docs} current={currentId} />
          )}
        </nav>
        {user.role === "admin" ? (
          <div className="flex flex-col gap-1 border-t border-line-soft pt-2">
            <button type="button" className="btn-ghost h-8 justify-start px-2 text-[12px]" aria-expanded={!!archived} onClick={showArchived}>
              {archived ? "Hide archived pages" : "Archived pages"}
            </button>
            {archived ? (
              archived.length ? (
                archived.map((d) => (
                  <span key={d.id} className="flex items-center justify-between gap-2 px-2 text-[12px] text-text-2">
                    <span className="truncate">{d.title}</span>
                    <button type="button" className="shrink-0 text-cyan hover:underline" onClick={() => restore(d)}>
                      Restore
                    </button>
                  </span>
                ))
              ) : (
                <span className="px-2 text-[12px] text-text-3">Nothing archived.</span>
              )
            ) : null}
          </div>
        ) : null}
        {home.move ? <NotionMoveChecklist move={home.move} onChanged={loadHome} /> : null}
      </aside>

      <article className="flex min-w-0 flex-col gap-4">
        {!page ? (
          <EmptyState title="No pages yet. Create one, or import your Notion workspace." />
        ) : draft ? (
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <input className="input h-11 w-14 text-center text-[20px]" aria-label="Icon (emoji)" maxLength={4} value={draft.icon} placeholder="📄" onChange={(e) => setDraft({ ...draft, icon: e.target.value })} />
              <input className="input h-11 flex-1 text-[20px] font-semibold" aria-label="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-[13px] text-text-2">
              Inside
              <select className="input h-8 w-auto" value={draft.parentId ?? ""} onChange={(e) => setDraft({ ...draft, parentId: e.target.value || null })}>
                <option value="">Top level</option>
                {home.docs
                  .filter((d) => d.id !== page.id)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title}
                    </option>
                  ))}
              </select>
            </label>
            <div className="grid gap-4 xl:grid-cols-2">
              <textarea
                aria-label="Page text (Markdown)"
                className="input h-auto min-h-[460px] resize-y py-3 font-mono text-[13px] leading-relaxed"
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "s" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    save();
                  }
                }}
                placeholder={"# Heading\n- a list\n- [ ] a checkbox\n[link to a page](/docs/…)"}
              />
              <div className="hidden rounded-xl border border-line p-5 xl:block">
                <Markdown text={draft.body} empty={<span className="text-text-3">Preview</span>} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn-primary" onClick={save}>
                Save
              </button>
              <button type="button" className="btn-outline" onClick={() => setDraft(null)}>
                Cancel
              </button>
              <span className="text-[12px] text-text-3">Ctrl + S saves · Markdown: # heading, - list, - [ ] checkbox, **bold**, [text](/docs/page-id)</span>
            </div>
          </div>
        ) : (
          <RecordPage
            sideFrom="2xl"
            breadcrumb={[{ label: "Docs", to: "/docs" }, ...breadcrumbs.map((b) => ({ label: b.title, to: `/docs/${b.id}` }))]}
            status={page.source === "notion" ? <span className="chip border-line-strong text-text-2">Imported from Notion</span> : undefined}
            title={
              <span className="flex items-center gap-3">
                <span aria-hidden="true">{page.icon ?? "📄"}</span>
                {page.title}
              </span>
            }
            actions={
              home.canEdit ? (
                <>
                  <button type="button" className="btn-primary h-9" onClick={() => setDraft({ title: page.title, body: page.body, parentId: page.parentId, icon: page.icon ?? "" })}>
                    Edit
                  </button>
                  <RowMenu
                    label="More page actions"
                    items={[
                      { label: "+ Subpage", onSelect: () => newPage(page.id) },
                      { label: "Move up", hidden: at <= 0, onSelect: () => move("up") },
                      { label: "Move down", hidden: at < 0 || at >= siblings.length - 1, onSelect: () => move("down") },
                      {
                        label: "Archive",
                        danger: true,
                        hidden: user.role !== "admin",
                        onSelect: async () => {
                          if (!window.confirm(`Archive "${page.title}"? Its subpages move up one level.`)) return;
                          await data.archiveDoc(page.id);
                          await loadHome();
                          navigate("/docs");
                        },
                      },
                    ]}
                  />
                </>
              ) : undefined
            }
            properties={
              <PropertyRow
                items={[
                  { label: "Inside", value: breadcrumbs.length ? <Link to={`/docs/${breadcrumbs[breadcrumbs.length - 1].id}`} className="hover:text-cyan">{breadcrumbs[breadcrumbs.length - 1].title}</Link> : "Top level" },
                  { label: "Edited by", value: page.updatedByName ?? "—" },
                  { label: "Updated", value: <span className="text-text-2">{timelineDate(page.updatedAt, user.timezone)}</span> },
                  { label: "Subpages", value: String(home.docs.filter((d) => d.parentId === page.id).length) },
                ]}
              />
            }
            tabs={[
              {
                id: "page",
                label: "Page",
                content: (
                  <div className="max-w-3xl">
                    <Markdown text={page.body} empty={<span className="text-text-3">{home.canEdit ? "Empty page. Press Edit to write it." : "Empty page."}</span>} />
                  </div>
                ),
              },
              { id: "activity", label: "Activity", content: <ActivityTimeline entity="doc" id={page.id} reloadKey={page} /> },
            ]}
            side={
              <>
                <RelatedList
                  title="Subpages"
                  items={home.docs.filter((d) => d.parentId === page.id).map((d) => ({ id: d.id, label: `${d.icon ?? "📄"} ${d.title}`, to: `/docs/${d.id}` }))}
                  empty="No subpages."
                  action={
                    home.canEdit ? (
                      <button type="button" className="text-[12px] text-cyan hover:underline" onClick={() => newPage(page.id)}>
                        + Subpage
                      </button>
                    ) : undefined
                  }
                />
                <RelatedList title="Linked from" items={page.backlinks.map((b) => ({ id: b.id, label: b.title, to: `/docs/${b.id}` }))} empty="No other page links here yet." />
              </>
            }
          />
        )}
      </article>
    </div>
  );
};

export default Docs;
