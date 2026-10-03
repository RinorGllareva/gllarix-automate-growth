import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useUser } from "@/auth/AuthContext";
import { CustomFieldsPanel } from "@/components/CustomFields";
import { ActivityTimeline, InlineSelect, NextStepCard, PropertyRow, RecordPage, RelatedList } from "@/components/record/Record";
import { usePageChrome } from "@/components/shell/PageChrome";
import RecordFiles from "@/components/RecordFiles";
import { useToast } from "@/components/ui/overlay";
import { Avatar, EmptyState, Pill, SkeletonRows } from "@/components/ui/primitives";
import { TICKET_CATEGORIES, TICKET_CHANNEL, TICKET_PRIORITY, TICKET_STATUS } from "@/config/support";
import { AccessError, data, type SupportApi, type TicketCategory, type TicketChannel, type TicketPriority, type TicketRow, type TicketStatus } from "@/data";
import { timelineDate } from "@/lib/format";
import { Forbidden } from "@/pages/StatusPages";

type Full = Awaited<ReturnType<SupportApi["getTicket"]>>;

/** "The one thing to do on this ticket now", from its service level. */
const nextStep = (t: Full) => {
  if (t.status === "resolved") return null;
  if (t.status === "waiting") return "Waiting on the client. Nothing to do until they answer; the fix clock is paused.";
  if (!t.firstResponseAt) return `Reply to the client: say what you'll do and by when (${t.sla.label.toLowerCase()}).`;
  return `Fix it and mark it resolved (${t.sla.label.toLowerCase()}).`;
};

/**
 * One ticket on the shared record layout: conversation, activity and files in tabs, properties edited in place, the
 * next step, custom fields and the client's other tickets on the right. Full page at /support/:id, side panel from the list.
 */
