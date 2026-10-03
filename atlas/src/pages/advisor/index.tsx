import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Link, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { useUser } from "@/auth/AuthContext";
import { usePageChrome } from "@/components/shell/PageChrome";
import { Drawer, useToast } from "@/components/ui/overlay";
import { EmptyState, SkeletonRows } from "@/components/ui/primitives";
import { ADVISOR_EVAL } from "@/config/advisorEval";
import { data, type AdvisorHome, type AdvisorMessage, type AdvisorRole, type AdvisorThreadView, type MemoOption, type ProposedAction } from "@/data";

const PICK_COLOR: Record<MemoOption["pick"], string> = { NO: "var(--coral)", YES: "var(--mint)", "WITH A": "var(--mint)", "WITH B": "var(--mint)", "WITH C": "var(--mint)", MAYBE: "var(--amber)" };
const EXAMPLES = [1, 2, 3, 6, 8, 14].map((n) => ADVISOR_EVAL.find((e) => e.n === n)!.question);
const fmtCall = (name: string, args: Record<string, unknown>) => {
  const a = Object.entries(args)
    .filter(([, v]) => v !== undefined && v !== "" && !(Array.isArray(v) && v.length > 3) && typeof v !== "object")
    .map(([k, v]) => `${k}=${typeof v === "string" ? `"${v.length > 24 ? `${v.slice(0, 24)}…` : v}"` : String(v)}`)
    .slice(0, 2)
    .join(", ");
  return `${name}(${a})`;
};

/** Threads list (left column, or a drawer on a phone). */
const Threads = ({ home, activeId, onPick }: { home: AdvisorHome; activeId: string | null; onPick: () => void }) => {
  const [q, setQ] = useState("");
  const list = home.threads.filter((t) => !q || t.title.toLowerCase().includes(q.toLowerCase()));
  return (
    <nav aria-label="Threads" className="flex min-h-0 flex-col gap-2">
      <span className="label-caps px-1">Threads</span>
      <input className="input h-9 text-[13px]" placeholder="Search threads" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search threads" />
      <div className="flex min-h-0 flex-col gap-1 overflow-y-auto">
        {list.map((t) => (
          <Link
            key={t.id}
            to={`/advisor/${t.id}`}
            onClick={onPick}
            className={`flex flex-col gap-1 px-3 py-2.5 ${t.id === activeId ? "bg-ice text-ice-ink" : "text-text-2 hover:bg-surface hover:text-text"}`}
          >
            <span className="truncate text-[13px]">{t.title}</span>
            <span className={`text-[10px] tracking-[0.18em] ${t.id === activeId ? "text-ice-ink" : t.kind === "alert" ? "text-amber" : "text-text-3"}`}>{t.meta}</span>
          </Link>
        ))}
        {!list.length ? <span className="px-1 text-[12px] text-text-3">{q ? "No threads match." : "No threads yet."}</span> : null}
      </div>
    </nav>
  );
};

/** Admin: draft facts waiting for approval. */
const MemoryReview = ({ home, onChange }: { home: AdvisorHome; onChange: () => void }) => {
  const toast = useToast();
  const drafts = home.memory.filter((m) => m.status === "draft");
  const approved = home.memory.filter((m) => m.status === "approved");
  return (
    <section aria-label="Memory" className="flex flex-col gap-2 border-t border-line pt-3">
      <span className="label-caps px-1">Memory · {approved.length}</span>
      {approved.slice(-3).map((m) => (
        <span key={m.id} className="px-1 text-[12px] text-text-2">
          {m.fact}
        </span>
      ))}
      {home.can.admin
        ? drafts.map((m) => (
            <div key={m.id} className="flex flex-col gap-1.5 border border-amber-line p-2 text-[12px]">
              <span>{m.fact}</span>
              <div className="flex gap-2">
                <button type="button" className="btn-outline h-7 text-[11px]" onClick={() => data.reviewMemory(m.id, true).then(() => { toast("Remembered", "good"); onChange(); })}>
                  Approve
                </button>
                <button type="button" className="btn-ghost h-7 text-[11px]" onClick={() => data.reviewMemory(m.id, false).then(onChange)}>
                  Reject
                </button>
              </div>
            </div>
          ))
        : drafts.length ? <span className="px-1 text-[11px] text-text-3">{drafts.length} waiting for an admin</span> : null}
    </section>
  );
};

