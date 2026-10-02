import { createContext } from "react";
import type { SignInResult, User } from "@/data";

export interface AuthState {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  sendMagicLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

/**
 * Lives in its own module so hot reloads of the provider don't create a second context
 * (which would leave consumers reading an empty one during development).
 */
export const AuthContext = createContext<AuthState | null>(null);
