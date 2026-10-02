import { useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { data, type User } from "@/data";
import { AuthContext } from "./authContextObject";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    data.currentUser().then((u) => {
      if (cancelled) return;
      setUser(u);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await data.signInWithPassword(email, password);
    if (result.ok) setUser(result.user);
    return result;
  }, []);

  const signOut = useCallback(async () => {
    await data.signOut();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, signIn, signOut, sendMagicLink: data.sendMagicLink }),
    [user, loading, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
};

/** For pages inside the authenticated shell, where a user is guaranteed. */
export const useUser = () => {
  const { user } = useAuth();
  if (!user) throw new Error("useUser called outside an authenticated route");
  return user;
};
