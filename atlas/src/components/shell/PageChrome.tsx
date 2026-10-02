import { createContext, useContext, useEffect } from "react";
import type { PageChrome } from "./TopBar";

/** Lets a page put live text (e.g. "4,812 LEADS · 1,204 TIER A/B") and its own action in the top bar. */
export const PageChromeContext = createContext<(chrome: PageChrome | null) => void>(() => undefined);

export const usePageChrome = (chrome: PageChrome | null) => {
  const set = useContext(PageChromeContext);
  const key = JSON.stringify(chrome);
  useEffect(() => {
    set(chrome);
    return () => set(null);
    // `key` (the serialized chrome) is the real dependency, so a new object with the same content doesn't re-run this.
  }, [key, set]);
};
