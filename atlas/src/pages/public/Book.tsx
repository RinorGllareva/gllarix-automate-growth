import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { AtlasMark } from "@/components/ui/primitives";
import { data, type BookingPage, type BookingSlot } from "@/data";
import { localDateKey, localHHMM, zoneAbbr } from "@/services/time";

const visitorTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
const dayTitle = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: visitorTz }).format(new Date(iso));

/** Public booking page (O6): pick a 30-minute slot, leave contact details, get a confirmation and reminders. */
const Book = () => {
  const { slug = "" } = useParams();
  const [page, setPage] = useState<BookingPage | null | undefined>(undefined);
  const [slot, setSlot] = useState<BookingSlot | null>(null);
  const [form, setForm] = useState({ name: "", email: "", company: "", phone: "", country: "", notes: "" });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ meetingAt: string; ownerName: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => data.bookingPage(slug).then(setPage), [slug]);
  useEffect(() => {
    load();
  }, [load]);

  const days = useMemo(() => {
    const by = new Map<string, BookingSlot[]>();
    for (const s of page?.slots ?? []) {
      const k = localDateKey(new Date(s.start), visitorTz);
      by.set(k, [...(by.get(k) ?? []), s]);
    }
    return [...by.entries()];
  }, [page]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!slot) return;
    setBusy(true);
    setError(null);
    try {
      setDone(await data.book({ slug, start: slot.start, ...form }));
    } catch (err) {
      setError((err as Error).message);
      load();
      setSlot(null);
    } finally {
      setBusy(false);
    }
  };

  const brandName = page?.brand === "arcadian" ? "Arcadian" : "Gllarix";

  return (
    <div className="min-h-screen bg-bg-deep px-6 py-10 text-text sm:px-12">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <div className="flex items-center gap-3">
          <AtlasMark size={28} />
          <span className="text-[15px] font-medium tracking-[0.28em]">{page ? brandName.toUpperCase() : "ATLAS"}</span>
        </div>

        {page === undefined ? (
          <div className="skeleton h-40" />
        ) : page === null ? (
          <p className="m-0 text-[16px] text-text-2">This booking page doesn't exist. Check the link you were sent.</p>
        ) : done ? (
          <section aria-label="Booked" className="flex flex-col gap-4">
            <span className="label-caps">You're booked</span>
            <h1 className="page-title m-0 leading-tight">
              {dayTitle(done.meetingAt)}, {localHHMM(new Date(done.meetingAt), visitorTz)}
            </h1>
            <p className="m-0 text-[15px] text-text-2">
              {done.ownerName} will meet you by video. A confirmation is on its way to {form.email}, with{" "}
              {new Date(done.meetingAt).getTime() - Date.now() > 24 * 3_600_000 ? "reminders a day and an hour before" : "a reminder an hour before"}.
            </p>
          </section>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              <span className="label-caps">Book 30 minutes with {page.ownerName}</span>
              <h1 className="page-title m-0 leading-tight">{slot ? "Your details" : "Pick a time"}</h1>
              <p className="m-0 text-[14px] text-text-2">
                Times are in your timezone ({visitorTz.replace(/_/g, " ")}). {page.ownerName} works in {zoneAbbr(page.timezone)}.
              </p>
            </div>

            {error ? (
              <p role="alert" className="m-0 text-[14px] text-coral">
                {error}
              </p>
            ) : null}

            {!slot ? (
              days.length ? (
                <div className="flex flex-col gap-6">
                  {days.map(([k, slots]) => (
                    <section key={k} aria-label={dayTitle(slots[0].start)} className="flex flex-col gap-2.5">
                      <span className="text-[14px]">{dayTitle(slots[0].start)}</span>
                      <div className="flex flex-wrap gap-2">
                        {slots.map((s) => (
                          <button key={s.start} type="button" onClick={() => setSlot(s)} className="h-11 min-w-20 border border-line-strong px-3 font-mono text-[13px] hover:border-cyan hover:text-cyan">
                            {localHHMM(new Date(s.start), visitorTz)}
                          </button>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <p className="m-0 text-[15px] text-text-2">No free times in the next five business days. Please check back tomorrow.</p>
              )
            ) : (
              <form onSubmit={submit} className="flex max-w-md flex-col gap-4">
                <div className="flex items-center justify-between border border-line px-4 py-3 text-[14px]">
                  <span>
                    {dayTitle(slot.start)}, <span className="font-mono">{localHHMM(new Date(slot.start), visitorTz)}</span>
                  </span>
                  <button type="button" className="btn-ghost" onClick={() => setSlot(null)}>
                    Change
                  </button>
                </div>
                {(
                  [
                    ["name", "Your name", "text", true],
                    ["email", "Work email", "email", true],
                    ["company", "Company", "text", true],
                    ["phone", "Phone (optional)", "tel", false],
                    ["country", "Country code (optional, e.g. US, GB)", "text", false],
                  ] as const
                ).map(([k, label, type, required]) => (
                  <label key={k} className="flex flex-col gap-2">
                    <span className="field-label">{label}</span>
                    <input className="input" type={type} required={required} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
                  </label>
                ))}
                <label className="flex flex-col gap-2">
                  <span className="field-label">Anything we should know? (optional)</span>
                  <textarea className="input h-auto min-h-20 py-2.5" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </label>
                <span className="text-[12px] text-text-3">By booking you agree to get a confirmation and two reminders about this meeting by email.</span>
                <button type="submit" className="btn-primary justify-between" disabled={busy}>
                  <span>{busy ? "Booking…" : "Book this time"}</span>
                  <span aria-hidden="true">→</span>
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Book;
