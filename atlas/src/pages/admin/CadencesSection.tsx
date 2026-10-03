import { useEffect, useState } from "react";
import { Field, RowMenu, useRun } from "@/components/ui/actions";
import { Modal, useToast } from "@/components/ui/overlay";
import { SkeletonRows } from "@/components/ui/primitives";
import { TEMPLATE_VARIABLES } from "@/config/emailTemplates";
import { CADENCE_LABEL, QUEUE } from "@/config/queue";
import { data, type EmailTemplate, type NewTemplateInput } from "@/data";
import { validateTemplate } from "@/services/templates";

/** Admin › Cadences (admin/05_CADENCES.md): cadence steps and the template library with preview. */
const CadencesSection = () => {
  const toast = useToast();
  const [templates, setTemplates] = useState<EmailTemplate[] | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: "", subject: "", body: "" });
  const [creating, setCreating] = useState<(NewTemplateInput & { copyOf?: string }) | null>(null);
  const run = useRun();
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
    if (current) setDraft({ name: current.name, subject: current.subject, body: current.body });
  }, [current]);
  useEffect(() => {
    if (key) data.previewTemplate(key).then(setPreview);
  }, [key, templates]);

  const errors = current ? validateTemplate(draft.subject, draft.body) : [];
  const dirty = current && (draft.subject !== current.subject || draft.body !== current.body || draft.name !== current.name);
  const blank = (): NewTemplateInput => ({
    name: "",
    channel: "email",
    list: "trades",
    subject: "",
    body: "Hi {{contact.first_name}},\n\n[TO WRITE]\n\n{{bdr.name}}\n\n{{footer_address}}\nUnsubscribe: {{unsubscribe_url}}",
  });
  const duplicate = (t: EmailTemplate) => setCreating({ name: `${t.name} (copy)`, channel: t.channel, list: t.list, subject: t.subject, body: t.body, copyOf: t.key });
  const remove = async (t: EmailTemplate) => {
    if (!window.confirm(`Delete the "${t.name}" template?`)) return;
    if (await run(() => data.deleteTemplate(t.key), `${t.name} deleted`)) {
      setKey(null);
      load();
    }
  };

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
        <span className="flex items-center justify-between">
          <span className="label-caps">Templates</span>
          <button type="button" className="btn-outline h-8 text-[12px]" onClick={() => setCreating(blank())}>
            + Template
          </button>
        </span>
        {!templates ? (
          <SkeletonRows rows={4} />
        ) : (
          <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)_minmax(0,1fr)]">
            <nav aria-label="Templates" className="flex flex-col gap-0.5">
              {templates.map((t) => (
                <span key={t.key} className={`flex items-center rounded-lg ${t.key === key ? "bg-ice text-ice-ink" : "text-text-2 hover:bg-surface hover:text-text"}`}>
                  <button type="button" onClick={() => setKey(t.key)} className="flex h-10 min-w-0 flex-1 items-center justify-between gap-2 px-3 text-left text-[13px]">
                    <span className="truncate">{t.name}</span>
                    {/\[TO WRITE/.test(t.body) ? <span className="shrink-0 text-[12px] font-medium text-amber">To write</span> : null}
                  </button>
                  <RowMenu
                    label={`Actions for ${t.name}`}
                    items={[
                      { label: "Duplicate", onSelect: () => duplicate(t) },
                      { label: "Delete", danger: true, hidden: !t.custom, onSelect: () => remove(t) },
                    ]}
                  />
                </span>
              ))}
            </nav>

            {current ? (
              <form
                className="flex flex-col gap-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await data.saveTemplate({ key: current.key, subject: draft.subject, body: draft.body, ...(current.custom ? { name: draft.name } : {}) });
                    toast("Template saved", "good");
                    load();
                  } catch (err) {
                    toast((err as Error).message, "error");
                  }
                }}
              >
                {current.custom ? (
                  <label className="flex flex-col gap-2">
                    <span className="field-label">Name</span>
                    <input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                  </label>
                ) : null}
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

      <Modal open={!!creating} onClose={() => setCreating(null)} title={creating?.copyOf ? "Duplicate template" : "New template"} width={640}>
        {creating ? (
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={async (e) => {
              e.preventDefault();
              let made = "";
              if (await run(async () => void (made = await data.createTemplate(creating)), `${creating.name} created`)) {
                setCreating(null);
                await load();
                setKey(made);
              }
            }}
          >
            <Field label="Name" wide>
              <input className="input" required value={creating.name} onChange={(e) => setCreating({ ...creating, name: e.target.value })} placeholder="e.g. Trades: seasonal follow-up" />
            </Field>
            <Field label="Channel">
              <select className="input" value={creating.channel} onChange={(e) => setCreating({ ...creating, channel: e.target.value as NewTemplateInput["channel"] })}>
                <option value="email">Email</option>
                <option value="linkedin">LinkedIn</option>
              </select>
            </Field>
            <Field label="For which list">
              <select className="input" value={creating.list} onChange={(e) => setCreating({ ...creating, list: e.target.value as NewTemplateInput["list"] })}>
                <option value="trades">Trades</option>
                <option value="developers">Developers</option>
                <option value="any">Any list</option>
              </select>
            </Field>
            <Field label="Subject" wide>
              <input className="input" value={creating.subject} onChange={(e) => setCreating({ ...creating, subject: e.target.value })} />
            </Field>
            <Field label="Body" wide>
              <textarea className="input h-auto min-h-48 py-2.5 font-mono text-[12px]" value={creating.body} onChange={(e) => setCreating({ ...creating, body: e.target.value })} />
            </Field>
            {validateTemplate(creating.subject, creating.body).length ? (
              <p role="alert" className="m-0 text-[12px] text-coral sm:col-span-2">
                {validateTemplate(creating.subject, creating.body).join(" ")}
              </p>
            ) : null}
            <button type="submit" className="btn-primary sm:col-span-2" disabled={!creating.name.trim() || validateTemplate(creating.subject, creating.body).length > 0}>
              Create template
            </button>
          </form>
        ) : null}
      </Modal>
    </div>
  );
};

export default CadencesSection;
