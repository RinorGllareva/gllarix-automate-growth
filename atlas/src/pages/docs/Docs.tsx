import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useUser } from "@/auth/AuthContext";
import Markdown from "@/components/Markdown";
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
  // A page just created opens straight in the editor once it has loaded.
  const editNext = useRef<string | null>(null);

  const loadHome = useCallback(() => data.listDocs().then(setHome, (e: Error) => setError(e.message)), []);
  useEffect(() => {
    loadHome();
  }, [loadHome]);
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

  const filtered = q.trim() ? home.docs.filter((d) => d.title.toLowerCase().includes(q.trim().toLowerCase())) : null;
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
        <input type="search" className="input h-9" placeholder="Find a page" aria-label="Find a page" value={q} onChange={(e) => setQ(e.target.value)} />
        <nav aria-label="Docs" className="flex flex-col">
          {filtered ? (
            filtered.length ? (
              filtered.map((d) => (
                <Link key={d.id} to={`/docs/${d.id}`} className="flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] text-text-2 hover:bg-surface-2 hover:text-text">
                  <span aria-hidden="true">{d.icon ?? "📄"}</span>
                  <span className="truncate">{d.title}</span>
                </Link>
              ))
            ) : (
              <span className="px-2 text-[13px] text-text-3">No page with that title.</span>
            )
          ) : (
            <Tree docs={home.docs} current={currentId} />
          )}
        </nav>
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
          <>
            {breadcrumbs.length ? (
              <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-[12px] text-text-3">
                {breadcrumbs.map((b) => (
                  <span key={b.id} className="flex items-center gap-1">
                    <Link to={`/docs/${b.id}`} className="hover:text-text">
                      {b.title}
                    </Link>
                    <span aria-hidden="true">/</span>
                  </span>
                ))}
              </nav>
            ) : null}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="m-0 flex items-center gap-3 text-[30px] font-semibold leading-tight tracking-[-0.02em]">
                <span aria-hidden="true">{page.icon ?? "📄"}</span>
                {page.title}
              </h2>
              {home.canEdit ? (
                <div className="flex gap-2">
                  <button type="button" className="btn-outline h-9" onClick={() => setDraft({ title: page.title, body: page.body, parentId: page.parentId, icon: page.icon ?? "" })}>
                    Edit
                  </button>
                  <button type="button" className="btn-ghost h-9" onClick={() => newPage(page.id)}>
                    + Subpage
                  </button>
                  {user.role === "admin" ? (
                    <button
                      type="button"
                      className="btn-ghost h-9 text-coral"
                      onClick={async () => {
                        if (!window.confirm(`Archive "${page.title}"? Its subpages move up one level.`)) return;
                        await data.archiveDoc(page.id);
                        await loadHome();
                        navigate("/docs");
                      }}
                    >
                      Archive
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
            <span className="text-[12px] text-text-3">
              {page.source === "notion" ? "Imported from Notion · " : ""}
              {page.updatedByName ? `Edited by ${page.updatedByName} · ` : ""}
              {timelineDate(page.updatedAt, user.timezone)}
            </span>
            <div className="max-w-3xl">
              <Markdown text={page.body} empty={<span className="text-text-3">{home.canEdit ? "Empty page. Press Edit to write it." : "Empty page."}</span>} />
            </div>
            {home.docs.filter((d) => d.parentId === page.id).length ? (
              <section aria-label="Subpages" className="flex max-w-3xl flex-col gap-1 border-t border-line pt-4">
                <span className="text-[12px] text-text-3">Subpages</span>
                {home.docs
                  .filter((d) => d.parentId === page.id)
                  .map((d) => (
                    <Link key={d.id} to={`/docs/${d.id}`} className="flex items-center gap-2 text-[14px] text-text-2 hover:text-text">
                      <span aria-hidden="true">{d.icon ?? "📄"}</span>
                      {d.title}
                    </Link>
                  ))}
              </section>
            ) : null}
            {page.backlinks.length ? (
              <section aria-label="Linked from" className="flex max-w-3xl flex-col gap-1 border-t border-line pt-4">
                <span className="text-[12px] text-text-3">Linked from</span>
                {page.backlinks.map((b) => (
                  <Link key={b.id} to={`/docs/${b.id}`} className="text-[13px] text-text-2 hover:text-text">
                    {b.title}
                  </Link>
                ))}
              </section>
            ) : null}
          </>
        )}
      </article>
    </div>
  );
};

export default Docs;
