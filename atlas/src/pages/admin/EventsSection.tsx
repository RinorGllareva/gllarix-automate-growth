import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { describeEvent } from "@/components/record/Record";
import { Field, RowMenu } from "@/components/ui/actions";
import { Modal, useToast } from "@/components/ui/overlay";
import { EmptyState, Pill, SkeletonRows, Toggle } from "@/components/ui/primitives";
import { data, type AtlasEvent, type Webhook, type WebhookDelivery } from "@/data";

/** Where an event's record opens, when there's a page for it. */
const hrefFor = (e: AtlasEvent) => {
  if (!e.entityId) return null;
  switch (e.entity) {
    case "lead":
      return `/leads/${e.entityId}`;
    case "deal":
      return `/deals/${e.entityId}`;
    case "client":
      return `/clients/${e.entityId}`;
    case "ticket":
      return `/support/${e.entityId}`;
    case "task":
      return `/tasks/${e.entityId}`;
    case "meeting":
      return `/meetings/${e.entityId}`;
    case "doc":
      return `/docs/${e.entityId}`;
    default:
      return null;
  }
};

const SUGGESTED = ["deal.*", "lead.*", "ticket.*", "invoice.*", "client.*", "meeting.*", "task.*"];

/**
 * Settings › Events: the events table every write lands in (the stream automations, alerts and webhooks read), and
 * outbound webhooks that post matching events to your own URL, signed.
 */
