import { usePageChrome } from "@/components/shell/PageChrome";
import CadencesSection from "@/pages/admin/CadencesSection";

/** Growth › Outreach cadences: the same editor as Settings › Cadences, on its own page (not inside the Settings menu). */
const Cadences = () => {
  usePageChrome({ context: "Growth · outreach cadences" });
  return <CadencesSection />;
};

export default Cadences;
