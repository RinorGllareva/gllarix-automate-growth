import { useState } from "react";
import { useParams } from "react-router-dom";
import { AtlasMark } from "@/components/ui/primitives";
import { data, type UnsubscribeResult } from "@/data";

/**
 * One-click unsubscribe from any Atlas email. The click (not the page load) unsubscribes,
 * so link scanners that prefetch URLs can't opt people out by accident.
 */
const Unsubscribe = () => {
  const { token = "" } = useParams();
  const [result, setResult] = useState<UnsubscribeResult | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="min-h-screen bg-bg-deep px-6 py-10 text-text sm:px-12">
      <div className="mx-auto flex max-w-xl flex-col gap-8">
        <AtlasMark size={28} />
        {result ? (
          result.ok ? (
            <section aria-label="Unsubscribed" className="flex flex-col gap-3">
              <h1 className="page-title m-0">You're unsubscribed.</h1>
              <p className="m-0 text-[15px] text-text-2">
                {result.email} won't get any more emails from Gllarix or Arcadian{result.alreadyUnsubscribed ? " (it was already on our opt-out list)" : ""}.
              </p>
            </section>
          ) : (
            <p className="m-0 text-[15px] text-text-2">This link isn't valid any more. Reply to the email with "unsubscribe" and we'll remove you by hand.</p>
          )
        ) : (
          <section aria-label="Unsubscribe" className="flex flex-col gap-5">
            <h1 className="page-title m-0">Stop these emails?</h1>
            <p className="m-0 text-[15px] text-text-2">One click removes you from every Gllarix and Arcadian email list.</p>
            <button
              type="button"
              className="btn-primary self-start"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setResult(await data.unsubscribe(token));
              }}
            >
              Unsubscribe
            </button>
          </section>
        )}
      </div>
    </div>
  );
};

export default Unsubscribe;
