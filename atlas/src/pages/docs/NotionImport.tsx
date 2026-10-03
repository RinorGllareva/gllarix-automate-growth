import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Modal, useToast } from "@/components/ui/overlay";
import { Icon } from "@/components/ui/primitives";
import { data, type NotionMove } from "@/data";
import { tableDate } from "@/lib/format";

/** Founders: the move off Notion as four steps, each with its state. */
export const NotionMoveChecklist = ({ move, onChanged }: { move: NotionMove; onChanged: () => void }) => {
  const toast = useToast();
  const [importing, setImporting] = useState(false);
  const steps = [
    { done: !!move.tasksImportedAt, title: "Import the tasks", detail: move.tasksImportedAt ? `Done ${tableDate(move.tasksImportedAt)}` : "Tasks › Import, from the Notion CSV", to: "/tasks/import" },
    { done: move.docsFromNotion > 0, title: "Import the docs and wiki", detail: move.docsFromNotion ? `${move.docsFromNotion} pages imported` : "Notion › Settings › Export › Markdown & CSV, then pick the unzipped folder", action: () => setImporting(true) },
    { done: move.docsFromNotion > 0 && move.brokenLinks === 0, title: "Fix links to pages that weren't exported", detail: move.docsFromNotion ? (move.brokenLinks ? `${move.brokenLinks} links say "not in this export"` : "Every link points inside Atlas") : "After the import" },
    { done: !!move.readOnlyAt, title: "Make Notion read-only", detail: move.readOnlyAt ? `Done ${tableDate(move.readOnlyAt)}${move.readOnlyBy ? ` by ${move.readOnlyBy}` : ""}` : "In Notion: Settings › People, set everyone to Can view. Then tick it here." },
  ];
  const done = steps.filter((s) => s.done).length;
  return (
    <section aria-label="Moving off Notion" className="card flex flex-col gap-3 p-4">
      <span className="flex items-center justify-between">
        <span className="text-[14px] font-semibold">Moving off Notion</span>
        <span className={`text-[12px] ${done === steps.length ? "text-mint" : "text-text-3"}`}>
          {done} of {steps.length}
        </span>
      </span>
      {steps.map((s, i) => (
        <div key={s.title} className="flex items-start gap-2.5 text-[13px]">
          <span className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border ${s.done ? "border-mint bg-mint/15 text-mint" : "border-line-strong text-text-3"}`}>
            {s.done ? <Icon d="M5 12l5 5L20 7" size={11} /> : <span className="text-[10px]">{i + 1}</span>}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            {s.to ? (
              <Link to={s.to} className="hover:text-cyan">
                {s.title}
              </Link>
            ) : s.action ? (
              <button type="button" className="text-left hover:text-cyan" onClick={s.action}>
                {s.title}
              </button>
            ) : (
              <span>{s.title}</span>
            )}
            <span className="text-[12px] text-text-3">{s.detail}</span>
          </span>
          {i === 3 ? (
            <input
              type="checkbox"
              aria-label="Notion is read-only"
              className="mt-1 h-4 w-4 accent-[var(--mint)]"
              checked={!!move.readOnlyAt}
              onChange={async (e) => {
                try {
                  await data.setNotionReadOnly(e.target.checked);
                  onChanged();
                } catch (err) {
                  toast((err as Error).message, "error");
                }
              }}
            />
          ) : null}
        </div>
      ))}
      <NotionImport open={importing} onClose={() => setImporting(false)} onDone={onChanged} />
    </section>
  );
};

/** Pick the unzipped Notion export folder (or its .md files) and import the pages. */
const NotionImport = ({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) => {
  const toast = useToast();
  const folder = useRef<HTMLInputElement>(null);
  const filesInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created: number; updated: number; skipped: string[] } | null>(null);

  const run = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(true);
    try {
      const files = await Promise.all(
        Array.from(list).map(async (f) => ({ path: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name, text: /\.md$/i.test(f.name) ? await f.text() : "" })),
      );
      const r = await data.importNotionDocs(files);
      setResult(r);
      toast(`${r.created} pages imported${r.updated ? `, ${r.updated} updated` : ""}`, "good");
      onDone();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
      if (folder.current) folder.current.value = "";
      if (filesInput.current) filesInput.current.value = "";
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Import from Notion">
      <div className="flex flex-col gap-4 text-[13px]">
        <ol className="m-0 flex list-decimal flex-col gap-1.5 pl-5 text-text-2">
          <li>In Notion: Settings › Export all workspace content, format Markdown & CSV, include subpages.</li>
          <li>Unzip the file you get by email.</li>
          <li>Pick the unzipped folder below. Pages keep their nesting and links between them.</li>
        </ol>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary" disabled={busy} onClick={() => folder.current?.click()}>
            {busy ? "Importing…" : "Pick the export folder"}
          </button>
          <button type="button" className="btn-outline" disabled={busy} onClick={() => filesInput.current?.click()}>
            Or pick .md files
          </button>
        </div>
        <input ref={folder} type="file" className="sr-only" aria-label="Notion export folder" multiple onChange={(e) => run(e.target.files)} {...({ webkitdirectory: "" } as Record<string, string>)} />
        <input ref={filesInput} type="file" className="sr-only" aria-label="Notion markdown files" multiple accept=".md,text/markdown" onChange={(e) => run(e.target.files)} />
        <span className="text-[12px] text-text-3">
          Importing again updates the same pages instead of duplicating them. Images stay in Notion for now (shown as [image: …]); databases come in through Tasks › Import.
        </span>
        {result ? (
          <div className="rounded-lg border border-line bg-surface p-3">
            {result.created} created · {result.updated} updated
            {result.skipped.length ? <span className="block text-[12px] text-text-3">{result.skipped.length} non-page files skipped (CSV databases, images).</span> : null}
          </div>
        ) : null}
      </div>
    </Modal>
  );
};

export default NotionImport;
