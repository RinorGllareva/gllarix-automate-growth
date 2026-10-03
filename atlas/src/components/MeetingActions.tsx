import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/auth/AuthContext";
import { Field, RowMenu, useDeleteWithUndo, useRun } from "@/components/ui/actions";
import { Modal } from "@/components/ui/overlay";
import { data, type Meeting, type MeetingRow, type User } from "@/data";
import { localDateKey, localHHMM, zonedToUtc, zoneAbbr } from "@/services/time";

/** Reschedule (new reminders go out) and Cancel (into the trash, with Undo). On the meeting page and the list. */
export const MeetingActions = ({ row, onChanged, afterCancel }: { row: MeetingRow; onChanged: () => void; afterCancel?: () => void }) => {
  const me = useUser();
  const run = useRun();
  const remove = useDeleteWithUndo();
  const navigate = useNavigate();
  const m = row.meeting;
  const tz = row.company.timezone ?? me.timezone;
  const [moving, setMoving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [people, setPeople] = useState<User[]>([]);
  const [f, setF] = useState({ date: localDateKey(new Date(m.scheduledAt), tz), time: localHHMM(new Date(m.scheduledAt), tz), type: m.type, withWhom: m.withWhom, ownerId: m.ownerId ?? "" });
  useEffect(() => {
    if (moving && me.role === "admin") data.listUsers().then((u) => setPeople(u.filter((x) => x.active && ["admin", "bdr", "closer"].includes(x.role))));
  }, [moving, me.role]);
  const done = m.attended !== null;
  const canAct = me.role !== "viewer" && !done && m.approved === null;
  if (!canAct) return null;
  return (
    <>
      <RowMenu
        label="Meeting actions"
        items={[
          { label: "Reschedule", onSelect: () => setMoving(true) },
          { label: "Cancel meeting", danger: true, onSelect: () => setCancelling(true) },
        ]}
      />
      <Modal open={moving} onClose={() => setMoving(false)} title={`Reschedule · ${row.company.name}`}>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const at = new Date(zonedToUtc(f.date, f.time, tz)).toISOString();
            const ok = await run(
              () => data.rescheduleMeeting(m.id, { at, type: f.type, withWhom: f.withWhom, ...(me.role === "admin" ? { ownerId: f.ownerId || null } : {}) }),
              "Meeting moved · the attendee gets the new time and reminders",
            );
            if (ok) {
              setMoving(false);
              onChanged();
            }
          }}
        >
          <Field label={`Day (${row.company.name}'s time)`}>
            <input className="input" type="date" required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </Field>
          <Field label={`Time (${zoneAbbr(tz)})`}>
            <input className="input" type="time" required value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} />
          </Field>
          <Field label="Type">
            <select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as Meeting["type"] })}>
              <option value="video">Video call</option>
              <option value="phone">Phone</option>
              <option value="in_person">In person</option>
            </select>
          </Field>
          <Field label="With">
            <input className="input" value={f.withWhom} onChange={(e) => setF({ ...f, withWhom: e.target.value })} />
          </Field>
          {me.role === "admin" ? (
            <Field label="Runs the meeting" wide>
              <select className="input" value={f.ownerId} onChange={(e) => setF({ ...f, ownerId: e.target.value })}>
                {people.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          <button type="submit" className="btn-primary sm:col-span-2">
            Move the meeting
          </button>
        </form>
      </Modal>
      <Modal open={cancelling} onClose={() => setCancelling(false)} title={`Cancel · ${row.company.name}`}>
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setCancelling(false);
            await remove(`Meeting with ${row.company.name}`, () => data.cancelMeeting(m.id, reason), () => {
              onChanged();
              if (afterCancel) afterCancel();
              else navigate("/meetings");
            });
          }}
        >
          <Field label="Why is it cancelled?">
            <input className="input" required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. They asked to talk next month" />
          </Field>
          <span className="text-[12px] text-text-3">Reminders stop, the lead goes back to a call, and the meeting can be restored from the Trash.</span>
          <button type="submit" className="btn-danger" disabled={!reason.trim()}>
            Cancel the meeting
          </button>
        </form>
      </Modal>
    </>
  );
};
