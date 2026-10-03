import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CustomFieldsPanel } from "@/components/CustomFields";
import { ActivityTimeline, InlineSelect, NextStepCard, PropertyRow, RecordPage } from "@/components/record/Record";
import { RowMenu, useDeleteWithUndo } from "@/components/ui/actions";
import { Modal, useToast } from "@/components/ui/overlay";
import { EmptyState, Icon, ICONS, Pill, SkeletonRows } from "@/components/ui/primitives";
import { data, HIRING_STAGE_HELP, HIRING_STAGE_LABEL, HIRING_STAGES, RED_FLAGS, SCORECARD, type Candidate, type CandidateStatus, type Opening } from "@/data";
import { tableDate } from "@/lib/format";
import { scoreVerdict, weightedScore } from "@/services/people";

const DAY = 86_400_000;
const SOURCES: Candidate["source"][] = ["Venezuela groups", "LinkedIn", "Referral", "Other"];
export const daysIn = (c: Candidate) => Math.max(0, Math.floor((Date.now() - new Date(c.stageChangedAt).getTime()) / DAY));

export const ScoreBadge = ({ c }: { c: Candidate }) => {
  const w = weightedScore(c.scores);
  const v = scoreVerdict(w.score, c.redFlags.length);
  return (
    <Pill hue={v.hue} dot className="self-start">
      {w.score === null ? v.label : `${w.score} · ${v.label}`}
    </Pill>
  );
};

/** Hired → the 10-day training starts and the opening is filled. */
export const HireModal = ({ candidate, role, onClose, onHired }: { candidate: Candidate | null; role: string; onClose: () => void; onHired: () => void }) => {
  const toast = useToast();
  const [date, setDate] = useState(() => new Date(Date.now() + 3 * DAY).toISOString().slice(0, 10));
  return (
    <Modal open={!!candidate} onClose={onClose} title={candidate ? `Hire ${candidate.name}` : "Hire"}>
      {candidate ? (
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await data.startTraining({ candidateId: candidate.id, role, startDate: date });
              toast(`${candidate.name} is hired. Training starts ${date}.`, "good");
              onHired();
            } catch (err) {
              toast((err as Error).message, "error");
            }
          }}
        >
          <p className="m-0 text-[14px] text-text-2">This marks them hired, fills the opening, and starts the 10-day training. Send the contractor agreement (30-day trial) before day 1.</p>
          <label className="flex flex-col gap-2">
            <span className="field-label">Training starts</span>
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <button type="submit" className="btn-primary">
            Hire and start training
          </button>
        </form>
      ) : null}
    </Modal>
  );
};

/**
 * One candidate on the shared record layout: scorecard, notes and activity in tabs, stage, opening and source edited
 * in place, the next step and custom fields on the right. Full page at /hiring/:id, side panel on the board.
 */
