import { useEffect, useState } from "react";
import { NavLink, useParams } from "react-router-dom";
import { data, ROLE_LABEL, type AuditEntry, type User } from "@/data";
import { EmptyState, SkeletonRows } from "@/components/ui/primitives";
import { Drawer } from "@/components/ui/overlay";
import CadencesSection from "./admin/CadencesSection";
import IntegrationsSection from "./admin/IntegrationsSection";
import JobsSection from "./admin/JobsSection";
import ScoringSection from "./admin/ScoringSection";
import OptOutSection from "./admin/OptOutSection";
import PriceBookSection from "./admin/PriceBookSection";
import SettingsSection from "./admin/SettingsSection";
import AdvisorSection from "./admin/AdvisorSection";
import CountryRulesSection from "./admin/CountryRulesSection";

const SECTIONS = [
  { id: "users", label: "Users and roles", milestone: "M0" },
  { id: "settings", label: "Settings", milestone: "M1" },
  { id: "country-rules", label: "Country rules", milestone: "M2" },
  { id: "scoring", label: "Scoring models", milestone: "M2" },
  { id: "cadences", label: "Cadences", milestone: "M3" },
  { id: "price-book", label: "Price book", milestone: "M6" },
  { id: "opt-out", label: "Opt-out list", milestone: "M1" },
  { id: "jobs", label: "Background jobs", milestone: "M1" },
  { id: "advisor", label: "AI co-founder and finance", milestone: "M14" },
  { id: "integrations", label: "Integrations", milestone: "M3" },
  { id: "audit", label: "Audit log", milestone: "M0" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

const formatTime = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso),
  );

const UsersSection = () => {
  const [users, setUsers] = useState<User[] | null>(null);
  useEffect(() => {
    data.listUsers().then(setUsers);
  }, []);
  const cols = "grid-cols-[1.1fr_1.5fr_110px_1.2fr_90px_90px]";
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4">
        <h1 className="m-0 text-[34px] font-light tracking-[-0.02em]">Users and roles</h1>
        <button type="button" className="btn-outline" disabled title="Invites need the Supabase backend">
          Invite user →
        </button>
      </div>
      <div className="card">
        <div className={`grid ${cols} gap-2.5 border-b border-line px-4 py-3 text-[10px] uppercase tracking-[0.2em] text-text-3 bg-surface-2`}>
          <span>Name</span>
          <span>Email</span>
          <span>Role</span>
          <span>Timezone</span>
          <span>Capacity</span>
          <span>Status</span>
        </div>
        {users ? (
          users.map((u) => (
            <div key={u.id} className={`grid ${cols} h-[46px] items-center gap-2.5 border-b border-line-soft px-4 text-[13px] last:border-b-0`}>
              <span>{u.name}</span>
              <span className="truncate text-text-2">{u.email}</span>
              <span>{ROLE_LABEL[u.role]}</span>
              <span className="truncate font-mono text-[12px] text-text-2">{u.timezone}</span>
              <span className="num">{u.dailyCapacity ?? "—"}</span>
              <span className={`text-[10px] uppercase tracking-[0.18em] ${u.active ? "text-mint" : "text-amber"}`}>
                {u.active ? "Active" : "Paused"}
              </span>
            </div>
          ))
        ) : (
          <SkeletonRows rows={4} />
        )}
      </div>
    </div>
  );
};

