import { useEffect, useState } from "react";

/** Light / dark / follow the system. Stored per browser; index.html applies it before the first paint (no flash). */
export type ThemePref = "system" | "light" | "dark";
const KEY = "atlas-theme";
const EVENT = "atlas:theme";

const media = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null);

export const readThemePref = (): ThemePref => {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
};

export const resolveTheme = (pref: ThemePref): "light" | "dark" => (pref === "system" ? (media()?.matches ? "light" : "dark") : pref);

export const applyTheme = (pref: ThemePref = readThemePref()) => {
  document.documentElement.dataset.theme = resolveTheme(pref);
};

export const setThemePref = (pref: ThemePref) => {
  try {
    if (pref === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    // storage blocked: the choice lasts for this page load
  }
  applyTheme(pref);
  window.dispatchEvent(new Event(EVENT));
};

/** Current preference and resolved theme; follows system changes while on "system". */
export const useTheme = () => {
  const [pref, setPref] = useState<ThemePref>(readThemePref);
  const [resolved, setResolved] = useState(() => resolveTheme(readThemePref()));
  useEffect(() => {
    const sync = () => {
      const p = readThemePref();
      setPref(p);
      setResolved(resolveTheme(p));
      applyTheme(p);
    };
    const m = media();
    m?.addEventListener?.("change", sync);
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      m?.removeEventListener?.("change", sync);
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return { pref, resolved, setPref: setThemePref };
};
