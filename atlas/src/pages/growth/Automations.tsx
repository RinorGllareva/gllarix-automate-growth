import { usePageChrome } from "@/components/shell/PageChrome";
import { AutomationsView } from "@/pages/tasks/AutomationsView";
import RunsByItself from "./RunsByItself";

/** Growth › Automations: what runs by itself (and what it gives back), then the task rules, templates and run log. */
const Automations = () => {
  usePageChrome({ context: "Growth · automations", action: { label: "Open tasks", to: "/tasks" } });
  return <AutomationsView intro={<RunsByItself />} />;
};

export default Automations;