const AuditSection = () => {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [open, setOpen] = useState<AuditEntry | null>(null);
  useEffect(() => {
    data.listAudit(100).then(setEntries);
    data.listUsers().then(setUsers);
  }, []);
  const who = (id: string | null) => users.find((u) => u.id === id)?.name ?? "—";
  const cols = "grid-cols-[150px_140px_1fr_120px]";

  return (
    <div className="flex flex-col gap-4">
      <h1 className="m-0 text-[34px] font-light tracking-[-0.02em]">Audit log</h1>
      {entries && !entries.length ? (
        <EmptyState title="Nothing logged yet. Sign-ins, sign-outs and every change to a record will appear here." />
      ) : (
        <div className="card">
          <div className={`grid ${cols} gap-2.5 border-b border-line px-4 py-3 text-[10px] uppercase tracking-[0.2em] text-text-3 bg-surface-2`}>
            <span>Time</span>
            <span>User</span>
            <span>Action</span>
            <span>Entity</span>
          </div>
          {entries ? (
            entries.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setOpen(a)}
                className={`grid w-full ${cols} h-[46px] items-center gap-2.5 border-b border-line-soft px-4 text-left text-[13px] last:border-b-0 hover:bg-surface-2`}
              >
                <span className="num text-[12px] text-text-2">{formatTime(a.at)}</span>
                <span>{who(a.userId)}</span>
                <span className="font-mono text-[12px]">{a.action}</span>
                <span className="text-text-2">{a.entity}</span>
              </button>
            ))
          ) : (
            <SkeletonRows rows={5} />
          )}
        </div>
      )}
      <Drawer open={Boolean(open)} onClose={() => setOpen(null)} title="Audit entry" width={480}>
        {open ? (
          <div className="flex flex-col gap-4 p-5 text-[13px]">
            <span className="font-mono">{open.action}</span>
            <span className="text-text-2">
              {who(open.userId)} · {formatTime(open.at)}
            </span>
            <div className="grid grid-cols-2 gap-3">
              {(["before", "after"] as const).map((k) => (
                <div key={k} className="flex flex-col gap-2">
                  <span className="label-caps">{k}</span>
                  <pre className="m-0 overflow-x-auto border border-line bg-bg p-3 font-mono text-[12px] text-text-2">
                    {JSON.stringify(open[k], null, 2) ?? "null"}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
};

const Admin = () => {
  const { section = "users" } = useParams<{ section: SectionId }>();
  const current = SECTIONS.find((s) => s.id === section);
  const [optOut, setOptOut] = useState<number | null>(null);
  useEffect(() => {
    data.listSuppression().then((l) => setOptOut(l.length)).catch(() => undefined);
  }, [section]);

  return (
    <div className="-mx-10 -my-8 grid min-h-[calc(100vh-72px)] grid-cols-[220px_minmax(0,1fr)] content-start 2xl:grid-cols-[220px_minmax(0,1fr)_330px]">
      <nav aria-label="Admin sections" className="row-span-2 flex flex-col gap-0.5 border-r border-line px-4 py-7 2xl:row-span-1">
        {SECTIONS.map((s) => (
          <NavLink
            key={s.id}
            to={`/admin/${s.id}`}
            className={({ isActive }) =>
              `flex h-10 items-center justify-between px-3 text-[13px] ${
                isActive ? "bg-ice text-ice-ink" : "text-text-2 hover:bg-surface hover:text-text"
              }`
            }
          >
            {s.label}
          </NavLink>
        ))}
      </nav>

      <section className="min-w-0 px-7 py-7">
        {section === "users" ? (
          <UsersSection />
        ) : section === "audit" ? (
          <AuditSection />
        ) : section === "opt-out" ? (
          <OptOutSection />
        ) : section === "settings" ? (
          <SettingsSection />
        ) : section === "cadences" ? (
          <CadencesSection />
        ) : section === "price-book" ? (
          <PriceBookSection />
        ) : section === "jobs" ? (
          <JobsSection />
        ) : section === "scoring" ? (
          <ScoringSection />
        ) : section === "country-rules" ? (
          <CountryRulesSection />
        ) : section === "advisor" ? (
          <AdvisorSection />
        ) : section === "integrations" ? (
          <IntegrationsSection />
        ) : current ? (
          <div className="flex flex-col gap-4">
            <h1 className="m-0 text-[34px] font-light tracking-[-0.02em]">{current.label}</h1>
            <EmptyState title={`This section is built in milestone ${current.milestone}.`} />
          </div>
        ) : (
          <EmptyState title="There's no admin section with that name." />
        )}
      </section>

      <aside className="col-start-2 grid content-start gap-5 border-t border-line px-7 py-7 md:grid-cols-3 2xl:col-start-auto 2xl:flex 2xl:flex-col 2xl:border-l 2xl:border-t-0 2xl:px-6">
        <section aria-label="Background jobs" className="flex flex-col gap-2.5">
          <span className="label-caps">Background jobs</span>
          <p className="m-0 text-[13px] text-text-3">
            List build and enrichment runs, logs and retries are in{" "}
            <NavLink to="/admin/jobs" className="text-cyan">
              Background jobs
            </NavLink>
            .
          </p>
        </section>
        <section aria-label="Paid API caps" className="flex flex-col gap-2.5">
          <span className="label-caps">Paid API caps</span>
          <p className="m-0 text-[13px] text-text-3">
            Places and registry caps are in{" "}
            <NavLink to="/admin/integrations" className="text-cyan">
              Integrations
            </NavLink>
            ; hitting one pauses the list build and alerts admins.
          </p>
        </section>
        <section aria-label="Opt-out list" className="flex flex-col gap-1.5 border border-line px-4 py-3.5 text-[13px]">
          <span className="label-caps">Opt-out list</span>
          <span>
            <span className="num">{optOut ?? "—"}</span> entries · checked before every queue and send
          </span>
        </section>
      </aside>
    </div>
  );
};

export default Admin;
