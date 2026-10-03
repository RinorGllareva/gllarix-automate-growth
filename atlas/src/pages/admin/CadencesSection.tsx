import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/overlay";
import { SkeletonRows } from "@/components/ui/primitives";
import { TEMPLATE_VARIABLES } from "@/config/emailTemplates";
import { CADENCE_LABEL, QUEUE } from "@/config/queue";
import { data, type EmailTemplate } from "@/data";
import { validateTemplate } from "@/services/templates";

/** Admin › Cadences (admin/05_CADENCES.md): cadence steps and the template library with preview. */
const CadencesSection = () => {
  const toast = useToast();
  const [templates, setTemplates] = useState<EmailTemplate[] | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const [draft, setDraft] = useState({ subject: "", body: "" });
  const [preview, setPreview] = useState<{ subject: string; body: string; problems: string[]; leadName: string | null } | null>(null);

  const load = () =>
    data.listTemplates().then((t) => {
      setTemplates(t);
      setKey((k) => k ?? t[0]?.key ?? null);
    });
  useEffect(() => {
    load();
  }, []);

  const current = templates?.find((t) => t.key === key) ?? null;
  useEffect(() => {
    if (current) setDraft({ subject: current.subject, body: current.body });
  }, [current]);
  useEffect(() => {
    if (key) data.previewTemplate(key).then(setPreview);
  }, [key, templates]);

  const errors = current ? validateTemplate(draft.subject, draft.body) : [];
  const dirty = current && (draft.subject !== current.subject || draft.body !== current.body);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="page-title m-0">Cadences</h1>

      <div className="grid gap-4 lg:grid-cols-2">
        {Object.entries(QUEUE.cadences).map(([id, steps]) => (
          <section key={id} aria-label={CADENCE_LABEL[id] ?? id} className="card flex flex-col p-5">
            <span className="label-caps pb-3">{CADENCE_LABEL[id] ?? id}</span>
            {steps.map((s, i) => (
              <div key={i} className="grid grid-cols-[60px_90px_1fr] gap-3 border-b border-line-soft py-2 text-[13px] last:border-b-0">
                <span className="font-mono text-text-3">Day {s.day}</span>
                <span className="capitalize">{s.channel === "linkedin" ? "LinkedIn" : s.channel}</span>
                <span className="truncate text-text-2">{s.template ? (templates?.find((t) => t.key === s.template)?.name ?? s.template) : "Script · call workspace"}</span>
              </div>
            ))}
          </section>
        ))}
      </div>

      <section aria-label="Templates" className="flex flex-col gap-4">
        <span className="label-caps">Templates</span>
        {!templates ? (
          <SkeletonRows rows={4} />
        ) : (
          <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)_minmax(0,1fr)]">
            <nav aria-label="Templates" className="flex flex-col gap-0.5">
              {templates.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setKey(t.key)}
                  className={`flex h-10 items-center justify-between gap-2 px-3 text-left text-[13px] ${t.key === key ? "bg-ice text-ice-ink" : "text-text-2 hover:bg-surface hover:text-text"}`}
                >
                  <span className="truncate">{t.name}</span>
                  {/\[TO WRITE/.test(t.body) ? <span className="shrink-0 text-[12px] font-medium text-amber">To write</span> : null}
                </button>
              ))}
            </nav>

            {current ? (
              <form
                className="flex flex-col gap-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await data.saveTemplate({ key: current.key, ...draft });
                    toast("Template saved", "good");
                    load();
                  } catch (err) {
                    toast((err as Error).message, "error");
                  }
                }}
              >
                <label className="flex flex-col gap-2">
                  <span className="field-label">Subject</span>
                  <input className="input" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="field-label">Body</span>
                  <textarea className="input h-auto min-h-72 py-2.5 font-mono text-[12px]" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
                </label>
                {errors.length ? (
                  <p role="alert" className="m-0 text-[12px] text-coral">
                    {errors.join(" ")}
                  </p>
                ) : null}
                <div className="flex items-center gap-3">
                  <button type="submit" className="btn-primary" disabled={!dirty || errors.length > 0}>
                    Save template
                  </button>
                  <span className="text-[12px] text-text-3">{current.transactional ? "Transactional / requested" : "Cold outreach · country rules apply"}</span>
                </div>
                <details className="text-[12px] text-text-2">
                  <summary className="cursor-pointer">Variables</summary>
                  <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0">
                    {TEMPLATE_VARIABLES.map((v) => (
                      <li key={v.key}>
                        <span className="font-mono text-text">{`{{${v.key}}}`}</span> · {v.hint}
                      </li>
                    ))}
                  </ul>
                </details>
              </form>
            ) : null}

            <section aria-label="Preview" className="card flex min-w-0 flex-col gap-2 self-start p-4">
              <span className="label-caps">Preview{preview?.leadName ? ` · ${preview.leadName}` : ""}</span>
              {preview ? (
                <>
                  <span className="text-[14px]">{preview.subject}</span>
                  <pre className="m-0 whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-text-2">{preview.body}</pre>
                  {preview.problems.map((p) => (
                    <span key={p} className="text-[12px] text-amber">
                      Won't send yet: {p}
                    </span>
                  ))}
                  <span className="text-[11px] text-text-3">Preview of the saved version. Save to update it.</span>
                </>
              ) : (
                <div className="skeleton h-40" />
              )}
            </section>
          </div>
        )}
      </section>
    </div>
  );
};

export default CadencesSection;
