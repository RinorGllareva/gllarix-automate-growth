import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useUser } from "@/auth/AuthContext";
import { usePageChrome } from "@/components/shell/PageChrome";
import { Modal, useToast } from "@/components/ui/overlay";
import { Avatar, EmptyState, Icon, ICONS, KpiCard, Pill, SkeletonRows } from "@/components/ui/primitives";
import type { Hue } from "@/config/colors";
import { data, type InboundChannel, type InboundHome, type InboundStatus } from "@/data";

const CHANNEL: Record<InboundChannel, { label: string; hue: Hue }> = {
  website_form: { label: "Website form", hue: "cyan" },
  demo_line: { label: "Demo line", hue: "teal" },
  booking_link: { label: "Booking page", hue: "blue" },
  referral: { label: "Referral", hue: "mint" },
  google_profile: { label: "Google profile", hue: "orange" },
  chat: { label: "Chat", hue: "lavender" },
};
const STATUS: Record<InboundStatus, { label: string; hue: Hue }> = {
  new: { label: "New", hue: "amber" },
  contacted: { label: "Replied", hue: "cyan" },
  converted: { label: "Lead", hue: "mint" },
  not_fit: { label: "Not a fit", hue: "text-3" },
  spam: { label: "Spam", hue: "text-3" },
};
const FILTERS: { key: string; label: string; match: (s: InboundStatus) => boolean }[] = [
  { key: "open", label: "To answer", match: (s) => s === "new" },
  { key: "replied", label: "Replied", match: (s) => s === "contacted" },
  { key: "leads", label: "Became leads", match: (s) => s === "converted" },
  { key: "dismissed", label: "Dismissed", match: (s) => s === "not_fit" || s === "spam" },
  { key: "all", label: "All", match: () => true },
];

