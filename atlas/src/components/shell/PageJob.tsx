import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useUser } from "@/auth/AuthContext";
import { Icon } from "@/components/ui/primitives";
import { jobFor } from "@/config/pageJobs";
import { NAV_ITEMS } from "@/lib/nav";

const KEY = "atlas-page-jobs";
const EVENT = "atlas-page-jobs";
const read = () => {
  try {
    return window.localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
};
export const setPageJobsVisible = (on: boolean) => {
  try {
    window.localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    /* private window: just for this session */
  }
  window.dispatchEvent(new Event(EVENT));
};
export const usePageJobsVisible = () => {
  const [on, setOn] = useState(read);
  useEffect(() => {
    const f = () => setOn(read());
    window.addEventListener(EVENT, f);
    return () => window.removeEventListener(EVENT, f);
  }, []);
  return on;
};

/** Standalone routes that aren't nav items. */
const EXTRA: Record<string, string> = { "/automations": "automations", "/cadences": "cadences" };

/** "Why you're here": the page's job for this person's role, on the page's main view only (not on a lead or a deal). */
const PageJob = () => {
  const user = useUser();
  const { pathname } = useLocation();
  const on = usePageJobsVisible();
  const key = EXTRA[pathname] ?? NAV_ITEMS.find((n) => n.path === pathname)?.id;
  const job = jobFor(key, user.role);
  if (!on || !job) return null;
  return (
    <div className="mb-5 flex items-center gap-2.5 rounded-lg border border-line bg-surface/60 px-3.5 py-2 text-[13px]" role="note" aria-label="What this page is for">
      <span className="shrink-0 text-app">
        <Icon d="M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18M12 16v-4M12 8h.01" size={15} />
      </span>
      <span className="min-w-0 flex-1 text-text-2">
        <span className="text-text">{job.job}.</span> <span className="text-text-3">Done when: {job.outcome.charAt(0).toLowerCase() + job.outcome.slice(1)}.</span>
      </span>
      <button type="button" className="shrink-0 text-[12px] text-text-3 hover:text-text" onClick={() => setPageJobsVisible(false)} title="Turn these back on from your user menu">
        Hide tips
      </button>
    </div>
  );
};

export default PageJob;