const EventsSection = () => {
  const toast = useToast();
  const [events, setEvents] = useState<AtlasEvent[] | null>(null);
  const [type, setType] = useState("");
  const [entity, setEntity] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [hooks, setHooks] = useState<{ webhooks: Webhook[]; deliveries: WebhookDelivery[] } | null>(null);
  const [draft, setDraft] = useState<{ id?: string; url: string; events: string; active: boolean } | null>(null);
  const [newSecret, setNewSecret] = useState<string | null>(null);

  const load = useCallback(() => {
    data.listEvents({ type: type.trim() || undefined, entity: entity || undefined, limit: 200 }).then(setEvents, (e: Error) => toast(e.message, "error"));
    data.listWebhooks().then(setHooks, () => setHooks({ webhooks: [], deliveries: [] }));
  }, [type, entity, toast]);
  useEffect(() => {
    load();
  }, [load]);

  const entities = [...new Set((events ?? []).map((e) => e.entity))].sort();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="page-title m-0">Events and webhooks</h1>
        <p className="m-0 max-w-3xl text-[14px] text-text-2">Every change in Atlas is recorded here as an event. Record timelines, automations and webhooks all read this one stream.</p>
      </div>

      <section aria-label="Events" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input className="input h-9 w-56" placeholder="Type, e.g. deal.* or ticket.update" aria-label="Event type" value={type} onChange={(e) => setType(e.target.value)} />
          <select className="input h-9 w-auto" aria-label="Record type" value={entity} onChange={(e) => setEntity(e.target.value)}>
            <option value="">Every record type</option>
            {entities.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
          <button type="button" className="btn-outline h-9" onClick={load}>
            Refresh
          </button>
          <span className="ml-auto text-[12px] text-text-3">Newest first · demo keeps the last 3,000</span>
        </div>
        {!events ? (
          <SkeletonRows rows={6} />
        ) : events.length ? (
          <div className="card max-h-[520px] overflow-y-auto">
            {events.map((e) => {
              const d = describeEvent(e);
              const href = hrefFor(e);
              return (
                <div key={e.id} className="border-b border-line-soft text-[13px] last:border-b-0">
                  <button type="button" className="grid w-full grid-cols-[140px_170px_minmax(0,1fr)_120px] items-center gap-3 px-4 py-2 text-left hover:bg-surface-2/50" aria-expanded={open === e.id} onClick={() => setOpen(open === e.id ? null : e.id)}>
                    <span className="font-mono text-[11px] text-text-3">{e.at.slice(0, 16).replace("T", " ")}</span>
                    <span className="truncate font-mono text-[12px] text-cyan">{e.type}</span>
                    <span className="truncate text-text-2">{d.detail || d.text}</span>
                    <span className="truncate text-right text-[12px] text-text-3">{e.actorName?.split(" ")[0] ?? "Atlas"}</span>
                  </button>
                  {open === e.id ? (
                    <div className="flex flex-col gap-2 bg-inset px-4 py-3">
                      <span className="text-[12px] text-text-3">
                        {e.entity}
                        {e.entityId ? ` · ${e.entityId}` : ""}
                        {href ? (
                          <Link to={href} className="ml-2 text-cyan hover:underline">
                            Open the record
                          </Link>
                        ) : null}
                      </span>
                      <pre className="m-0 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-text-2">{JSON.stringify(e.payload, null, 2) ?? "null"}</pre>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState title="No events match. Change something in Atlas and it shows up here." />
        )}
      </section>

      <section aria-label="Outbound webhooks" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[15px] font-semibold">Outbound webhooks</span>
            <span className="max-w-3xl text-[13px] text-text-2">
              Post events to Zapier, Make or your own script. Each request is signed with HMAC-SHA256 in the <span className="font-mono">Atlas-Signature</span> header. Demo mode never calls the URL: it shows the request it would send.
            </span>
          </div>
          <button type="button" className="btn-primary" onClick={() => setDraft({ url: "", events: "deal.*", active: true })}>
            + Webhook
          </button>
        </div>
        {hooks?.webhooks.length ? (
          <div className="card">
            {hooks.webhooks.map((w) => (
              <div key={w.id} className="flex flex-wrap items-center gap-3 border-b border-line-soft px-4 py-3 text-[13px] last:border-b-0">
                <span className="min-w-0 flex-1 truncate font-mono text-[12px]">{w.url}</span>
                <span className="text-[12px] text-text-2">{w.events.join(", ")}</span>
                <Pill hue={w.active ? "mint" : "text-3"}>{w.active ? "On" : "Off"}</Pill>
                <RowMenu
                  label={`Actions for ${w.url}`}
                  items={[
                    { label: "Edit", onSelect: () => setDraft({ id: w.id, url: w.url, events: w.events.join(", "), active: w.active }) },
                    {
                      label: "Delete",
                      danger: true,
                      onSelect: async () => {
                        if (!window.confirm(`Delete the webhook to ${w.url}?`)) return;
                        await data.deleteWebhook(w.id).catch((e: Error) => toast(e.message, "error"));
                        load();
                      },
                    },
                  ]}
                />
              </div>
            ))}
          </div>
        ) : (
          <span className="text-[13px] text-text-3">No webhooks yet.</span>
        )}
        {hooks?.deliveries.length ? (
          <div className="flex flex-col gap-2">
            <span className="text-[12px] font-medium text-text-3">Recent deliveries (simulated in demo mode)</span>
            <div className="card max-h-80 overflow-y-auto">
              {hooks.deliveries.map((d) => (
                <details key={d.id} className="border-b border-line-soft px-4 py-2 text-[13px] last:border-b-0">
                  <summary className="cursor-pointer">
                    <span className="font-mono text-[11px] text-text-3">{d.at.slice(0, 16).replace("T", " ")}</span> <span className="font-mono text-[12px] text-cyan">{d.eventType}</span> <span className="text-[12px] text-text-3">· {d.status}</span>
                  </summary>
                  <pre className="m-0 mt-2 whitespace-pre-wrap break-all font-mono text-[11px] text-text-2">{`POST ${hooks.webhooks.find((w) => w.id === d.webhookId)?.url}\nAtlas-Signature: ${d.signature}\n\n${d.body}`}</pre>
                </details>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? "Edit webhook" : "New webhook"}>
        {draft ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const w = await data.saveWebhook({ id: draft.id, url: draft.url, events: draft.events.split(/[,\s]+/).filter(Boolean), active: draft.active });
                if (!draft.id) setNewSecret(w.secret);
                setDraft(null);
                load();
              } catch (err) {
                toast((err as Error).message, "error");
              }
            }}
          >
            <Field label="URL (https)">
              <input autoFocus className="input" required value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} placeholder="https://hooks.zapier.com/…" />
            </Field>
            <Field label="Events (comma-separated; * matches a family)">
              <input className="input" value={draft.events} onChange={(e) => setDraft({ ...draft, events: e.target.value })} />
            </Field>
            <span className="flex flex-wrap gap-1.5">
              {SUGGESTED.map((s) => (
                <button key={s} type="button" className="h-6 rounded-full border border-line-strong px-2 font-mono text-[11px] text-text-2 hover:text-text" onClick={() => setDraft({ ...draft, events: [...new Set([...draft.events.split(/[,\s]+/).filter(Boolean), s])].join(", ") })}>
                  + {s}
                </button>
              ))}
            </span>
            <Toggle ariaLabel="Active" checked={draft.active} onChange={(v) => setDraft({ ...draft, active: v })} label={draft.active ? "On" : "Off"} />
            <button type="submit" className="btn-primary">
              Save webhook
            </button>
          </form>
        ) : null}
      </Modal>
      <Modal open={!!newSecret} onClose={() => setNewSecret(null)} title="Signing secret">
        <div className="flex flex-col gap-3 text-[13px]">
          <span className="text-text-2">Copy it now: your receiver uses it to check each request really came from Atlas. It isn't shown again.</span>
          <code className="break-all rounded-lg bg-inset px-3 py-2 font-mono text-[12px]">{newSecret}</code>
          <button
            type="button"
            className="btn-primary self-start"
            onClick={async () => {
              await navigator.clipboard?.writeText(newSecret ?? "").catch(() => undefined);
              toast("Secret copied", "good");
              setNewSecret(null);
            }}
          >
            Copy and close
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default EventsSection;