export const CandidateRecord = ({ id, panel = false, onChanged, onGone }: { id: string; panel?: boolean; onChanged?: () => void; onGone?: () => void }) => {
  const toast = useToast();
  const navigate = useNavigate();
  const remove = useDeleteWithUndo();
  const [board, setBoard] = useState<{ openings: Opening[]; candidates: Candidate[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [hiring, setHiring] = useState(false);
  const load = useCallback(() => data.hiringBoard().then(setBoard, (e: Error) => setError(e.message)), []);
  useEffect(() => {
    load();
  }, [load]);

  if (error) return <EmptyState title={error} />;
  if (!board) return <SkeletonRows rows={6} />;
  const c = board.candidates.find((x) => x.id === id);
  if (!c) return <EmptyState title="This candidate doesn't exist, or was deleted." action={<Link to="/hiring" className="btn-outline">Back to hiring</Link>} />;
  const opening = board.openings.find((o) => o.id === c.openingId);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      if (ok) toast(ok, "good");
      await load();
      onChanged?.();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const move = (status: CandidateStatus) => (status === "hired" ? setHiring(true) : run(() => data.updateCandidate(c.id, { status }), `${c.name} → ${HIRING_STAGE_LABEL[status]}`));
  const i = HIRING_STAGES.indexOf(c.status as (typeof HIRING_STAGES)[number]);
  const next = i >= 0 && i < HIRING_STAGES.length - 1 ? HIRING_STAGES[i + 1] : null;
  const step =
    c.status === "hired"
      ? null
      : c.status === "rejected"
        ? null
        : c.status === "bench"
          ? "On the bench: call them when the role opens again."
          : c.status === "offer"
            ? "Send the contractor agreement, then hire them and start the training."
            : next
              ? `Next: ${HIRING_STAGE_LABEL[next].toLowerCase()} (${HIRING_STAGE_HELP[next]}).`
              : null;

  return (
    <>
      <RecordPage
        panel={panel}
        breadcrumb={[{ label: "Hiring", to: "/hiring" }, { label: opening?.role ?? "Opening" }, { label: c.name }]}
        status={
          <>
            <Pill hue="cyan" dot>
              {HIRING_STAGE_LABEL[c.status]}
            </Pill>
            <ScoreBadge c={c} />
            {c.redFlags.length ? <span className="text-[13px] text-coral">{c.redFlags.length} red flag{c.redFlags.length > 1 ? "s" : ""}</span> : null}
          </>
        }
        title={
          editingName ? (
            <input
              autoFocus
              aria-label="Name"
              className="input h-11 w-full min-w-[240px] text-[20px] font-semibold"
              defaultValue={c.name}
              onKeyDown={(e) => e.key === "Escape" && setEditingName(false)}
              onBlur={(e) => {
                setEditingName(false);
                if (e.target.value.trim() && e.target.value !== c.name) run(() => data.updateCandidate(c.id, { name: e.target.value.trim() }), "Name saved");
              }}
            />
          ) : (
            <button type="button" className="text-left hover:text-cyan" title="Click to edit the name" onClick={() => setEditingName(true)}>
              {c.name}
            </button>
          )
        }
        actions={
          <>
            {panel ? (
              <Link to={`/hiring/${c.id}`} className="btn-ghost h-9 text-[12px]">
                Open full page
              </Link>
            ) : null}
            {c.status === "offer" ? (
              <button type="button" className="btn-primary h-9" onClick={() => setHiring(true)}>
                Hire and start training
              </button>
            ) : next && next !== "hired" && c.status !== "rejected" ? (
              <button type="button" className="btn-primary h-9" onClick={() => move(next)}>
                Move to {HIRING_STAGE_LABEL[next].toLowerCase()} <Icon d={ICONS.arrow} size={14} />
              </button>
            ) : null}
            <RowMenu
              label={`Actions for ${c.name}`}
              items={[
                { label: "Back a step", hidden: !(i > 0 && c.status !== "hired"), onSelect: () => move(HIRING_STAGES[i - 1]) },
                { label: "To the bench", hidden: c.status === "bench" || c.status === "hired", onSelect: () => move("bench") },
                { label: "Back into the pipeline", hidden: !(c.status === "bench" || c.status === "rejected"), onSelect: () => move("applied") },
                { label: "Not a fit", danger: true, hidden: c.status === "rejected" || c.status === "hired", onSelect: () => move("rejected") },
                {
                  label: "Delete candidate",
                  danger: true,
                  onSelect: () =>
                    remove(c.name, () => data.deleteCandidate(c.id), () => {
                      onChanged?.();
                      if (onGone) onGone();
                      else navigate("/hiring");
                    }),
                },
              ]}
            />
          </>
        }
        properties={
          <PropertyRow
            items={[
              {
                label: "Stage",
                value: (
                  <InlineSelect<CandidateStatus>
                    label="Stage"
                    value={c.status}
                    options={([...HIRING_STAGES, "bench", "rejected"] as CandidateStatus[]).map((st) => ({ value: st, label: HIRING_STAGE_LABEL[st] }))}
                    onChange={move}
                  />
                ),
              },
              { label: "Opening", value: <InlineSelect label="Opening" value={c.openingId} options={board.openings.map((o) => ({ value: o.id, label: o.role }))} onChange={(v) => run(() => data.updateCandidate(c.id, { openingId: v }), "Moved to another opening")} /> },
              { label: "Source", value: <InlineSelect<Candidate["source"]> label="Source" value={c.source} options={SOURCES.map((x) => ({ value: x, label: x }))} onChange={(v) => run(() => data.updateCandidate(c.id, { source: v }))} /> },
              {
                label: "Email",
                value: (
                  <input
                    type="email"
                    aria-label="Email"
                    className="h-7 w-52 rounded-md border-0 bg-transparent px-0 text-[13px] text-text hover:bg-surface-2"
                    defaultValue={c.email ?? ""}
                    key={`em-${c.email}`}
                    placeholder="Add an email"
                    onBlur={(e) => e.target.value !== (c.email ?? "") && run(() => data.updateCandidate(c.id, { email: e.target.value.trim() || null }), "Email saved")}
                  />
                ),
              },
              { label: "In stage", value: <span className="text-text-2">{daysIn(c) ? `${daysIn(c)} days` : "Since today"}</span> },
              { label: "Applied", value: <span className="text-text-2">{tableDate(c.createdAt)}</span> },
            ]}
          />
        }
        tabs={[
          {
            id: "scorecard",
            label: "Scorecard",
            content: (
              <div className="flex flex-col gap-5">
                <section aria-label="Scorecard" className="card flex flex-col gap-3 p-5">
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
                            aria-checked={c.scores[k.key] === n}
                            onClick={() => run(() => data.updateCandidate(c.id, { scores: { [k.key]: n } }))}
                            className={`h-7 w-7 rounded-md text-[12px] ${c.scores[k.key] === n ? "bg-surface-2 text-text shadow-card" : "text-text-3 hover:text-text"}`}
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
                      const on = c.redFlags.includes(f);
                      return (
                        <button
                          key={f}
                          type="button"
                          aria-pressed={on}
                          onClick={() => run(() => data.updateCandidate(c.id, { redFlags: on ? c.redFlags.filter((x) => x !== f) : [...c.redFlags, f] }))}
                          className={`h-8 rounded-lg border px-3 text-[12px] ${on ? "border-coral/60 bg-coral-tint text-coral" : "border-line text-text-2 hover:border-line-strong"}`}
                        >
                          {f}
                        </button>
                      );
                    })}
                  </div>
                </section>
              </div>
            ),
          },
          {
            id: "notes",
            label: "Notes",
            content: (
              <div className="card flex flex-col gap-4 p-5">
                <label className="flex flex-col gap-1.5">
                  <span className="field-label">Voice note link</span>
                  <input className="input" defaultValue={c.voiceNoteUrl ?? ""} key={`v-${c.id}`} placeholder="WhatsApp or Drive link" onBlur={(e) => e.target.value !== (c.voiceNoteUrl ?? "") && run(() => data.updateCandidate(c.id, { voiceNoteUrl: e.target.value || null }))} />
                </label>
                {c.voiceNoteUrl ? (
                  <a href={c.voiceNoteUrl} target="_blank" rel="noreferrer" className="self-start text-[12px] text-cyan hover:underline">
                    Listen to the voice note ↗
                  </a>
                ) : null}
                <label className="flex flex-col gap-1.5">
                  <span className="field-label">Notes</span>
                  <textarea className="input min-h-[140px] py-2" defaultValue={c.notes} key={`n-${c.id}`} onBlur={(e) => e.target.value !== c.notes && run(() => data.updateCandidate(c.id, { notes: e.target.value }), "Notes saved")} />
                </label>
              </div>
            ),
          },
          { id: "activity", label: "Activity", content: <ActivityTimeline entity="candidate" id={c.id} reloadKey={c} /> },
        ]}
        side={
          <>
            {step ? <NextStepCard text={step} /> : null}
            <CustomFieldsPanel entity="candidate" id={c.id} title="Candidate fields" />
          </>
        }
      />
      <HireModal
        candidate={hiring ? c : null}
        role={opening?.role ?? "New hire"}
        onClose={() => setHiring(false)}
        onHired={() => {
          setHiring(false);
          onChanged?.();
          navigate("/training");
        }}
      />
    </>
  );
};

/** /hiring/:id: the candidate as a full page. */
const CandidatePage = ({ id }: { id: string }) => <CandidateRecord id={id} />;

export default CandidatePage;
