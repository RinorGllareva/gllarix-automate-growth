import { useCallback, useEffect, useState } from "react";
import { usePageChrome } from "@/components/shell/PageChrome";
import { useToast } from "@/components/ui/overlay";
import { EmptyState, Pill, SkeletonRows } from "@/components/ui/primitives";
import { data, type AgentHome, type AgentMode, type AgentSettings } from "@/data";
import { tableDate } from "@/lib/format";

const MODES: { key: AgentMode; label: string; help: string }[] = [
  { key: "off", label: "Off", help: "Humans call back every inbound request." },
  { key: "shadow", label: "Shadow", help: "Shows who it would call and what it would say. Nobody is called." },
  { key: "live", label: "Live", help: "Calls and books meetings. Needs Twilio and an AI voice." },
];

/**
 * AI › AI BDR agent: calls back inbound requests within minutes, asks the qualifying questions and books a meeting
 * with a human. Never cold-calls: an AI voice needs the person's prior consent (US TCPA, FCC Feb 2024).
 */
const Agent = () => {
  const toast = useToast();
  const [home, setHome] = useState<AgentHome | null>(null);
  const [draft, setDraft] = useState<AgentSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  usePageChrome({ context: "AI · BDR agent" });
  const load = useCallback(
    () =>
      data.agentHome().then((h) => {
        setHome(h);
        setDraft(h.settings);
      }, (e: Error) => setError(e.message)),
    [],
  );
  useEffect(() => {
    load();
  }, [load]);

  if (error) return <EmptyState title={error} />;
  if (!home || !draft) return <SkeletonRows rows={6} />;
  const dirty = JSON.stringify(draft) !== JSON.stringify(home.settings);
  const save = async (patch: Partial<AgentSettings> = draft) => {
    try {
      await data.saveAgent(patch);
      toast("Agent settings saved", "good");
      load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const allowed = home.plan.filter((p) => p.allowed);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="page-title m-0">AI BDR agent</h1>
        <p className="m-0 max-w-3xl text-[14px] text-text-2">
          Calls back people who asked us to, within minutes, asks the qualifying questions and books 15 minutes with a human. It never cold-calls: an AI voice needs the person's prior consent (US TCPA,
          FCC ruling of February 2024), and Europe is stricter.
        </p>
      </div>

      <section aria-label="Mode" className="grid gap-3 md:grid-cols-3">
        {MODES.map((m) => {
          const on = home.settings.mode === m.key;
          const blocked = m.key === "live" && !home.liveAvailable;
          return (
            <button
              key={m.key}
              type="button"
              aria-pressed={on}
              disabled={blocked}
              onClick={() => save({ mode: m.key })}
              className={`card flex flex-col gap-1 p-4 text-left disabled:opacity-50 ${on ? "border-app" : "hover:border-line-strong"}`}
            >
              <span className="flex items-center gap-2 text-[15px] font-semibold">
                {m.label}
                {on ? <Pill hue="mint">Current</Pill> : null}
                {blocked ? <Pill hue="text-3">Needs Twilio</Pill> : null}
              </span>
              <span className="text-[13px] text-text-2">{m.help}</span>
            </button>
          );
        })}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section aria-label="Who it would call now" className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[15px] font-semibold">
              Right now · {allowed.length} to call, {home.plan.length - allowed.length} for a human
            </span>
            <button
              type="button"
              className="btn-outline h-9"
              disabled={home.settings.mode === "off"}
              onClick={async () => {
                try {
                  const r = await data.runAgentShadow();
                  toast(`Shadow run: would call ${r.wouldCall} of ${r.considered}`, "good");
                  load();
                } catch (e) {
                  toast((e as Error).message, "error");
                }
              }}
            >
              Run in shadow
            </button>
          </div>
          {home.plan.length ? (
            home.plan.map((p) => (
              <article key={p.requestId} className="card flex flex-col gap-2 p-4 text-[13px]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">
                    {p.name} · {p.company}
                  </span>
                  <span className="num text-text-3">{p.phone}</span>
                  <span className="ml-auto">{p.allowed ? <Pill hue="mint">{home.settings.mode === "off" ? "Eligible" : "Would call"}</Pill> : <Pill hue="text-3">Human</Pill>}</span>
                </div>
                <span className={p.allowed ? "text-text-2" : "text-text-3"}>{p.reason}</span>
                {p.allowed ? <p className="m-0 rounded-lg bg-inset px-3 py-2 text-[13px] italic text-text-2">"{p.opener}"</p> : null}
              </article>
            ))
          ) : (
            <EmptyState title="No open inbound request with a phone number. When one arrives, it shows here." />
          )}
          {home.runs.length ? (
            <div className="flex flex-col gap-1 text-[12px] text-text-3">
              <span className="text-[13px] font-medium text-text-2">Shadow runs</span>
              {home.runs.map((r) => (
                <span key={r.id}>
                  {tableDate(r.at)} · considered {r.considered} · would call {r.wouldCall} · left for a human {r.blocked}
                </span>
              ))}
            </div>
          ) : null}
        </section>

        <form
          aria-label="Agent settings"
          className="card flex flex-col gap-4 self-start p-5 text-[13px]"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <span className="text-[15px] font-semibold">How it calls</span>
          <label className="flex flex-col gap-1.5">
            <span className="field-label">Opening line (said word for word)</span>
            <textarea className="input h-auto min-h-[96px] py-2.5" value={draft.disclosure} onChange={(e) => setDraft({ ...draft, disclosure: e.target.value })} />
            <span className="text-[12px] text-text-3">Must say it's an AI and that the call is recorded. {"{{name}}"} and {"{{brand}}"} are filled in.</span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="field-label">Qualifying questions, one per line</span>
            <textarea className="input h-auto min-h-[88px] py-2.5" value={draft.questions.join("\n")} onChange={(e) => setDraft({ ...draft, questions: e.target.value.split("\n") })} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="field-label">Call from (their time)</span>
              <input className="input" type="time" value={draft.hoursFrom} onChange={(e) => setDraft({ ...draft, hoursFrom: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="field-label">Until</span>
              <input className="input" type="time" value={draft.hoursTo} onChange={(e) => setDraft({ ...draft, hoursTo: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="field-label">Call back within (min)</span>
              <input className="input" type="number" min={1} max={60} value={draft.withinMinutes} onChange={(e) => setDraft({ ...draft, withinMinutes: Number(e.target.value) })} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="field-label">Attempts</span>
              <input className="input" type="number" min={1} max={3} value={draft.maxAttempts} onChange={(e) => setDraft({ ...draft, maxAttempts: Number(e.target.value) })} />
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="field-label">Books the meeting with</span>
            <select className="input" value={draft.handoffTo ?? ""} onChange={(e) => setDraft({ ...draft, handoffTo: e.target.value || null })}>
              <option value="">Whoever owns the request</option>
              {home.people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-[12px] text-text-3">
            <li>Only people who asked to be contacted, in countries where we call, inside their local hours.</li>
            <li>Hands over to a human the moment someone asks for one, or is upset.</li>
            <li>Never quotes prices or promises results; it books the meeting.</li>
            <li>The prompt and keys live on the server, never in the browser.</li>
          </ul>
          <button type="submit" className="btn-primary" disabled={!dirty}>
            Save
          </button>
        </form>
      </div>
    </div>
  );
};

export default Agent;
