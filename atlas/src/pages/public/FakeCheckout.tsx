import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { data, type CheckoutSession } from "@/data";

/**
 * Stand-in for Stripe Checkout in TEST mode. It never asks for card details: a single button simulates a successful
 * test payment and fires the same checkout.session.completed webhook Stripe would send. Real Stripe Checkout replaces it
 * once the Stripe test keys are connected server-side.
 */
const FakeCheckout = () => {
  const { id = "" } = useParams();
  const [state, setState] = useState<{ session: CheckoutSession; companyName: string } | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => data.checkoutSession(id).then(setState), [id]);
  useEffect(() => {
    load();
  }, [load]);

  if (state === undefined) return <div className="min-h-screen bg-bg-deep" />;
  if (state === null) return <div className="min-h-screen bg-bg-deep p-10 text-text-2">This checkout link isn't valid.</div>;
  const { session, companyName } = state;
  const amount = `${session.currency === "USD" ? "$" : "€"}${(session.amountMinor / 100).toLocaleString("en-US")}`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-deep px-6 text-text">
      <div className="flex w-full max-w-md flex-col gap-5 border border-line-strong rounded-lg bg-surface p-7">
        <span className="chip self-start border-amber text-amber">Test mode · no real payment</span>
        <span className="label-caps">{companyName}</span>
        <span className="num text-[40px] font-light">{amount}</span>
        <span className="text-[14px] text-text-2">{session.description}</span>
        {session.status === "complete" ? (
          <>
            <span className="text-[15px] text-mint">Payment complete.</span>
            <a className="btn-outline self-start" href={document.referrer || "/"}>
              Back to the quote
            </a>
          </>
        ) : (
          <button
            type="button"
            className="btn-primary justify-between"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await data.completeTestCheckout(id);
              await load();
              setBusy(false);
            }}
          >
            <span>Simulate successful test payment</span>
            <span aria-hidden="true">→</span>
          </button>
        )}
        <span className="text-[12px] text-text-3">Session {session.id}</span>
      </div>
    </div>
  );
};

export default FakeCheckout;
