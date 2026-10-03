import { usePageChrome } from "@/components/shell/PageChrome";
import PriceBookSection from "@/pages/admin/PriceBookSection";

/** Money › Prices and calculator: the price book every quote is built from (same screen as Admin › Price book). */
const Prices = () => {
  usePageChrome({ context: "Money · prices", action: { label: "Open deals", to: "/deals" } });
  return <PriceBookSection />;
};

export default Prices;
