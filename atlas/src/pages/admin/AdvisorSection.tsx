import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useToast } from "@/components/ui/overlay";
import { EmptyState, SkeletonRows, Toggle } from "@/components/ui/primitives";
import { ADVISOR_TOOLS, data, type AdvisorSettings, type ToolName, type User } from "@/data";

/** Admin › AI co-founder (A19): who may use it, tools per person and the monthly cap. Finance data lives in Money › Finance. */
const AdvisorSection = () => {
  const toast = useToast();
  const [settings, setSettings] = useState<AdvisorSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toolUser, setToolUser] = useState("u-bdr");
  const [users, setUsers] = useState<User[]>([]);

  const load = useCallback(async () => {
    try {
      setSettings(await data.advisorSettings());
      setUsers(await data.listUsers());
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const save = async (patch: Partial<AdvisorSettings>, msg = "Saved") => {
    try {
      await data.setAdvisorSettings(patch);
      toast(msg, "good");
      load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  if (error) return <EmptyState title={error} />;
  if (!settings) return <SkeletonRows rows={6} />;
  const off = settings.disabledTools[toolUser] ?? [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="page-title m-0">AI co-founder</h1>

      <section aria-label="Access" className="card flex flex-col gap-3 p-5">
        <span className="label-caps">Who can ask · admins always</span>
        {(["bdr", "closer", "implementer", "viewer"] as const).map((r) => (
          <div key={r} className="flex items-center justify-between text-[13px]">
            <span>{{ bdr: "BDR", closer: "Closer", implementer: "Implementer", viewer: "Viewer (off by default)" }[r]}</span>
            <Toggle checked={settings.roles[r]} onChange={(v) => save({ roles: { ...settings.roles, [r]: v } })} label={settings.roles[r] ? "On" : "Off"} />
          </div>
        ))}
        <span className="text-[12px] text-text-3">Tools still follow each role's access: a BDR never gets finance or other people's data.</span>
      </section>

      <section aria-label="Tools per person" className="card flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="label-caps">Tools switched off for</span>
          <select className="input h-9 w-auto" value={toolUser} onChange={(e) => setToolUser(e.target.value)} aria-label="Person">
            {users.filter((u) => u.active).map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} · {u.role}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2 xl:grid-cols-3">
          {ADVISOR_TOOLS.map((t) => (
            <label key={t} className="flex items-center gap-2 font-mono text-[12px]">
              <input
                type="checkbox"
                checked={off.includes(t)}
                onChange={(e) => {
                  const next: ToolName[] = e.target.checked ? [...off, t] : off.filter((x) => x !== t);
                  save({ disabledTools: { ...settings.disabledTools, [toolUser]: next } }, e.target.checked ? `${t} off` : `${t} on`);
                }}
              />
              {t}
            </label>
          ))}
        </div>
      </section>

      <section aria-label="Monthly cap" className="card flex flex-wrap items-center justify-between gap-3 p-5 text-[13px]">
        <div className="flex flex-col gap-1">
          <span className="label-caps">Monthly AI cap · planner + advisor</span>
          <span className="text-text-3">New questions are blocked once the month's AI cost reaches the cap.</span>
        </div>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = Number(new FormData(e.currentTarget).get("cap"));
            save({ monthlyCapMinor: Math.round(v * 100) }, "Cap saved");
          }}
        >
          <span>€</span>
          <input name="cap" className="input h-9 w-24 font-mono" type="number" min={0} step={1} defaultValue={settings.monthlyCapMinor / 100} aria-label="Monthly cap in EUR" />
          <button type="submit" className="btn-outline h-9">
            Save
          </button>
        </form>
      </section>

      <section aria-label="Finance data" className="card flex flex-wrap items-center justify-between gap-3 p-5 text-[13px]">
        <div className="flex flex-col gap-1">
          <span className="label-caps">Finance data it reads</span>
          <span className="text-text-3">Expenses and cash snapshots now live in Money › Finance.</span>
        </div>
        <Link to="/finance" className="btn-outline">
          Open Finance
        </Link>
      </section>
    </div>
  );
};

export default AdvisorSection;
