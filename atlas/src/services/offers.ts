import { BY_ID, MARKETS, marketForCountry, type MarketId } from "@/config/priceBook";
import type { ListType } from "@/config/leads";
import { compute, formatMoney, selectionFromItems } from "./pricing";

/** The lead offer per call list (context/06): Gllarix Standard for trades, the 3D sales platform for developers. */
export const LEAD_OFFER: Record<ListType, { name: string; items: string[] }> = {
  trades: { name: "Never miss a job", items: ["rec_m"] },
  developers: { name: "3D sales suite", items: ["d3_p"] },
};

export interface SuggestedOffer {
  name: string;
  itemNames: string[];
  market: MarketId;
  marketLabel: string;
  list: { setup: string; monthly: string };
  pilot: { setup: string; monthly: string };
}

/** Price-book numbers for the lead's market: list price and the pilot price (same maths as the calculator). */
export const suggestedOffer = (listType: ListType, country: string | null): SuggestedOffer => {
  const offer = LEAD_OFFER[listType];
  const market = marketForCountry(country);
  const list = compute(selectionFromItems(offer.items, market, false));
  const pilot = compute(selectionFromItems(offer.items, market, true));
  const f = (n: number) => formatMoney(n, market);
  return {
    name: offer.name,
    itemNames: offer.items.map((i) => BY_ID[i].name),
    market,
    marketLabel: MARKETS[market].label,
    list: { setup: f(list.setup), monthly: f(list.monthly) },
    pilot: { setup: f(pilot.setup), monthly: f(pilot.monthly) },
  };
};