const ago = (iso: string, now: number) => {
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  return m < 60 ? `${m} min` : m < 48 * 60 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`;
};
const mins = (m: number) => (m < 60 ? `${Math.round(m)} min` : m < 48 * 60 ? `${(m / 60).toFixed(1)} h` : `${Math.round(m / 1440)} d`);

/** Sell › Inbound: one inbox for website forms, the demo line, referrals and booking-page bookings, with the speed-to-lead clock. */
const Inbound = () => {
  const me = useUser();
  const toast = useToast();
  const navigate = useNavigate();
  const [home, setHome] = useState<InboundHome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("open");
  const [now, setNow] = useState(Date.now());
  const [q, setQ] = useState("");
  const [channel, setChannel] = useState<InboundChannel | "">("");
  const [owner, setOwner] = useState("");
  const [replying, setReplying] = useState<{ id: string; who: string; note: string } | null>(null);
  const [sim, setSim] = useState<{ name: string; company: string; email: string; brand: "gllarix" | "arcadian"; channel: InboundChannel; message: string } | null>(null);
  usePageChrome({ context: "Sell · inbound" });

  const load = useCallback(() => data.inboundHome().then(setHome, (e: Error) => setError(e.message)), []);
  useEffect(() => {
    load();
    // The clock on unanswered requests keeps moving.
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, [load]);

  if (error) return <EmptyState title={error} />;
  if (!home) return <SkeletonRows rows={8} />;
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      if (ok) toast(ok, "good");
      await load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const f = FILTERS.find((x) => x.key === filter)!;
  const needle = q.trim().toLowerCase();
  const matches = (r: InboundHome["requests"][number]) =>
    (!needle || `${r.name} ${r.company} ${r.email ?? ""} ${r.phone ?? ""} ${r.message}`.toLowerCase().includes(needle)) &&
    (!channel || r.channel === channel) &&
    (!owner || (owner === "none" ? !r.assignedTo : r.assignedTo === owner));
  const rows = home.requests.filter((r) => f.match(r.status) && matches(r));
  const dismiss = async (r: InboundHome["requests"][number], reason: "not_fit" | "spam") => {
    try {
      await data.dismissInbound(r.id, reason);
      await load();
      toast(reason === "spam" ? "Marked as spam" : "Marked not a fit", "info", {
        label: "Undo",
        run: async () => {
          await data.undoDismissInbound(r.id).catch((e: Error) => toast(e.message, "error"));
          await load();
        },
      });
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const { kpis, targetMinutes } = home;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="page-title m-0">Inbound</h1>
          <p className="m-0 max-w-3xl text-[14px] text-text-2">
            Website forms, the demo line, referrals and booking-page bookings in one inbox. Answer within {targetMinutes} minutes in business hours (proposed target): the faster the reply, the more of them book.
          </p>
        </div>
        {me.role === "admin" ? (
          <button type="button" className="btn-outline" onClick={() => setSim({ name: "", company: "", email: "", brand: "gllarix", channel: "website_form", message: "" })} title="Until the website forms post to Atlas">
            <Icon d={ICONS.plus} size={15} /> Test request
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard title="Waiting for a reply" value={String(kpis.open)} caption={kpis.open ? "Oldest first below" : "Nothing waiting"} tone={kpis.open ? "amber" : "mint"} />
        <KpiCard title={`Answered within ${targetMinutes} min`} value={kpis.withinTarget === null ? "—" : `${Math.round(kpis.withinTarget * 100)}%`} caption="Last 30 days" tone={kpis.withinTarget !== null && kpis.withinTarget >= 0.8 ? "mint" : "text"} />
        <KpiCard title="Median first reply" value={kpis.medianResponseMin === null ? "—" : mins(kpis.medianResponseMin)} caption="Last 30 days" />
        <KpiCard title="Became leads" value={String(kpis.converted30d)} caption={`Of ${kpis.received30d} received in 30 days`} tone="cyan" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
      <div className="mr-auto flex flex-wrap items-center gap-1 self-start rounded-lg bg-inset p-0.5">
        {FILTERS.map((x) => {
          const n = home.requests.filter((r) => x.match(r.status) && matches(r)).length;
          return (
            <button key={x.key} type="button" onClick={() => setFilter(x.key)} className={`h-8 rounded-md px-3 text-[13px] ${filter === x.key ? "bg-surface-2 text-text shadow-card" : "text-text-2 hover:text-text"}`}>
              {x.label} <span className="text-text-3">{n}</span>
            </button>
          );
        })}
      </div>
        <input type="search" className="input h-9 w-48" placeholder="Name, company, message" aria-label="Search requests" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input h-9 w-auto" aria-label="Channel" value={channel} onChange={(e) => setChannel(e.target.value as InboundChannel | "")}>
          <option value="">Every channel</option>
          {(Object.keys(CHANNEL) as InboundChannel[]).map((c) => (
            <option key={c} value={c}>
              {CHANNEL[c].label}
            </option>
          ))}
        </select>
        <select className="input h-9 w-auto" aria-label="Owner" value={owner} onChange={(e) => setOwner(e.target.value)}>
          <option value="">Every owner</option>
          <option value="none">Nobody yet</option>
          {home.people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <section aria-label="Inbound requests" className="card flex flex-col">
        {rows.length ? (
          [...rows]
            .sort((a, b) => (filter === "open" ? a.receivedAt.localeCompare(b.receivedAt) : b.receivedAt.localeCompare(a.receivedAt)))
            .map((r) => {
              const waiting = r.status === "new";
              const waitedMin = (now - new Date(r.receivedAt).getTime()) / 60_000;
              const late = waiting && waitedMin > targetMinutes;
              const replyMin = r.firstResponseAt ? (new Date(r.firstResponseAt).getTime() - new Date(r.receivedAt).getTime()) / 60_000 : null;
              return (
                <div key={r.id} className="flex flex-col gap-2.5 border-b border-line-soft px-5 py-4 last:border-b-0 lg:flex-row lg:items-start lg:gap-5">
                  <div className="flex w-full shrink-0 flex-row items-center gap-2 lg:w-[130px] lg:flex-col lg:items-start">
                    <span className={`num text-[13px] font-medium ${late ? "text-coral" : waiting ? "text-amber" : "text-text-2"}`}>{waiting ? `${ago(r.receivedAt, now)} waiting` : ago(r.receivedAt, now) + " ago"}</span>
                    <Pill hue={STATUS[r.status].hue} dot>
                      {STATUS[r.status].label}
                    </Pill>
                    {replyMin !== null ? <span className={`text-[12px] ${replyMin <= targetMinutes ? "text-mint" : "text-text-3"}`}>Replied in {mins(replyMin)}</span> : null}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-semibold">{r.company || r.name}</span>
                      <Pill hue={CHANNEL[r.channel].hue}>{CHANNEL[r.channel].label}</Pill>
                      <Pill hue={r.brand === "gllarix" ? "cyan" : "amber"}>{r.brand === "gllarix" ? "Gllarix" : "Arcadian"}</Pill>
                      {r.country ? <span className="text-[12px] text-text-3">{r.country}</span> : null}
                    </span>
                    <span className="text-[13px] text-text-2">
                      {r.name}
                      {r.email ? ` · ${r.email}` : ""}
                      {r.phone ? ` · ${r.phone}` : ""}
                      {r.referredBy ? ` · referred by ${r.referredBy}` : ""}
                    </span>
                    <span className="whitespace-pre-wrap text-[13px]">“{r.message}”</span>
                    {r.replyNote ? <span className="text-[12px] text-text-2">Reply: {r.replyNote}</span> : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2 lg:w-[300px] lg:justify-end">
                    {me.role === "admin" && r.status !== "converted" ? (
                      <select className="input h-8 w-auto text-[12px]" aria-label={`Owner of ${r.company || r.name}`} value={r.assignedTo ?? ""} onChange={(e) => run(() => data.assignInbound(r.id, e.target.value || null), "Reassigned")}>
                        <option value="">Nobody</option>
                        {home.people.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name.split(" ")[0]}
                          </option>
                        ))}
                      </select>
                    ) : r.assigneeName ? (
                      <span className="flex items-center gap-1.5 text-[12px] text-text-2">
                        <Avatar id={r.assignedTo} name={r.assigneeName} size={20} />
                        {r.assigneeName.split(" ")[0]}
                      </span>
                    ) : home.canAct && waiting ? (
                      <button type="button" className="btn-outline h-8" onClick={() => run(() => data.claimInbound(r.id), "It's yours")}>
                        Take it
                      </button>
                    ) : null}
                    {r.leadId ? (
                      <Link to={`/leads/${r.leadId}`} className="btn-outline h-8">
                        Open lead
                      </Link>
                    ) : null}
                    {home.canAct && (r.status === "new" || r.status === "contacted") ? (
                      <>
                        {r.status === "new" ? (
                          <button type="button" className="btn-outline h-8" onClick={() => setReplying({ id: r.id, who: r.company || r.name, note: "" })}>
                            Mark replied
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="btn-primary h-8"
                          onClick={() =>
                            run(async () => {
                              const id = await data.convertInbound(r.id);
                              toast("Lead created", "good");
                              navigate(`/leads/${id}`);
                            })
                          }
                        >
                          Make it a lead
                        </button>
                        <button type="button" className="h-8 px-1 text-[12px] text-text-3 hover:text-text" onClick={() => dismiss(r, "not_fit")}>
                          Not a fit
                        </button>
                        <button type="button" className="h-8 px-1 text-[12px] text-text-3 hover:text-coral" onClick={() => dismiss(r, "spam")}>
                          Spam
                        </button>
                      </>
                    ) : null}
                    {home.canAct && (r.status === "not_fit" || r.status === "spam") ? (
                      <button type="button" className="btn-ghost h-8 text-[12px]" onClick={() => run(() => data.undoDismissInbound(r.id), "Back in the inbox")}>
                        Undo dismiss
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })
        ) : (
          <p className="m-0 px-5 py-8 text-[13px] text-text-3">{needle || channel || owner ? "No request matches these filters." : filter === "open" ? "Nothing waiting. New website forms, demo-line calls and referrals land here." : "Nothing here."}</p>
        )}
      </section>

      <Modal open={!!replying} onClose={() => setReplying(null)} title={replying ? `Replied to ${replying.who}` : ""}>
        {replying ? (
          <form
            className="flex flex-col gap-4 text-[13px]"
            onSubmit={async (e) => {
              e.preventDefault();
              const x = replying;
              setReplying(null);
              await run(() => data.respondInbound(x.id, x.note), "Reply logged: the clock stopped");
            }}
          >
            <span className="text-text-2">Log the first reply (call, email or WhatsApp). The speed-to-lead clock stops now.</span>
            <label className="flex flex-col gap-2">
              <span className="field-label">What you said or promised (optional)</span>
              <textarea autoFocus className="input min-h-[80px] py-2" value={replying.note} onChange={(e) => setReplying({ ...replying, note: e.target.value })} placeholder="e.g. Called, left a voicemail, sent the demo line number" />
            </label>
            <button type="submit" className="btn-primary">
              Log reply
            </button>
          </form>
        ) : null}
      </Modal>

      <Modal open={!!sim} onClose={() => setSim(null)} title="Test inbound request">
        {sim ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              await run(() => data.receiveInbound({ ...sim, email: sim.email || null, phone: null, country: sim.brand === "gllarix" ? "US" : null }), "Request received: the team is notified");
              setSim(null);
              setFilter("open");
            }}
          >
            <p className="m-0 text-[13px] text-text-2">Until the website forms and the demo line post to Atlas, use this to try the inbox. Use a test email (e.g. name@example.com).</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="field-label">Name</span>
                <input className="input" required value={sim.name} onChange={(e) => setSim({ ...sim, name: e.target.value })} />
              </label>
              <label className="flex flex-col gap-2">
                <span className="field-label">Company</span>
                <input className="input" value={sim.company} onChange={(e) => setSim({ ...sim, company: e.target.value })} />
              </label>
              <label className="flex flex-col gap-2">
                <span className="field-label">Email</span>
                <input className="input" type="email" required value={sim.email} onChange={(e) => setSim({ ...sim, email: e.target.value })} />
              </label>
              <label className="flex flex-col gap-2">
                <span className="field-label">Came through</span>
                <select className="input" value={sim.channel} onChange={(e) => setSim({ ...sim, channel: e.target.value as InboundChannel })}>
                  {(Object.keys(CHANNEL) as InboundChannel[])
                    .filter((c) => c !== "booking_link")
                    .map((c) => (
                      <option key={c} value={c}>
                        {CHANNEL[c].label}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            <div role="radiogroup" aria-label="Brand" className="flex self-start rounded-lg bg-inset p-0.5">
              {(["gllarix", "arcadian"] as const).map((b) => (
                <button key={b} type="button" role="radio" aria-checked={sim.brand === b} onClick={() => setSim({ ...sim, brand: b })} className={`h-8 rounded-md px-3 text-[13px] ${sim.brand === b ? "bg-surface-2 text-text shadow-card" : "text-text-2"}`}>
                  {b === "gllarix" ? "Gllarix" : "Arcadian"}
                </button>
              ))}
            </div>
            <label className="flex flex-col gap-2">
              <span className="field-label">Message</span>
              <textarea className="input min-h-[80px] py-2" value={sim.message} onChange={(e) => setSim({ ...sim, message: e.target.value })} />
            </label>
            <button type="submit" className="btn-primary">
              Send test request
            </button>
          </form>
        ) : null}
      </Modal>
    </div>
  );
};

export default Inbound;