export const TicketRecord = ({ id, panel = false, onChanged }: { id: string; panel?: boolean; onChanged?: () => void }) => {
  const user = useUser();
  const toast = useToast();
  const [t, setT] = useState<Full | null>(null);
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [text, setText] = useState("");
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [others, setOthers] = useState<TicketRow[]>([]);
  const [editingTitle, setEditingTitle] = useState(false);
  const [version, setVersion] = useState(0);
  const load = useCallback(() => {
    data.getTicket(id).then(setT, setError);
    data.listTickets().then((r) => setPeople(r.people), () => setPeople([]));
    setVersion((v) => v + 1);
  }, [id]);
  useEffect(() => {
    data.clientsOverview().then(
      (o) => setClients(o.cards.filter((c) => c.status !== "proposal").map((c) => ({ id: c.id, name: c.companyName }))),
      () => setClients([]),
    );
  }, []);
  useEffect(load, [load]);
  useEffect(() => {
    if (t?.clientId) data.listTickets(t.clientId).then((r) => setOthers(r.tickets.filter((x) => x.id !== t.id)), () => setOthers([]));
  }, [t?.clientId, t?.id]);

  if (error instanceof AccessError && error.status === 403) return <Forbidden />;
  if (error) return <EmptyState title="This ticket doesn't exist." action={<Link to="/support" className="btn-outline">Back to support</Link>} />;
  if (!t) return <SkeletonRows rows={6} />;

  const run = async (fn: () => Promise<void>, msg?: string) => {
    setBusy(true);
    try {
      await fn();
      if (msg) toast(msg, "good");
      load();
      onChanged?.();
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
  const step = nextStep(t);

  const conversation = (
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
                {m.emailedTo !== undefined ? <span>{m.emailedTo ? `· emailed to ${m.emailedTo}` : "· not emailed: no client email on file"}</span> : null}
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
          </div>
        </section>
      ) : null}
    </div>
  );

  return (
    <RecordPage
      panel={panel}
      breadcrumb={[{ label: "Support", to: "/support" }, { label: t.number }]}
      status={
        <>
          <Pill hue={TICKET_STATUS[t.status].hue} dot>
            {TICKET_STATUS[t.status].label}
          </Pill>
          {t.priority !== "normal" ? <Pill hue={TICKET_PRIORITY[t.priority].hue}>{TICKET_PRIORITY[t.priority].label}</Pill> : null}
          <span className={`text-[13px] ${t.sla.overdue ? "font-medium text-coral" : "text-text-2"}`}>{t.sla.label}</span>
        </>
      }
      title={
        editingTitle ? (
          <input
            autoFocus
            aria-label="Subject"
            className="input h-11 w-full min-w-[280px] text-[20px] font-semibold"
            defaultValue={t.subject}
            onKeyDown={(e) => e.key === "Escape" && setEditingTitle(false)}
            onBlur={(e) => {
              setEditingTitle(false);
              if (e.target.value.trim() && e.target.value !== t.subject) run(() => data.updateTicket(t.id, { subject: e.target.value }), "Subject saved");
            }}
          />
        ) : (
          <button type="button" className="text-left hover:text-cyan" title="Click to edit the subject" onClick={() => setEditingTitle(true)}>
            {t.subject}
          </button>
        )
      }
      actions={
        <>
          {panel ? (
            <Link to={`/support/${t.id}`} className="btn-ghost h-9 text-[12px]">
              Open full page
            </Link>
          ) : null}
          {t.status !== "resolved" ? (
            <button type="button" className="btn-outline h-9" disabled={busy} onClick={() => run(() => data.updateTicket(t.id, { status: "resolved" }), `${t.number} resolved`)}>
              Mark resolved
            </button>
          ) : (
            <button type="button" className="btn-outline h-9" disabled={busy} onClick={() => run(() => data.updateTicket(t.id, { status: "open" }), `${t.number} reopened`)}>
              Reopen
            </button>
          )}
        </>
      }
      properties={
        <PropertyRow
          items={[
            {
              label: "Client",
              value: (
                <InlineSelect
                  label="Client"
                  value={t.clientId}
                  options={(clients.some((c) => c.id === t.clientId) ? clients : [{ id: t.clientId, name: t.companyName }, ...clients]).map((c) => ({ value: c.id, label: c.name }))}
                  onChange={(v) => run(() => data.updateTicket(t.id, { clientId: v }), "Moved to another client")}
                />
              ),
            },
            { label: "Status", value: <InlineSelect<TicketStatus> label="Status" value={t.status} options={Object.entries(TICKET_STATUS).map(([k, v]) => ({ value: k as TicketStatus, label: v.label }))} onChange={(v) => run(() => data.updateTicket(t.id, { status: v }))} /> },
            {
              label: "Owner",
              value: (
                <InlineSelect
                  label="Owner"
                  value={t.assigneeId ?? ""}
                  options={[{ value: "", label: "Nobody" }, ...people.map((p) => ({ value: p.id, label: p.name }))]}
                  onChange={(v) => run(() => data.updateTicket(t.id, { assigneeId: v || null }))}
                />
              ),
            },
            { label: "Priority", value: <InlineSelect<TicketPriority> label="Priority" value={t.priority} options={Object.entries(TICKET_PRIORITY).map(([k, v]) => ({ value: k as TicketPriority, label: v.label }))} onChange={(v) => run(() => data.updateTicket(t.id, { priority: v }))} /> },
            { label: "Category", value: <InlineSelect<TicketCategory> label="Category" value={t.category} options={Object.entries(TICKET_CATEGORIES).map(([k, v]) => ({ value: k as TicketCategory, label: v.label }))} onChange={(v) => run(() => data.updateTicket(t.id, { category: v }))} /> },
            { label: "Came in by", value: <InlineSelect<TicketChannel> label="Came in by" value={t.channel} options={Object.entries(TICKET_CHANNEL).map(([k, v]) => ({ value: k as TicketChannel, label: v }))} onChange={(v) => run(() => data.updateTicket(t.id, { channel: v }))} /> },
            { label: "Opened", value: <span className="text-text-2">{timelineDate(t.createdAt, user.timezone)}</span> },
            { label: "First reply", value: <span className="text-text-2">{t.firstResponseAt ? timelineDate(t.firstResponseAt, user.timezone) : "Not yet"}</span> },
          ]}
        />
      }
      tabs={[
        { id: "conversation", label: "Conversation", count: t.messages.length, content: conversation },
        { id: "activity", label: "Activity", content: <ActivityTimeline entity="ticket" id={t.id} reloadKey={version} /> },
        { id: "files", label: "Files", content: <RecordFiles entity="ticket" id={t.id} hint="Screenshots, call recordings, logs. Up to 2 MB each in demo mode." /> },
      ]}
      side={
        <>
          {step ? <NextStepCard text={step} /> : null}
          <CustomFieldsPanel entity="ticket" id={t.id} />
          <RelatedList
            title={`Other tickets from ${t.companyName}`}
            items={others.slice(0, 6).map((o) => ({ id: o.id, label: `${o.number} · ${o.subject}`, sub: TICKET_STATUS[o.status].label, to: `/support/${o.id}` }))}
            empty="No other tickets from this client."
            action={
              <Link to={`/clients/${t.clientId}`} className="text-[12px] text-cyan hover:underline">
                Open the client
              </Link>
            }
          />
        </>
      }
    />
  );
};

/** /support/:id: the ticket as a full page. */
const TicketPage = () => {
  const { id = "" } = useParams();
  usePageChrome({ context: "Support", action: { label: "All tickets", to: "/support" } });
  return <TicketRecord id={id} />;
};

export default TicketPage;
