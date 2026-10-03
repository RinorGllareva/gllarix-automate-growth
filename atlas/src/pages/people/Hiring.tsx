import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePageChrome } from "@/components/shell/PageChrome";
import { Drawer, Modal, useToast } from "@/components/ui/overlay";
import { EmptyState, Icon, ICONS, Pill, SkeletonRows } from "@/components/ui/primitives";
import type { Hue } from "@/config/colors";
import { data, HIRING_STAGE_HELP, HIRING_STAGE_LABEL, HIRING_STAGES, RED_FLAGS, SCORECARD, type Candidate, type Opening } from "@/data";
import { scoreVerdict, weightedScore } from "@/services/people";

const DAY = 86_400_000;
const OPENING_STATUS: Record<Opening["status"], { label: string; hue: Hue }> = {
  open: { label: "Hiring", hue: "mint" },
  draft: { label: "Draft", hue: "text-3" },
  waiting: { label: "Waiting for its gate", hue: "amber" },
  filled: { label: "Filled", hue: "cyan" },
  closed: { label: "Closed", hue: "text-3" },
};
const SOURCES: Candidate["source"][] = ["Venezuela groups", "LinkedIn", "Referral", "Other"];
const daysIn = (c: Candidate) => Math.max(0, Math.floor((Date.now() - new Date(c.stageChangedAt).getTime()) / DAY));

const ScoreBadge = ({ c }: { c: Candidate }) => {
  const w = weightedScore(c.scores);
  const v = scoreVerdict(w.score, c.redFlags.length);
  return (
    <Pill hue={v.hue} dot className="self-start">
      {w.score === null ? v.label : `${w.score} · ${v.label}`}
    </Pill>
  );
};

