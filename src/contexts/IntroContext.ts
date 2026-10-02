import { createContext, useContext } from "react";

/**
 * playing   – glass logo assembling over the dimmed hero
 * revealing – hero copy animates in while the logo flies to the nav
 * docked    – the flying logo has landed; the nav logo takes over
 * done      – intro finished (or skipped for this session)
 */
export type IntroPhase = "playing" | "revealing" | "docked" | "done";

const IntroContext = createContext<IntroPhase>("done");

export const IntroProvider = IntroContext.Provider;

export const useIntroPhase = () => useContext(IntroContext);

export const useIntroActive = () => useContext(IntroContext) !== "done";

export const useHeroRevealed = () => {
  const phase = useContext(IntroContext);
  return phase !== "playing";
};

export const useLogoDocked = () => {
  const phase = useContext(IntroContext);
  return phase === "docked" || phase === "done";
};
