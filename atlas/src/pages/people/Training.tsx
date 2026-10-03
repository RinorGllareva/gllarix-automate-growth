import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useUser } from "@/auth/AuthContext";
import { usePageChrome } from "@/components/shell/PageChrome";
import { Modal, useToast } from "@/components/ui/overlay";
import { Avatar, EmptyState, Icon, ICONS, Pill, SkeletonRows } from "@/components/ui/primitives";
import { data, TRAINING_ASSETS, TRAINING_BLOCKS, type TrainingView, type User } from "@/data";
import { tableDate } from "@/lib/format";
import { gateEvidence, QUIZ_PASS, ROLEPLAY_PASS } from "@/services/people";

type TraineeRow = TrainingView["trainees"][number];

const ONGOING = [
  { text: "Daily coaching in the overlap hours", to: null },
  { text: "3 recorded calls scored every week", to: "/team" },
  { text: "Saturday 1:1 on the scorecard", to: "/team" },
  { text: "Monthly update of the objection library", to: null },
];

/** People › Training: the 10-day program with a gate per block, the assets needed before day 1, and the weekly rhythm after. */
const Training = () => {
  const me = useUser();
  const toast = useToast();
  const [view, setView] = useState<TrainingView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [scoreInput, setScoreInput] = useState<Record<string, string>>({});
  const [starting, setStarting] = useState<{ userId: string; name: string; role: string; date: string } | null>(null);
  const [people, setPeople] = useState<User[]>([]);
  usePageChrome({ context: view?.canEdit ? "People · training" : "People · your training" });

  const load = useCallback(() => data.trainingView().then(setView, (e: Error) => setError(e.message)), []);
  useEffect(() => {
    load();
    if (me.role === "admin") data.listUsers().then(setPeople, () => setPeople([]));
  }, [load, me.role]);

  if (error) return <EmptyState title={error} />;
  if (!view) return <SkeletonRows rows={8} />;

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      if (ok) toast(ok, "good");
      await load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const t: TraineeRow | undefined = view.trainees.find((x) => x.id === selected) ?? view.trainees[0];
  const assetsReady = TRAINING_ASSETS.filter((a) => view.assets[a]).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="page-title m-0">Training</h1>
          <p className="m-0 max-w-3xl text-[14px] text-text-2">
            Ten working days, six blocks. Each block ends with a gate; the next one opens when the gate is passed. Day 10 ends with being certified to close alone.
          </p>
        </div>
        {view.canEdit ? (
          <button type="button" className="btn-outline" onClick={() => setStarting({ userId: "", name: "", role: "BDR, full-cycle", date: new Date().toISOString().slice(0, 10) })}>
            <Icon d={ICONS.plus} size={15} /> Start a program
          </button>
        ) : null}
      </div>

      {!view.trainees.length ? (
        <EmptyState title={view.canEdit ? "Nobody is in training. Hire from People › Hiring, or start a program for someone on the team." : "You don't have a training program. Your founder starts one when you join."} />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)_300px]">
          <nav aria-label="People in training" className="flex flex-col gap-2">
            {view.trainees.map((x) => {
              const on = x.id === t?.id;
              const done = TRAINING_BLOCKS.filter((b) => x.blocks[b.key].passedAt).length;
              return (
                <button key={x.id} type="button" aria-current={on || undefined} onClick={() => setSelected(x.id)} className={`card flex flex-col gap-2 p-3.5 text-left ${on ? "border-app" : "hover:border-line-strong"}`}>
                  <span className="flex items-center gap-2.5">
                    <Avatar id={x.userId ?? x.id} name={x.name} size={28} />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-[14px] font-semibold">{x.name}</span>
                      <span className="truncate text-[12px] text-text-3">{x.role}</span>
                    </span>
                  </span>
                  <span className="h-1.5 rounded-full bg-line">
                    <span className="block h-1.5 rounded-full bg-app" style={{ width: `${(done / TRAINING_BLOCKS.length) * 100}%` }} />
                  </span>
                  <span className="text-[12px] text-text-2">{x.certifiedAt ? "Certified" : x.day ? `Day ${x.day} of 10 · ${done} of 6 gates` : `Starts ${tableDate(`${x.startDate}T12:00:00Z`)}`}</span>
                </button>
              );
            })}
          </nav>

          {t ? (
            <section aria-label={`${t.name}'s program`} className="flex min-w-0 flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col">
                  <span className="text-[17px] font-semibold">{t.name}</span>
                  <span className="text-[13px] text-text-2">
                    {t.role} · started {tableDate(`${t.startDate}T12:00:00Z`)}
                  </span>
                </div>
                {t.certifiedAt ? (
                  <Pill hue="mint" dot>
                    Certified {tableDate(t.certifiedAt)}
                  </Pill>
                ) : (
                  <Pill hue="cyan" dot>
                    {t.day ? `Day ${t.day} of 10` : "Not started"}
                  </Pill>
                )}
              </div>
              <ol className="m-0 flex list-none flex-col gap-3 p-0">
                {TRAINING_BLOCKS.map((b, i) => {
                  const p = t.blocks[b.key];
                  const ev = gateEvidence(b.key, p, t.firstApprovedMeetingAt);
                  const passed = !!p.passedAt;
                  const isCurrent = i === t.current;
                  const locked = i > t.current;
                  const pass = b.kind === "quiz" ? QUIZ_PASS : ROLEPLAY_PASS;
                  return (
                    <li key={b.key} aria-current={isCurrent ? "step" : undefined} className={`card flex flex-col gap-3 p-4 ${isCurrent ? "border-app" : ""} ${locked ? "opacity-60" : ""}`}>
                      <div className="flex items-start gap-3">
                        <span
                          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold"
                          style={{ background: passed ? "var(--mint)" : isCurrent ? "color-mix(in srgb, var(--app) 25%, transparent)" : "var(--surface-2)", color: passed ? "var(--ice-ink)" : "var(--text-2)" }}
                        >
                          {passed ? <Icon d="M5 12l5 5L20 7" size={13} /> : i + 1}
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-[14px] font-semibold">{b.title}</span>
                            <span className="text-[12px] text-text-3">{b.days}</span>
                          </span>
                          <span className="text-[13px] text-text-2">{b.content}</span>
                          <span className="text-[13px]">
                            <span className="text-text-3">Gate: </span>
                            {b.gate}
                          </span>
                        </div>
                        {passed ? (
                          <Pill hue="mint">Passed</Pill>
                        ) : isCurrent ? (
                          <Pill hue="cyan">Now</Pill>
                        ) : null}
                      </div>

                      {!locked ? (
                        <div className="flex flex-col gap-2 border-t border-line-soft pt-3 pl-9">
                          {b.kind === "roleplays" || b.kind === "quiz" ? (
                            <div className="flex flex-wrap items-center gap-2 text-[13px]">
                              <span className="text-text-3">{b.kind === "quiz" ? "Quiz" : "Roleplays"}:</span>
                              {p.scores.length ? (
                                p.scores.map((sc, k) => (
                                  <span key={k} className={`num rounded-md px-2 py-0.5 text-[12px] ${sc >= pass ? "bg-mint-tint text-mint" : "bg-surface-2 text-text-2"}`}>
                                    {sc}/10
                                  </span>
                                ))
                              ) : (
                                <span className="text-text-3">none yet</span>
                              )}
                              {view.canEdit && !passed ? (
                                <form
                                  className="flex items-center gap-1.5"
                                  onSubmit={async (e) => {
                                    e.preventDefault();
                                    const v = Number(scoreInput[b.key]);
                                    if (scoreInput[b.key] === undefined || scoreInput[b.key] === "") return;
                                    await run(() => data.addBlockScore(t.id, b.key, v));
                                    setScoreInput({ ...scoreInput, [b.key]: "" });
                                  }}
                                >
                                  <input type="number" min={0} max={10} step={0.5} aria-label={`Add a ${b.kind === "quiz" ? "quiz" : "roleplay"} score`} className="input h-8 w-20" placeholder="/10" value={scoreInput[b.key] ?? ""} onChange={(e) => setScoreInput({ ...scoreInput, [b.key]: e.target.value })} />
                                  <button type="submit" className="btn-outline h-8">
                                    Add score
                                  </button>
                                </form>
                              ) : null}
                            </div>
                          ) : null}
                          <span className={`flex items-center gap-1.5 text-[13px] ${ev.met ? "text-mint" : "text-text-2"}`}>
                            <Icon d={ev.met ? "M5 12l5 5L20 7" : "M12 8v5M12 16h.01"} size={14} />
                            {b.kind === "meeting" && t.firstApprovedMeetingAt ? `Approved meeting on ${tableDate(t.firstApprovedMeetingAt)}` : ev.text}
                          </span>
                          {p.note ? <span className="text-[12px] text-text-3">Note: {p.note}</span> : null}
                          {view.canEdit ? (
                            <div className="flex flex-wrap gap-2">
                              {!passed ? (
                                <button type="button" className="btn-primary h-8" disabled={!ev.met || !isCurrent} title={!ev.met ? `Not yet: ${ev.text}` : undefined} onClick={() => run(() => data.setBlockPassed(t.id, b.key, true), `${b.title}: gate passed`)}>
                                  {b.key === "certify" ? "Certify to close alone" : "Pass the gate"}
                                </button>
                              ) : (
                                <button type="button" className="btn-outline h-8" onClick={() => run(() => data.setBlockPassed(t.id, b.key, false), `${b.title} reopened`)}>
                                  Reopen
                                </button>
                              )}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </section>
          ) : null}

          <aside className="flex flex-col gap-4">
            {view.canEdit ? (
              <section aria-label="Objections heard" className="card flex flex-col gap-2.5 p-4">
                <span className="text-[14px] font-semibold">Objections heard · 30 days</span>
                {view.objections.length ? (
                  view.objections.slice(0, 8).map((o) => (
                    <span key={o.label} className="flex items-center gap-2.5 text-[13px]">
                      <span className="num w-6 shrink-0 text-right font-semibold">{o.count}</span>
                      <span className="min-w-0 flex-1 truncate text-text-2">{o.label}</span>
                      {o.answered ? <Pill hue="mint">Answered</Pill> : <Pill hue="amber">Write it</Pill>}
                    </span>
                  ))
                ) : (
                  <span className="text-[13px] text-text-2">None logged yet. BDRs log one by tapping it in the script while on a call.</span>
                )}
                <span className="text-[12px] text-text-3">Write the most-heard unanswered one first, in config/scripts.ts. Until then BDRs see a safe move, never an improvised claim.</span>
              </section>
            ) : null}
            <section aria-label="Before day 1" className="card flex flex-col gap-3 p-4">
              <span className="flex items-center justify-between">
                <span className="text-[14px] font-semibold">Ready before day 1</span>
                <span className="text-[12px] text-text-3">
                  {assetsReady} of {TRAINING_ASSETS.length}
                </span>
              </span>
              {TRAINING_ASSETS.map((a) => (
                <label key={a} className="flex items-center gap-2.5 text-[13px]">
                  <input type="checkbox" checked={!!view.assets[a]} disabled={!view.canEdit} onChange={(e) => run(() => data.setTrainingAsset(a, e.target.checked))} />
                  <span className={view.assets[a] ? "text-text-2 line-through" : ""}>{a}</span>
                </label>
              ))}
            </section>
            <section aria-label="After training" className="card flex flex-col gap-2.5 p-4">
              <span className="text-[14px] font-semibold">Every week after</span>
              {ONGOING.map((o) => (
                <span key={o.text} className="flex items-start gap-2 text-[13px] text-text-2">
                  <Icon d="M5 12l5 5L20 7" size={14} className="mt-0.5 shrink-0 text-text-3" />
                  {o.to ? (
                    <Link to={o.to} className="hover:text-text">
                      {o.text} ↗
                    </Link>
                  ) : (
                    o.text
                  )}
                </span>
              ))}
              <span className="text-[12px] text-text-3">Day 30: trial review. If activity is on target but there are no meetings, fix the script and the list first.</span>
            </section>
          </aside>
        </div>
      )}

      <Modal open={!!starting} onClose={() => setStarting(null)} title="Start a training program">
        {starting ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              await run(() => data.startTraining({ userId: starting.userId || undefined, name: starting.name, role: starting.role, startDate: starting.date }), "Program started");
              setStarting(null);
            }}
          >
            <label className="flex flex-col gap-2">
              <span className="field-label">Who</span>
              <select className="input" value={starting.userId} onChange={(e) => setStarting({ ...starting, userId: e.target.value })}>
                <option value="">Someone without an Atlas account yet</option>
                {people
                  .filter((u) => u.active && u.role !== "viewer" && !view.trainees.some((x) => x.userId === u.id))
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} · {u.role}
                    </option>
                  ))}
              </select>
            </label>
            {!starting.userId ? (
              <label className="flex flex-col gap-2">
                <span className="field-label">Name</span>
                <input className="input" required value={starting.name} onChange={(e) => setStarting({ ...starting, name: e.target.value })} />
              </label>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="field-label">Role</span>
                <input className="input" value={starting.role} onChange={(e) => setStarting({ ...starting, role: e.target.value })} />
              </label>
              <label className="flex flex-col gap-2">
                <span className="field-label">Starts</span>
                <input type="date" className="input" value={starting.date} onChange={(e) => setStarting({ ...starting, date: e.target.value })} />
              </label>
            </div>
            <button type="submit" className="btn-primary" disabled={!starting.userId && !starting.name.trim()}>
              Start the program
            </button>
          </form>
        ) : null}
      </Modal>
    </div>
  );
};

export default Training;
