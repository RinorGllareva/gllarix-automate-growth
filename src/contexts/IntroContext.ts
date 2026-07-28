import { createContext, useContext } from "react";

const IntroContext = createContext(false);

export const IntroProvider = IntroContext.Provider;

export const useIntroActive = () => useContext(IntroContext);
