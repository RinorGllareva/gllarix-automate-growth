import { useCallback, useEffect, useState } from "react";
import { useUser } from "@/auth/AuthContext";
import { Field, RowMenu } from "@/components/ui/actions";
import { Modal, useToast } from "@/components/ui/overlay";
import { SkeletonRows } from "@/components/ui/primitives";
import { data, ROLE_LABEL, type NewUserInput, type Role, type User } from "@/data";

const ROLES = Object.keys(ROLE_LABEL) as Role[];
const ZONES = ["Europe/Zurich", "Europe/Belgrade", "Europe/London", "America/New_York", "America/Chicago", "America/Los_Angeles", "America/Caracas", "America/Bogota"];
const QUEUE_ROLES: Role[] = ["bdr", "closer"];

type Draft = NewUserInput & { id?: string };

/** Settings › Users: invite, edit role, timezone and daily queue, pause with a hand-over of open work. */
const UsersSection = () => {
  const me = useUser();
  const toast = useToast();
  const [users, setUsers] = useState<User[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pausing, setPausing] = useState<{ user: User; to: string } | null>(null);
  const load = useCallback(() => data.listUsers().then((u) => setUsers([...u])), []);
  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast(ok, "good");
      await load();
      return true;
    } catch (e) {
      toast((e as Error).message, "error");
      return false;
    }
  };
  const cols = "grid-cols-[1.1fr_1.5fr_110px_1.2fr_90px_90px_32px]";
  const zones = (current: string) => (ZONES.includes(current) ? ZONES : [current, ...ZONES]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4">
        <h1 className="page-title m-0">Users and roles</h1>
        <button
          type="button"
          className="btn-primary"
          onClick={() =>
            setDraft({
              name: "",
              email: "",
              role: "bdr",
              timezone: "America/Caracas",
              dailyCapacity: 150,
            })
          }
        >
          + Invite user
        </button>
      </div>
      <div className="card overflow-x-auto">
        <div className={`grid min-w-[760px] ${cols} gap-2.5 border-b border-line bg-surface-2 px-4 py-3 text-[12px] font-medium text-text-3`}>
          <span>Name</span>
          <span>Email</span>
          <span>Role</span>
          <span>Timezone</span>
          <span>Daily queue</span>
          <span>Status</span>
          <span />
        </div>
        {users ? (
          users.map((u) => (
            <div key={u.id} className={`grid min-w-[760px] ${cols} h-[46px] items-center gap-2.5 border-b border-line-soft px-4 text-[13px] last:border-b-0 ${u.active ? "" : "opacity-60"}`}>
              <span className="truncate">{u.name}</span>
              <span className="truncate text-text-2">{u.email}</span>
              <span>{ROLE_LABEL[u.role]}</span>
              <span className="truncate font-mono text-[12px] text-text-2">{u.timezone}</span>
              <span className="num">{u.dailyCapacity ?? "—"}</span>
              <span className={`text-[12px] font-medium ${u.active ? "text-mint" : "text-amber"}`}>{u.active ? "Active" : "Paused"}</span>
              <RowMenu
                label={`Actions for ${u.name}`}
                items={[
                  {
                    label: "Edit role, timezone, queue",
                    onSelect: () =>
                      setDraft({
                        id: u.id,
                        name: u.name,
                        email: u.email,
                        role: u.role,
                        timezone: u.timezone,
                        dailyCapacity: u.dailyCapacity,
                      }),
                  },
                  {
                    label: "Pause and hand over…",
                    danger: true,
                    hidden: !u.active || u.id === me.id,
                    onSelect: () =>
                      setPausing({
                        user: u,
                        to: users.find((x) => x.active && x.id !== u.id && x.role === u.role)?.id ?? me.id,
                      }),
                  },
                  {
                    label: "Reactivate",
                    hidden: u.active,
                    onSelect: () => run(() => data.reactivateUser(u.id), `${u.name} is active again`),
                  },
                ]}
              />
            </div>
          ))
        ) : (
          <SkeletonRows rows={4} />
        )}
      </div>
      <span className="text-[12px] text-text-3">Demo mode adds the person straight away (they sign in with the demo password). With Supabase, they get an invite email.</span>

      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? `Edit · ${draft.name}` : "Invite a user"}>
        {draft ? (
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const d = draft;
              const ok = d.id
                ? await run(
                    () =>
                      data.updateUser(d.id!, {
                        name: d.name,
                        role: d.role,
                        timezone: d.timezone,
                        dailyCapacity: d.dailyCapacity,
                      }),
                    `${d.name} saved`,
                  )
                : await run(() => data.inviteUser(d), `${d.name} invited`);
              if (ok) setDraft(null);
            }}
          >
            <Field label="Name">
              <input className="input" required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </Field>
            <Field label="Email">
              <input className="input" type="email" required disabled={!!draft.id} value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="name@example.com" />
            </Field>
            <Field label="Role">
              <select
                className="input"
                value={draft.role}
                onChange={(e) => {
                  const role = e.target.value as Role;
                  setDraft({
                    ...draft,
                    role,
                    dailyCapacity: QUEUE_ROLES.includes(role) ? (draft.dailyCapacity ?? 150) : null,
                  });
                }}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Timezone">
              <select className="input" value={draft.timezone} onChange={(e) => setDraft({ ...draft, timezone: e.target.value })}>
                {zones(draft.timezone).map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Daily call queue" wide>
              <input
                className="input"
                type="number"
                min={1}
                max={300}
                value={draft.dailyCapacity ?? ""}
                placeholder="No queue"
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    dailyCapacity: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </Field>
            <span className="text-[12px] text-text-3 sm:col-span-2">Queue size per day: 150 for a BDR, 80 for a founder who also calls. Leave empty for roles without calls.</span>
            <button type="submit" className="btn-primary sm:col-span-2" disabled={!draft.name.trim() || !draft.email.trim()}>
              {draft.id ? "Save" : "Invite"}
            </button>
          </form>
        ) : null}
      </Modal>

      <Modal open={!!pausing} onClose={() => setPausing(null)} title={pausing ? `Pause ${pausing.user.name}` : ""}>
        {pausing && users ? (
          <form
            className="flex flex-col gap-4 text-[13px]"
            onSubmit={async (e) => {
              e.preventDefault();
              const p = pausing;
              let moved = 0;
              const ok = await run(async () => void (moved = (await data.deactivateUser(p.user.id, p.to || null)).moved), `${p.user.name} paused`);
              if (ok) {
                if (moved) toast(`${moved} open items handed over`, "info");
                setPausing(null);
              }
            }}
          >
            <span className="text-text-2">They can't sign in while paused. Their history stays. Open leads, deals, tasks and inbound requests go to the person you pick.</span>
            <Field label="Hand open work to">
              <select className="input" value={pausing.to} onChange={(e) => setPausing({ ...pausing, to: e.target.value })}>
                <option value="">Nobody (leave it unassigned)</option>
                {users
                  .filter((u) => u.active && u.id !== pausing.user.id)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} · {ROLE_LABEL[u.role]}
                    </option>
                  ))}
              </select>
            </Field>
            <button type="submit" className="btn-danger">
              Pause and hand over
            </button>
          </form>
        ) : null}
      </Modal>
    </div>
  );
};

export default UsersSection;
