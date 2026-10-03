import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useUser } from "@/auth/AuthContext";
import { usePageChrome } from "@/components/shell/PageChrome";
import { useToast } from "@/components/ui/overlay";
import { Avatar, EmptyState, Pill, SkeletonRows } from "@/components/ui/primitives";
import { TICKET_CATEGORIES, TICKET_CHANNEL, TICKET_PRIORITY, TICKET_STATUS } from "@/config/support";
import { AccessError, data, type SupportApi, type TicketPriority, type TicketStatus } from "@/data";
import { timelineDate } from "@/lib/format";
import { Forbidden } from "@/pages/StatusPages";

type Full = Awaited<ReturnType<SupportApi["getTicket"]>>;

/** /support/:id: the conversation, a reply box (to the client, or an internal note), and status, owner and priority. */
const TicketPage = () => {
  const { id = "" } = useParams();
  const user = useUser();
  const toast = useToast();
  const [t, setT] = useState<Full | null>(null);
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [text, setText] = useState("");
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    data.getTicket(id).then(setT, setError);
    data.listTickets().then((r) => setPeople(r.people), () => setPeople([]));
  }, [id]);
  useEffect(load, [load]);
  usePageChrome(t ? { context: `Support · ${t.number}`, action: { label: "All tickets", to: "/support" } } : null);

  if (error instanceof AccessError && error.status === 403) return <Forbidden />;
  if (error) return <EmptyState title="This ticket doesn't exist." action={<Link to="/support" className="btn-outline">Back to support</Link>} />;
  if (!t) return <SkeletonRows rows={6} />;

  const run = async (fn: () => Promise<void>, msg?: string) => {
    setBusy(true);
    try {
      await fn();
      if (msg) toast(msg, "good");
      load();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  const send = () =>
    run(async () => {
      await data.replyTicket(t.id, { text, internal });
      setText("");
    }, internal ? "Note added" : "Reply sent · waiting on the client");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[12px] text-text-3">{t.number}</span>
          <Pill hue={TICKET_STATUS[t.status].hue} dot>
            {TICKET_STATUS[t.status].label}
          </Pill>
          {t.priority !== "normal" ? <Pill hue={TICKET_PRIORITY[t.priority].hue}>{TICKET_PRIORITY[t.priority].label}</Pill> : null}
          <span className={`text-[13px] ${t.sla.overdue ? "font-medium text-coral" : "text-text-2"}`}>{t.sla.label}</span>
        </div>
        <h1 className="page-title m-0">{t.subject}</h1>
        <p className="m-0 text-[14px] text-text-2">
          <Link to={`/clients/${t.clientId}`} className="text-text hover:text-cyan">
            {t.companyName}
          </Link>{" "}
          · {TICKET_CATEGORIES[t.category].label} · {TICKET_CATEGORIES[t.category].level} · came in by {TICKET_CHANNEL[t.channel].toLowerCase()}
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-4">
          <section aria-label="Conversation" className="flex flex-col gap-3">
            {t.messages.map((m) => (
              <article key={m.id} className={`flex gap-3 rounded-xl border p-4 ${m.internal ? "border-amber/30 bg-amber/5" : m.by ? "border-line bg-surface" : "border-line-strong"}`}>
                <Avatar id={m.by ?? t.clientId} name={m.byName ?? t.companyName} size={28} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex flex-wrap items-baseline gap-2 text-[12px] text-text-3">
                    <span className="text-[13px] font-medium text-text">{m.byName ?? t.companyName}</span>
                    {m.internal ? <span className="text-amber">Internal note</span> : m.by ? "Reply to client" : "Client"}
                    <span>· {timelineDate(m.at, user.timezone)}</span>
                  </span>
                  <p className="m-0 whitespace-pre-wrap text-[14px] leading-relaxed">{m.text}</p>
                </div>
              </article>
            ))}
            {!t.messages.length ? <span className="text-[13px] text-text-3">No messages yet.</span> : null}
          </section>

          {t.status !== "resolved" ? (
            <section aria-label="Reply" className="card flex flex-col gap-3 p-4">
              <div role="radiogroup" aria-label="Reply type" className="flex gap-1.5">
                {[
                  { v: false, label: "Reply to client" },
                  { v: true, label: "Internal note" },
                ].map((o) => (
                  <button key={o.label} type="button" role="radio" aria-checked={internal === o.v} onClick={() => setInternal(o.v)} className={`h-8 rounded-full border px-3.5 text-[12px] ${internal === o.v ? "border-ice bg-ice text-ice-ink" : "border-line-strong text-text-2 hover:text-text"}`}>
                    {o.label}
                  </button>
                ))}
              </div>
              <textarea
                aria-label={internal ? "Internal note" : "Reply to the client"}
                className="input h-auto min-h-[110px] py-2.5"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && text.trim()) send();
                }}
                placeholder={internal ? "Only the team sees this." : "Goes to the client by email. Say what you'll do and by when."}
              />
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="btn-primary" disabled={busy || !text.trim()} onClick={send}>
                  {internal ? "Add note" : "Send reply"}
                </button>
                <span className="text-[12px] text-text-3">Ctrl + Enter sends</span>
                <button type="button" className="btn-outline ml-auto" disabled={busy} onClick={() => run(() => data.updateTicket(t.id, { status: "resolved" }), `${t.number} resolved`)}>
                  Mark resolved
                </button>
              </div>
            </section>
          ) : (
            <button type="button" className="btn-outline self-start" disabled={busy} onClick={() => run(() => data.updateTicket(t.id, { status: "open" }), `${t.number} reopened`)}>
              Reopen
            </button>
          )}
        </div>

        <aside className="card flex flex-col gap-4 self-start p-5 text-[13px]">
          <label className="flex flex-col gap-1.5">
            <span className="field-label">Status</span>
            <select className="input" value={t.status} onChange={(e) => run(() => data.updateTicket(t.id, { status: e.target.value as TicketStatus }))}>
              {Object.entries(TICKET_STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="field-label">Owner</span>
            <select className="input" value={t.assigneeId ?? ""} onChange={(e) => run(() => data.updateTicket(t.id, { assigneeId: e.target.value || null }))}>
              <option value="">Nobody</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="field-label">Priority</span>
            <select className="input" value={t.priority} onChange={(e) => run(() => data.updateTicket(t.id, { priority: e.target.value as TicketPriority }))}>
              {Object.entries(TICKET_PRIORITY).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-col gap-1 border-t border-line-soft pt-3 text-[12px] text-text-3">
            <span>Opened {timelineDate(t.createdAt, user.timezone).toLowerCase()}</span>
            <span>{t.firstResponseAt ? `First reply ${timelineDate(t.firstResponseAt, user.timezone).toLowerCase()}` : "No reply yet"}</span>
            {t.resolvedAt ? <span>Resolved {timelineDate(t.resolvedAt, user.timezone).toLowerCase()}</span> : null}
          </div>
          <Link to={`/clients/${t.clientId}`} className="btn-outline h-9 justify-between">
            <span>Open the client</span>
            <span aria-hidden="true">→</span>
          </Link>
        </aside>
      </div>
    </div>
  );
};

export default TicketPage;