/** 0 → 1 over `ms` from when `key` changes, by elapsed time (so throttled timers in a background tab still finish). */
const useProgress = (key: string | null, animate: boolean, ms: number) => {
  const [p, setP] = useState(animate ? 0 : 1);
  useEffect(() => {
    if (!animate || ms <= 0) return setP(1);
    const start = Date.now();
    setP(0);
    const t = window.setInterval(() => {
      const v = Math.min(1, (Date.now() - start) / ms);
      setP(v);
      if (v >= 1) window.clearInterval(t);
    }, 30);
    return () => window.clearInterval(t);
  }, [key, animate, ms]);
  return p;
};

/** Reveals text progressively (the demo's stand-in for the streamed answer). */
const useReveal = (text: string, animate: boolean) => text.slice(0, Math.ceil(text.length * useProgress(text, animate, 600)));

const AnswerCard = ({ m, selected, onSelect, fresh, onRemember }: { m: AdvisorMessage; selected: boolean; onSelect: () => void; fresh: boolean; onRemember: () => void }) => {
  const a = m.answer!;
  const shortText = useReveal(a.short, fresh);
  const done = shortText.length === a.short.length;
  return (
    <article
      onClick={onSelect}
      className={`flex cursor-pointer flex-col gap-4 border bg-surface p-5 ${selected ? "border-line-strong" : "border-line"}`}
      aria-label={a.kind === "memo" ? "Board memo" : "Answer"}
    >
      {a.kind === "memo" ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="label-caps text-text">Board memo</span>
          {a.hats.map((h) => (
            <span key={h} className="border border-line-strong px-2 py-0.5 text-[10px] tracking-[0.18em] text-text-2">
              {h}
            </span>
          ))}
          <span className="ml-auto text-[12px] font-medium text-amber">Confidence · {a.confidence}</span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-[10px] tracking-[0.18em] text-text-3">
          {a.hats.map((h) => (
            <span key={h}>{h}</span>
          ))}
        </div>
      )}
      <p className={`m-0 font-light leading-snug ${a.kind === "memo" ? "text-[17px]" : "text-[15px]"} ${a.kind === "refusal" ? "text-amber" : ""}`}>{shortText}</p>
      {done && a.body ? <p className="m-0 whitespace-pre-line text-[13px] leading-relaxed text-text-2">{a.body}</p> : null}
      {done && a.options?.length ? (
        <div className="overflow-x-auto border border-line">
          <div className="grid min-w-[560px] grid-cols-[1.6fr_1fr_0.8fr_1.4fr_70px] gap-3 border-b border-line px-3 py-2 text-[10px] tracking-[0.2em] text-label bg-surface-2">
            <span>OPTION</span>
            <span>Cost / mo</span>
            <span>Effect in</span>
            <span>RISK</span>
            <span>PICK</span>
          </div>
          {a.options.map((o) => (
            <div key={o.name} className="grid min-w-[560px] grid-cols-[1.6fr_1fr_0.8fr_1.4fr_70px] items-center gap-3 border-b border-line-soft px-3 py-2.5 text-[13px] last:border-b-0">
              <span>{o.name}</span>
              <span className="font-mono text-text-2">{o.cost}</span>
              <span className="text-text-2">{o.effect}</span>
              <span className="text-[12px] text-text-2">{o.risk}</span>
              <span className="text-[10px] tracking-[0.18em]" style={{ color: PICK_COLOR[o.pick] }}>
                {o.pick}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      {done && (a.fastest || a.profitable) ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {a.fastest ? (
            <div className="flex flex-col gap-1.5 border border-line p-3">
              <span className="label-caps" style={{ color: "var(--mint)" }}>
                Fastest route
              </span>
              <span className="text-[13px] text-text-2">{a.fastest}</span>
            </div>
          ) : null}
          {a.profitable ? (
            <div className="flex flex-col gap-1.5 border border-line p-3">
              <span className="label-caps" style={{ color: "var(--lavender)" }}>
                Most profitable
              </span>
              <span className="text-[13px] text-text-2">{a.profitable}</span>
            </div>
          ) : null}
        </div>
      ) : null}
      {done && a.risks?.length ? (
        <div className="flex flex-col gap-1.5">
          <span className="label-caps text-amber">Risks</span>
          {a.risks.map((r) => (
            <span key={r} className="text-[13px] text-text-2">
              {r}
            </span>
          ))}
        </div>
      ) : null}
      {done && a.measure?.length ? <span className="text-[12px] text-text-3">Measure: {a.measure.join(" · ")}</span> : null}
      {done && a.professional ? <span className="border-l-2 border-amber pl-3 text-[12px] text-amber">{a.professional}</span> : null}
      {done && a.unsourced.length ? <span className="text-[12px] text-coral">Unsourced figures: {a.unsourced.join(", ")}. Treat them as judgment.</span> : null}
      <div className="flex flex-wrap items-center gap-3 border-t border-line-soft pt-3 text-[11px] text-text-3">
        <span>{m.model}</span>
        <span>${(m.costMinor / 100).toFixed(3)}</span>
        <span>{m.knowledgeVersion}</span>
        <button
          type="button"
          className="ml-auto text-text-2 hover:text-text"
          onClick={(e) => {
            e.stopPropagation();
            onRemember();
          }}
        >
          Remember this
        </button>
      </div>
    </article>
  );
};

const ActionCard = ({ a, canDecide, onDone }: { a: ProposedAction; canDecide: boolean; onDone: () => void }) => {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const accept = async () => {
    setBusy(true);
    try {
      const r = await data.acceptAdvisorAction(a.id);
      toast(a.kind === "tasks" ? `${r.createdIds.length} tasks created` : a.kind === "decision" ? "Logged as a proposed decision" : "Draft saved", "good");
      onDone();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  const status = a.status !== "draft" ? <span className={`text-[12px] font-medium capitalize ${a.status === "accepted" ? "text-mint" : "text-text-3"}`}>{a.status}</span> : null;
  if (a.kind === "tasks")
    return (
      <div className="flex flex-col gap-2">
        {a.tasks!.map((t) => (
          <div key={t.title} className="flex flex-col gap-0.5 border border-line p-2.5 text-[13px]">
            <span>{t.title}</span>
            <span className="text-[11px] text-text-3">
              {t.ownerName} · {t.hours} h · {t.due}
            </span>
          </div>
        ))}
        {status ?? (
          <div className="flex gap-2">
            <button type="button" className="btn-primary h-10 flex-1 text-[11px] tracking-[0.2em]" disabled={busy} onClick={accept}>
              Accept {a.tasks!.length} tasks
            </button>
            <button type="button" className="btn-ghost h-10 text-[12px]" onClick={() => data.dismissAdvisorAction(a.id).then(onDone)}>
              Dismiss
            </button>
          </div>
        )}
      </div>
    );
  return (
    <div className="flex flex-col gap-2 border border-line p-2.5 text-[13px]">
      <span>{a.kind === "decision" ? a.decision!.title : a.document!.title}</span>
      {a.document ? <pre className="m-0 max-h-48 overflow-y-auto whitespace-pre-wrap font-sans text-[12px] text-text-2">{a.document.content}</pre> : null}
      {status ?? (
        <button type="button" className="btn-outline h-9 text-[11px] tracking-[0.18em]" disabled={busy || (a.kind === "decision" && !canDecide)} onClick={accept}>
          {a.kind === "decision" ? "Log as proposed decision" : "Save draft"}
        </button>
      )}
    </div>
  );
};

/** Right panel for the selected answer: every tool call, the assumptions, and the proposed actions. */
const SidePanel = ({ m, actions, admin, onChange, reveal }: { m: AdvisorMessage | null; actions: ProposedAction[]; admin: boolean; onChange: () => void; reveal: boolean }) => {
  const toast = useToast();
  // Tool calls appear one by one, as they would while the answer streams.
  const progress = useProgress(m?.id ?? null, reveal && !!m, 140 * (m?.toolCalls.length ?? 0));
  const shown = Math.round(progress * (m?.toolCalls.length ?? 0));
  if (!m) return <p className="m-0 text-[13px] text-text-3">Select an answer to see the data it used.</p>;
  const mine = actions.filter((a) => a.messageId === m.id);
  const memo = m.answer?.kind === "memo";
  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Data used" className="flex flex-col gap-2.5 border border-line rounded-lg bg-surface p-4">
        <span className="label-caps">Data it used</span>
        {m.toolCalls.slice(0, shown).map((c, i) => (
          <div key={i} className="flex gap-2.5 text-[12px]">
            <span style={{ color: c.ok ? "var(--mint)" : "var(--coral)" }}>{c.ok ? "✓" : "✗"}</span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate font-mono text-text">{fmtCall(c.name, c.args)}</span>
              <span className="text-text-2">{c.summary}</span>
            </div>
          </div>
        ))}
        {shown < m.toolCalls.length ? <span className="text-[12px] text-text-3">Running tools…</span> : null}
        {!m.toolCalls.length ? <span className="text-[12px] text-text-3">No tools needed.</span> : null}
      </section>
      {m.answer?.assumptions.length ? (
        <section aria-label="Assumptions" className="flex flex-col gap-1.5 border border-amber-line p-4 text-[12px]">
          <span className="label-caps text-amber">Assumptions</span>
          {m.answer.assumptions.map((x) => (
            <span key={x.text} className="text-text-2">
              {x.text} <span className="text-text-3">· {x.source}</span>
            </span>
          ))}
        </section>
      ) : null}
      {mine.length || (memo && admin) ? (
        <section aria-label="Proposed actions" className="flex flex-col gap-2.5 border border-line p-4">
          <span className="label-caps">Proposed actions</span>
          {mine.map((a) => (
            <ActionCard key={a.id} a={a} canDecide={admin} onDone={onChange} />
          ))}
          {memo && admin ? (
            <button
              type="button"
              className="btn-outline h-10 text-[11px] tracking-[0.2em]"
              onClick={() => data.logMemoAsDecision(m.id).then(() => toast("Logged as a proposed decision", "good"), (e: Error) => toast(e.message, "error"))}
            >
              LOG AS PROPOSED DECISION
            </button>
          ) : null}
          <span className="text-[11px] text-text-3">Nothing is created, sent or changed until a person accepts.</span>
        </section>
      ) : null}
    </div>
  );
};

/** /advisor and /advisor/:threadId (screen 26). */
const AdvisorPage = () => {
  const user = useUser();
  const toast = useToast();
  const navigate = useNavigate();
  const { threadId = null } = useParams();
  const [home, setHome] = useState<AdvisorHome | null>(null);
  const [view, setView] = useState<AdvisorThreadView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [role, setRole] = useState<AdvisorRole | "">("");
  const [pending, setPending] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const loadHome = useCallback(async () => {
    try {
      if (user.role === "admin") await data.runAdvisorJobs();
      setHome(await data.advisorHome());
    } catch (e) {
      setError((e as Error).message);
    }
  }, [user.role]);
  const loadThread = useCallback(async () => {
    if (!threadId) return setView(null);
    try {
      setView(await data.getAdvisorThread(threadId));
    } catch (e) {
      toast((e as Error).message, "error");
      navigate("/advisor", { replace: true });
    }
  }, [threadId, navigate, toast]);
  useEffect(() => {
    loadHome();
  }, [loadHome]);
  useEffect(() => {
    loadThread();
    setSelectedId(null);
  }, [loadThread]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [view?.messages.length, pending]);

  usePageChrome({ context: "AI CO-FOUNDER · ADVISES, NEVER ACTS ALONE", action: { label: "New question", to: "/advisor" } });

  const answers = useMemo(() => view?.messages.filter((m) => m.role === "assistant") ?? [], [view]);
  const selected = answers.find((m) => m.id === selectedId) ?? answers[answers.length - 1] ?? null;

  const send = async (q = text) => {
    const question = q.trim();
    if (!question || pending) return;
    setPending(question);
    setText("");
    try {
      const r = await data.askAdvisor({ threadId: threadId ?? undefined, text: question, roleHint: role || null });
      setFresh(r.message.id);
      setSelectedId(r.message.id);
      if (r.threadId !== threadId) navigate(`/advisor/${r.threadId}`);
      else await loadThread();
      setHome(await data.advisorHome());
    } catch (e) {
      toast((e as Error).message, "error");
      setText(question);
    } finally {
      setPending(null);
    }
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };
  const remember = async (m: AdvisorMessage) => {
    const fact = window.prompt("Fact for the AI co-founder to remember (an admin approves it):", m.answer?.short ?? "");
    if (!fact?.trim()) return;
    try {
      await data.rememberFromMessage(m.id, fact);
      toast(user.role === "admin" ? "Draft fact added: approve it under Memory" : "Sent to an admin for approval", "good");
      setHome(await data.advisorHome());
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  if (error) return <EmptyState title={error} />;
  if (!home) return <SkeletonRows rows={8} />;

  return (
    <div className="-mx-4 -my-5 sm:-mx-5 sm:-my-6 grid min-h-[calc(100vh-72px)] grid-cols-1 lg:-mx-10 lg:-my-8 lg:grid-cols-[220px_minmax(0,1fr)] 2xl:grid-cols-[220px_minmax(0,1fr)_290px]">
      <aside className="hidden flex-col gap-4 border-r border-line px-4 py-6 lg:flex">
        <Threads home={home} activeId={threadId} onPick={() => undefined} />
        <MemoryReview home={home} onChange={loadHome} />
      </aside>
      <Drawer open={drawer} onClose={() => setDrawer(false)} title="Threads">
        <Threads home={home} activeId={threadId} onPick={() => setDrawer(false)} />
        <div className="mt-4">
          <MemoryReview home={home} onChange={loadHome} />
        </div>
      </Drawer>

      <section aria-label="Conversation" className="flex min-w-0 flex-col">
        <div className="flex items-center gap-3 border-b border-line px-5 py-3 lg:hidden">
          <button type="button" className="btn-outline h-9 text-[12px]" onClick={() => setDrawer(true)}>
            Threads · {home.threads.length}
          </button>
          <Link to="/advisor" className="btn-ghost h-9 text-[12px]">
            New question
          </Link>
        </div>
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-6 lg:px-8">
          {!view && !pending ? (
            <div className="flex flex-col gap-4">
              <span className="label-caps">Ask anything about the business</span>
              <h1 className="page-title m-0">What should we decide?</h1>
              <p className="m-0 max-w-xl text-[14px] text-text-2">
                Answers use the company files and live Atlas data you're allowed to see. Every number shows its source; nothing is sent, paid, priced or signed without a person.
              </p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLES.map((q) => (
                  <button key={q} type="button" className="border border-line px-3 py-2 text-left text-[13px] text-text-2 hover:border-line-strong hover:text-text" onClick={() => send(q)}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {view?.messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="ml-auto max-w-[80%] border border-line-strong px-4 py-3 text-[14px]">
                {m.roleHint ? <span className="mr-2 text-[12px] font-medium text-text-3">As {m.roleHint}</span> : null}
                {m.content}
              </div>
            ) : (
              <div key={m.id} className="flex flex-col gap-3">
                <AnswerCard m={m} selected={selected?.id === m.id} onSelect={() => setSelectedId(m.id)} fresh={fresh === m.id} onRemember={() => remember(m)} />
                {/* On narrow screens the panel sits under its answer. */}
                {selected?.id === m.id ? (
                  <div className="2xl:hidden">
                    <SidePanel m={m} actions={view.actions} admin={user.role === "admin"} onChange={loadThread} reveal={fresh === m.id} />
                  </div>
                ) : null}
              </div>
            ),
          )}
          {pending ? (
            <>
              <div className="ml-auto max-w-[80%] border border-line-strong px-4 py-3 text-[14px]">{pending}</div>
              <div className="border border-line rounded-lg bg-surface p-5 text-[13px] text-text-3">Reading the files and running tools as you…</div>
            </>
          ) : null}
          <div ref={endRef} />
        </div>
        {home.blocked ? <p className="m-0 border-t border-amber-line px-5 py-2 text-[12px] text-amber">The monthly AI cap (€{home.capMinor / 100}) is reached. Questions start again next month, or an admin raises the cap.</p> : null}
        <form
          className="flex items-end gap-2 border-t border-line px-5 py-4 lg:px-8"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <textarea
            aria-label="Ask the AI co-founder"
            className="input min-h-[44px] flex-1 resize-none py-2.5 text-[14px]"
            rows={1}
            placeholder="Ask about pricing, cash, hiring, a client, a risk…"
            value={text}
            disabled={home.blocked}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKey}
          />
          <select className="input w-auto text-[13px]" value={role} onChange={(e) => setRole(e.target.value as AdvisorRole | "")} aria-label="Role">
            <option value="">All roles</option>
            {home.can.roles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button type="submit" aria-label="Send" className="btn-primary h-[44px] w-[44px] justify-center px-0" disabled={!text.trim() || !!pending || home.blocked}>
            →
          </button>
        </form>
        <span className="px-5 pb-3 text-[11px] text-text-3 lg:px-8">Knowledge: {home.knowledgeVersion} · AI this month €{(home.spendMinor / 100).toFixed(2)} of €{home.capMinor / 100}</span>
      </section>

      <aside className="hidden border-l border-line px-5 py-6 2xl:block">
        <SidePanel m={selected} actions={view?.actions ?? []} admin={user.role === "admin"} onChange={loadThread} reveal={fresh === selected?.id} />
      </aside>
    </div>
  );
};

const AdvisorModule = () => (
  <Routes>
    <Route index element={<AdvisorPage />} />
    <Route path=":threadId" element={<AdvisorPage />} />
  </Routes>
);

export default AdvisorModule;
