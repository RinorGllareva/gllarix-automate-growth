import { useCallback, useEffect, useState } from "react";
import { Route, Routes, useNavigate, useParams, useSearchParams } from "react-router-dom";
import CandidatePage, { CandidateRecord, daysIn, HireModal, ScoreBadge } from "./CandidateRecord";
import { usePageChrome } from "@/components/shell/PageChrome";
import { useDeleteWithUndo } from "@/components/ui/actions";
import { Drawer, Modal, useToast } from "@/components/ui/overlay";
import { EmptyState, Icon, ICONS, Pill, SkeletonRows } from "@/components/ui/primitives";
import type { Hue } from "@/config/colors";
import { data, HIRING_STAGE_HELP, HIRING_STAGE_LABEL, HIRING_STAGES, type Candidate, type Opening } from "@/data";

const OPENING_STATUS: Record<Opening["status"], { label: string; hue: Hue }> = {
  open: { label: "Hiring", hue: "mint" },
  draft: { label: "Draft", hue: "text-3" },
  waiting: { label: "Waiting for its gate", hue: "amber" },
  filled: { label: "Filled", hue: "cyan" },
  closed: { label: "Closed", hue: "text-3" },
};
const SOURCES: Candidate["source"][] = ["Venezuela groups", "LinkedIn", "Referral", "Other"];
/** People › Hiring: openings by stage gate, the SOP 8 pipeline with the weighted scorecard, the bench. Founders only. */
const HiringBoard = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const [board, setBoard] = useState<{ openings: Opening[]; candidates: Candidate[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const openId = params.get("open");
  const setOpenId = (cid: string | null) => {
    const next = new URLSearchParams(params);
    if (cid) next.set("open", cid);
    else next.delete("open");
    setParams(next, { replace: !cid });
  };
  const [adding, setAdding] = useState(false);
  const [newCand, setNewCand] = useState({ name: "", source: "Venezuela groups" as Candidate["source"], voiceNoteUrl: "" });
  const [editingOpening, setEditingOpening] = useState<Partial<Opening> | null>(null);
  const [showPost, setShowPost] = useState(false);
  const [start, setStart] = useState<{ candidate: Candidate } | null>(null);
  const [q, setQ] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropOn, setDropOn] = useState<string | null>(null);
  const remove = useDeleteWithUndo();
  usePageChrome({ context: "People · hiring" });

  const load = useCallback(() => data.hiringBoard().then(setBoard, (e: Error) => setError(e.message)), []);
  useEffect(() => {
    load();
  }, [load]);

  if (error) return <EmptyState title={error} />;
  if (!board) return <SkeletonRows rows={8} />;

  const opening = board.openings.find((o) => o.id === openingId) ?? board.openings.find((o) => o.status === "open") ?? board.openings[0];
  const needle = q.trim().toLowerCase();
  const cands = board.candidates.filter((c) => c.openingId === opening?.id && (!needle || `${c.name} ${c.email ?? ""} ${c.source}`.toLowerCase().includes(needle)));
  const current = board.candidates.find((c) => c.id === openId) ?? null;
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      if (ok) toast(ok, "good");
      await load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const move = (c: Candidate, status: Candidate["status"]) => run(() => data.updateCandidate(c.id, { status }), `${c.name} → ${HIRING_STAGE_LABEL[status]}`);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="page-title m-0">Hiring</h1>
          <p className="m-0 max-w-3xl text-[14px] text-text-2">
            Post → voice note → 15-minute screen → paid roleplay → paid trial week → offer. Keep the best 2 runners-up as a bench. Hire only when the role's gate is passed.
          </p>
        </div>
        <button type="button" className="btn-outline" onClick={() => setEditingOpening({ role: "", status: "draft", when: "", pay: "", owns: "", post: "" })}>
          <Icon d={ICONS.plus} size={15} /> New opening
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {board.openings.map((o) => {
          const n = board.candidates.filter((c) => c.openingId === o.id && c.status !== "rejected").length;
          const on = o.id === opening?.id;
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={on}
              onClick={() => setOpeningId(o.id)}
              className={`card flex flex-col gap-2 p-4 text-left transition-colors ${on ? "border-app" : "hover:border-line-strong"}`}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="text-[14px] font-semibold">{o.role}</span>
                <Pill hue={OPENING_STATUS[o.status].hue}>{OPENING_STATUS[o.status].label}</Pill>
              </span>
              <span className="text-[12px] text-text-3">{o.when}</span>
              <span className="text-[12px] text-text-2">{n ? `${n} candidate${n > 1 ? "s" : ""}` : "No candidates yet"}</span>
            </button>
          );
        })}
      </div>

      {opening ? (
        <section aria-label={`${opening.role} pipeline`} className="card flex min-w-0 flex-col gap-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[16px] font-semibold">{opening.role}</span>
              <span className="text-[13px] text-text-2">{opening.owns}</span>
              <span className="text-[12px] text-text-3">Pay: {opening.pay || "to define"}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {opening.post ? (
                <button type="button" className="btn-outline" aria-expanded={showPost} onClick={() => setShowPost((x) => !x)}>
                  Job post
                </button>
              ) : null}
              <input type="search" className="input h-9 w-44" placeholder="Find a candidate" aria-label="Find a candidate" value={q} onChange={(e) => setQ(e.target.value)} />
              <button type="button" className="btn-outline" onClick={() => setEditingOpening(opening)}>
                Edit
              </button>
              <button type="button" className="btn-ghost text-coral" onClick={() => remove(`Opening "${opening.role}"`, () => data.deleteOpening(opening.id), () => (setOpeningId(null), load()))}>
                Delete
              </button>
              <button type="button" className="btn-primary" onClick={() => setAdding(true)}>
                <Icon d={ICONS.plus} size={15} /> Candidate
              </button>
            </div>
          </div>
          {showPost && opening.post ? (
            <div className="flex flex-col gap-2 rounded-lg bg-inset px-4 py-3 text-[13px] leading-relaxed text-text-2">
              {opening.post}
              <button
                type="button"
                className="btn-ghost self-start"
                onClick={async () => {
                  await navigator.clipboard?.writeText(opening.post).catch(() => undefined);
                  toast("Job post copied", "good");
                }}
              >
                Copy the post
              </button>
            </div>
          ) : null}

          <div className="grid min-w-0 grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
            {HIRING_STAGES.map((st) => {
              const list = cands.filter((c) => c.status === st);
              return (
                <div
                  key={st}
                  className={`flex min-w-0 flex-col gap-2 rounded-xl p-2 transition-colors ${dropOn === st ? "bg-app/10 ring-1 ring-app" : "bg-surface-2/50"}`}
                  onDragOver={(e) => {
                    if (!dragId) return;
                    e.preventDefault();
                    setDropOn(st);
                  }}
                  onDragLeave={() => setDropOn((x) => (x === st ? null : x))}
                  onDrop={(e) => {
                    e.preventDefault();
                    const c = board.candidates.find((x) => x.id === dragId);
                    setDragId(null);
                    setDropOn(null);
                    if (!c || c.status === st) return;
                    if (st === "hired") return setStart({ candidate: c });
                    move(c, st);
                  }}
                >
                  <div className="flex flex-col px-1">
                    <span className="flex items-center justify-between text-[13px] font-medium">
                      {HIRING_STAGE_LABEL[st]}
                      <span className="text-text-3">{list.length}</span>
                    </span>
                    <span className="text-[11px] text-text-3">{HIRING_STAGE_HELP[st]}</span>
                  </div>
                  {list.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      draggable
                      onDragStart={() => setDragId(c.id)}
                      onDragEnd={() => (setDragId(null), setDropOn(null))}
                      title="Drag to the next step, or click to open"
                      onClick={() => setOpenId(c.id)}
                      className={`flex cursor-grab flex-col gap-1.5 rounded-lg bg-surface px-3 py-2.5 text-left shadow-card hover:bg-surface-2 ${dragId === c.id ? "opacity-50" : ""}`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-[13px] font-semibold">{c.name}</span>
                        {c.redFlags.length ? <Icon d="M5 21V4M5 4h11l-2 4 2 4H5" size={14} className="text-coral" /> : null}
                      </span>
                      <ScoreBadge c={c} />
                      <span className="text-[11px] text-text-3">
                        {c.source} · {daysIn(c) ? `${daysIn(c)}d in stage` : "today"}
                      </span>
                    </button>
                  ))}
                  {!list.length ? <span className="px-1 py-2 text-[12px] text-text-3">—</span> : null}
                </div>
              );
            })}
          </div>

          {(["bench", "rejected"] as const).map((st) => {
            const list = cands.filter((c) => c.status === st);
            return list.length ? (
              <div key={st} className="flex flex-wrap items-center gap-2 border-t border-line-soft pt-3 text-[13px]">
                <span className="w-24 text-text-3">{HIRING_STAGE_LABEL[st]}</span>
                {list.map((c) => (
                  <button key={c.id} type="button" onClick={() => setOpenId(c.id)} className="flex items-center gap-2 rounded-md border border-line px-2.5 py-1 hover:border-line-strong">
                    {c.name} <ScoreBadge c={c} />
                  </button>
                ))}
              </div>
            ) : null;
          })}
        </section>
      ) : (
        <EmptyState title="No openings yet. Add the first role you'll hire for." />
      )}

      {/* Candidate: the same record as /hiring/:id, in a side panel. */}
      <Drawer open={!!current} onClose={() => setOpenId(null)} title={current ? current.name : "Candidate"} width={760}>
        {current ? (
          <div className="p-5">
            <CandidateRecord id={current.id} panel onChanged={load} onGone={() => setOpenId(null)} />
          </div>
        ) : null}
      </Drawer>

      <Modal open={adding} onClose={() => setAdding(false)} title={`New candidate · ${opening?.role ?? ""}`}>
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!opening) return;
            await run(() => data.addCandidate({ openingId: opening.id, name: newCand.name, source: newCand.source, voiceNoteUrl: newCand.voiceNoteUrl }), "Candidate added");
            setNewCand({ ...newCand, name: "", voiceNoteUrl: "" });
            setAdding(false);
          }}
        >
          <label className="flex flex-col gap-2">
            <span className="field-label">Name</span>
            <input className="input" required value={newCand.name} onChange={(e) => setNewCand({ ...newCand, name: e.target.value })} />
          </label>
          <label className="flex flex-col gap-2">
            <span className="field-label">Where they came from</span>
            <select className="input" value={newCand.source} onChange={(e) => setNewCand({ ...newCand, source: e.target.value as Candidate["source"] })}>
              {SOURCES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2">
            <span className="field-label">Voice note link (optional)</span>
            <input className="input" value={newCand.voiceNoteUrl} onChange={(e) => setNewCand({ ...newCand, voiceNoteUrl: e.target.value })} />
          </label>
          <button type="submit" className="btn-primary" disabled={!newCand.name.trim()}>
            Add candidate
          </button>
        </form>
      </Modal>

      <Modal open={!!editingOpening} onClose={() => setEditingOpening(null)} title={editingOpening?.id ? "Edit opening" : "New opening"} width={620}>
        {editingOpening ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              await run(async () => {
                const o = await data.saveOpening({ ...editingOpening, role: editingOpening.role ?? "" });
                setOpeningId(o.id);
              }, "Opening saved");
              setEditingOpening(null);
            }}
          >
            <label className="flex flex-col gap-2">
              <span className="field-label">Role</span>
              <input className="input" required value={editingOpening.role ?? ""} onChange={(e) => setEditingOpening({ ...editingOpening, role: e.target.value })} />
            </label>
            <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
              <label className="flex flex-col gap-2">
                <span className="field-label">Status</span>
                <select className="input" value={editingOpening.status ?? "draft"} onChange={(e) => setEditingOpening({ ...editingOpening, status: e.target.value as Opening["status"] })}>
                  {(Object.keys(OPENING_STATUS) as Opening["status"][]).map((s) => (
                    <option key={s} value={s}>
                      {OPENING_STATUS[s].label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-2">
                <span className="field-label">When to hire (the gate)</span>
                <input className="input" value={editingOpening.when ?? ""} onChange={(e) => setEditingOpening({ ...editingOpening, when: e.target.value })} />
              </label>
            </div>
            <label className="flex flex-col gap-2">
              <span className="field-label">What they own</span>
              <input className="input" value={editingOpening.owns ?? ""} onChange={(e) => setEditingOpening({ ...editingOpening, owns: e.target.value })} />
            </label>
            <label className="flex flex-col gap-2">
              <span className="field-label">Pay</span>
              <input className="input" value={editingOpening.pay ?? ""} onChange={(e) => setEditingOpening({ ...editingOpening, pay: e.target.value })} />
            </label>
            <label className="flex flex-col gap-2">
              <span className="field-label">Job post</span>
              <textarea className="input min-h-[120px] py-2" value={editingOpening.post ?? ""} onChange={(e) => setEditingOpening({ ...editingOpening, post: e.target.value })} />
            </label>
            <button type="submit" className="btn-primary">
              Save opening
            </button>
          </form>
        ) : null}
      </Modal>

      <HireModal
        candidate={start?.candidate ?? null}
        role={opening?.role ?? "New hire"}
        onClose={() => setStart(null)}
        onHired={() => {
          setStart(null);
          load();
          navigate("/training");
        }}
      />
    </div>
  );
};

const CandidateRoute = () => {
  const { id = "" } = useParams();
  usePageChrome({ context: "People · hiring", action: { label: "All candidates", to: "/hiring" } });
  return <CandidatePage id={id} />;
};

/** /hiring (the board) and /hiring/:id (one candidate). */
const Hiring = () => (
  <Routes>
    <Route index element={<HiringBoard />} />
    <Route path=":id" element={<CandidateRoute />} />
  </Routes>
);

export default Hiring;
