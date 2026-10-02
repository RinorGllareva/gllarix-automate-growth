import type { ListType } from "@/config/leads";
import { suggestedOffer } from "@/services/offers";

/** The lead offer with list and pilot prices from the price book, in the lead's market. */
const OfferPrices = ({ listType, country }: { listType: ListType; country: string | null }) => {
  const o = suggestedOffer(listType, country);
  return (
    <div className="flex flex-col gap-2 text-[13px]">
      <span className="text-text">{o.itemNames.join(" + ")}</span>
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1">
        <span className="text-text-3" />
        <span className="text-[10px] uppercase tracking-[0.18em] text-label">Setup</span>
        <span className="text-[10px] uppercase tracking-[0.18em] text-label">Monthly</span>
        <span className="text-text-2">List</span>
        <span className="num text-right">{o.list.setup}</span>
        <span className="num text-right">{o.list.monthly}</span>
        <span className="text-text-2">Pilot</span>
        <span className="num text-right text-mint">{o.pilot.setup}</span>
        <span className="num text-right text-mint">{o.pilot.monthly}</span>
      </div>
      <span className="text-[11px] text-text-3">{o.marketLabel} · price book v2 · pilot: first month free, 12 months at the pilot rate</span>
    </div>
  );
};

export default OfferPrices;