/** People › Hiring: openings by stage gate, the SOP 8 pipeline with the weighted scorecard, the bench. Founders only. */
const Hiring = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const [board, setBoard] = useState<{ openings: Opening[]; candidates: Candidate[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newCand, setNewCand] = useState({ name: "", source: "Venezuela groups" as Candidate["source"], voiceNoteUrl: "" });
  const [editingOpening, setEditingOpening] = useState<Partial<Opening> | null>(null);
  const [showPost, setShowPost] = useState(false);
  const [start, setStart] = useState<{ candidate: Candidate; date: string } | null>(null);
  usePageChrome({ context: "People · hiring" });

  const load = useCallback(() => data.hiringBoard().then(setBoard, (e: Error) => setError(e.message)), []);
  useEffect(() => {
    load();
  }, [load]);

  if (error) return <EmptyState title={error} />;
  if (!board) return <SkeletonRows rows={8} />;

  const opening = board.openings.find((o) => o.id === openingId) ?? board.openings.find((o) => o.status === "open") ?? board.openings[0];
  const cands = board.candidates.filter((c) => c.openingId === opening?.id);
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
              <button type="button" className="btn-outline" onClick={() => setEditingOpening(opening)}>
                Edit
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
                <div key={st} className="flex min-w-0 flex-col gap-2 rounded-xl bg-surface-2/50 p-2">
                  <div className="flex flex-col px-1">
                    <span className="flex items-center justify-between text-[13px] font-medium">
                      {HIRING_STAGE_LABEL[st]}
                      <span className="text-text-3">{list.length}</span>
                    </span>
                    <span className="text-[11px] text-text-3">{HIRING_STAGE_HELP[st]}</span>
                  </div>
                  {list.map((c) => (
                    <button key={c.id} type="button" onClick={() => setOpenId(c.id)} className="flex flex-col gap-1.5 rounded-lg bg-surface px-3 py-2.5 text-left shadow-card hover:bg-surface-2">
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

      {/* Candidate: scorecard, red flags, notes and moves. */}
      <Drawer open={!!current} onClose={() => setOpenId(null)} title={current ? current.name : "Candidate"} width={520}>
        {current ? (
          <div className="flex flex-col gap-5 p-5">
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-text-2">
              <Pill hue="cyan" dot>
                {HIRING_STAGE_LABEL[current.status]}
              </Pill>
              <span>{current.source}</span>
              <span>· {daysIn(current)}d in stage</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {(() => {
                const i = HIRING_STAGES.indexOf(current.status as (typeof HIRING_STAGES)[number]);
                const next = i >= 0 && i < HIRING_STAGES.length - 1 ? HIRING_STAGES[i + 1] : null;
                return (
                  <>
                    {next && next !== "hired" ? (
                      <button type="button" className="btn-primary" onClick={() => move(current, next)}>
                        Move to {HIRING_STAGE_LABEL[next].toLowerCase()} <Icon d={ICONS.arrow} size={14} />
                      </button>
                    ) : null}
                    {current.status === "offer" ? (
                      <button type="button" className="btn-primary" onClick={() => setStart({ candidate: current, date: new Date(Date.now() + 3 * DAY).toISOString().slice(0, 10) })}>
                        Hire and start training
                      </button>
                    ) : null}
                    {i > 0 && current.status !== "hired" ? (
                      <button type="button" className="btn-outline" onClick={() => move(current, HIRING_STAGES[i - 1])}>
                        Back a step
                      </button>
                    ) : null}
                    {current.status !== "bench" && current.status !== "hired" ? (
                      <button type="button" className="btn-outline" onClick={() => move(current, "bench")}>
                        To the bench
                      </button>
                    ) : null}
                    {current.status === "bench" || current.status === "rejected" ? (
                      <button type="button" className="btn-outline" onClick={() => move(current, "applied")}>
                        Back into the pipeline
                      </button>
                    ) : null}
                    {current.status !== "rejected" && current.status !== "hired" ? (
                      <button type="button" className="btn-danger" onClick={() => move(current, "rejected")}>
                        Not a fit
                      </button>
                    ) : null}
                  </>
                );
              })()}
            </div>

            <section aria-label="Scorecard" className="flex flex-col gap-3">
              <span className="flex items-center justify-between">
                <span className="text-[14px] font-semibold">Scorecard</span>
                <ScoreBadge c={current} />
              </span>
              {SCORECARD.map((k) => (
                <div key={k.key} className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="flex min-w-0 flex-col">
                    <span>{k.label}</span>
                    <span className="text-[11px] text-text-3">{k.weight}% of the score</span>
                  </span>
                  <div role="radiogroup" aria-label={k.label} className="flex shrink-0 rounded-lg bg-inset p-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={current.scores[k.key] === n}
                        onClick={() => run(() => data.updateCandidate(current.id, { scores: { [k.key]: n } }))}
                        className={`h-7 w-7 rounded-md text-[12px] ${current.scores[k.key] === n ? "bg-surface-2 text-text shadow-card" : "text-text-3 hover:text-text"}`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <span className="text-[12px] text-text-3">1 = weak, 5 = excellent. 70+ with no red flags is a strong candidate; the founders decide.</span>
            </section>

            <section aria-label="Red flags" className="flex flex-col gap-2">
              <span className="text-[14px] font-semibold">Red flags</span>
              <div className="flex flex-wrap gap-2">
                {RED_FLAGS.map((f) => {
                  const on = current.redFlags.includes(f);
                  return (
                    <button
                      key={f}
                      type="button"
                      aria-pressed={on}
                      onClick={() => run(() => data.updateCandidate(current.id, { redFlags: on ? current.redFlags.filter((x) => x !== f) : [...current.redFlags, f] }))}
                      className={`h-8 rounded-lg border px-3 text-[12px] ${on ? "border-coral/60 bg-coral-tint text-coral" : "border-line text-text-2 hover:border-line-strong"}`}
                    >
                      {f}
                    </button>
                  );
                })}
              </div>
            </section>

            <label className="flex flex-col gap-1.5">
              <span className="field-label">Voice note link</span>
              <input className="input" defaultValue={current.voiceNoteUrl ?? ""} key={`v-${current.id}`} placeholder="WhatsApp or Drive link" onBlur={(e) => e.target.value !== (current.voiceNoteUrl ?? "") && run(() => data.updateCandidate(current.id, { voiceNoteUrl: e.target.value || null }))} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="field-label">Notes</span>
              <textarea className="input min-h-[96px] py-2" defaultValue={current.notes} key={`n-${current.id}`} onBlur={(e) => e.target.value !== current.notes && run(() => data.updateCandidate(current.id, { notes: e.target.value }), "Notes saved")} />
            </label>
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

      <Modal open={!!start} onClose={() => setStart(null)} title={start ? `Hire ${start.candidate.name}` : "Hire"}>
        {start ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              await run(() => data.startTraining({ candidateId: start.candidate.id, role: opening?.role ?? "New hire", startDate: start.date }), `${start.candidate.name} is hired. Training starts ${start.date}.`);
              setStart(null);
              setOpenId(null);
              navigate("/training");
            }}
          >
            <p className="m-0 text-[14px] text-text-2">This marks them hired, fills the opening, and starts the 10-day training. Send the contractor agreement (30-day trial) before day 1.</p>
            <label className="flex flex-col gap-2">
              <span className="field-label">Training starts</span>
              <input type="date" className="input" value={start.date} onChange={(e) => setStart({ ...start, date: e.target.value })} />
            </label>
            <button type="submit" className="btn-primary">
              Hire and start training
            </button>
          </form>
        ) : null}
      </Modal>
    </div>
  );
};

export default Hiring;
