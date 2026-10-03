import { useCallback, useEffect, useRef, useState } from "react";
import { useUser } from "@/auth/AuthContext";
import { useToast } from "@/components/ui/overlay";
import { Icon, Pill } from "@/components/ui/primitives";
import { data, MAX_DEMO_FILE_BYTES, type FileEntity, type RecordFile } from "@/data";
import { tableDate } from "@/lib/format";

const size = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
const KIND_LABEL = { contract: "Signed contract", report: "Report", upload: null } as const;

const readAsDataUrl = (f: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error(`Couldn't read ${f.name}.`));
    r.readAsDataURL(f);
  });

/** Files on a lead, deal or client: drop or pick to upload, open, delete your own. Signed contracts stay. */
const RecordFiles = ({ entity, id, hint }: { entity: FileEntity; id: string; hint?: string }) => {
  const user = useUser();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<RecordFile[] | null>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const canUpload = user.role !== "viewer";
  const load = useCallback(() => data.listFiles(entity, id).then(setFiles, () => setFiles([])), [entity, id]);
  useEffect(() => {
    load();
  }, [load]);

  const upload = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(true);
    try {
      for (const f of Array.from(list)) {
        if (f.size > MAX_DEMO_FILE_BYTES) {
          toast(`${f.name} is over 2 MB. Larger files arrive with Supabase Storage.`, "error");
          continue;
        }
        await data.uploadFile(entity, id, { name: f.name, size: f.size, mime: f.type, url: await readAsDataUrl(f) });
      }
      toast(list.length === 1 ? `Added ${list[0].name}` : `Added ${list.length} files`, "good");
      load();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <section aria-label="Files" className="card flex flex-col">
      {canUpload ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            upload(e.dataTransfer.files);
          }}
          className={`m-3 flex flex-col items-center gap-1.5 rounded-lg border border-dashed px-4 py-5 text-center text-[13px] ${over ? "border-cyan bg-cyan/5" : "border-line-strong"}`}
        >
          <span className="text-text-2">{busy ? "Uploading…" : (hint ?? "Drop files here: proposals, floor plans, photos, PDFs")}</span>
          <button type="button" className="btn-outline h-8 text-[12px]" disabled={busy} onClick={() => input.current?.click()}>
            Choose files
          </button>
          <input ref={input} type="file" multiple className="sr-only" aria-label="Upload files" onChange={(e) => upload(e.target.files)} />
          <span className="text-[11px] text-text-3">Up to 2 MB each in demo mode</span>
        </div>
      ) : null}
      {files?.length ? (
        files.map((f) => (
          <div key={f.id} className="flex items-center gap-3 border-t border-line-soft px-4 py-2.5 text-[13px]">
            <Icon d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5" size={16} className="shrink-0 text-text-3" />
            <a href={f.url} download={f.name} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:text-cyan">
              {f.name}
            </a>
            {KIND_LABEL[f.kind] ? <Pill hue={f.kind === "contract" ? "mint" : "blue"}>{KIND_LABEL[f.kind]}</Pill> : null}
            <span className="hidden shrink-0 text-[12px] text-text-3 sm:inline">
              {size(f.size)} · {f.uploadedByName ?? "Atlas"} · {tableDate(f.createdAt)}
            </span>
            {f.kind !== "contract" && (user.role === "admin" || f.uploadedBy === user.id) ? (
              <button
                type="button"
                className="btn-ghost h-7 px-2 text-text-3 hover:text-coral"
                aria-label={`Delete ${f.name}`}
                onClick={async () => {
                  if (!window.confirm(`Delete ${f.name}?`)) return;
                  try {
                    await data.deleteFile(f.id);
                    load();
                  } catch (e) {
                    toast((e as Error).message, "error");
                  }
                }}
              >
                <Icon d="M6 6l12 12M18 6L6 18" size={14} />
              </button>
            ) : null}
          </div>
        ))
      ) : files ? (
        <span className="border-t border-line-soft px-4 py-3 text-[13px] text-text-3">No files yet.</span>
      ) : null}
    </section>
  );
};

export default RecordFiles;
