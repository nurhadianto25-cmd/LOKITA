import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { storage } from "@/src/utils/storage";
import { api, setToken, loadStoredToken, TOKEN_KEY } from "@/src/api/client";

export type User = {
  id: string;
  phone: string;
  name: string;
  is_buyer: boolean;
  is_seller: boolean;
  platform_roles: string[];
  community_roles: Record<string, string>;
  active_community_id: string | null;
  address: any;
  reliability: { score: number; transactions: number };
  avatar_file_id?: string | null;
};

type AuthState = {
  ready: boolean;
  user: User | null;
  signIn: (token: string, user: User) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<User | null>;
  setUser: (u: User) => void;
};

const Ctx = createContext<AuthState>({} as AuthState);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUserState] = useState<User | null>(null);

  const refresh = useCallback(async () => {
    try {
      const u = await api.get("/auth/me");
      setUserState(u);
      return u;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    (async () => {
      const t = await loadStoredToken();
      if (t) await refresh();
      setReady(true);
    })();
  }, [refresh]);

  const signIn = useCallback(async (token: string, u: User) => {
    setToken(token);
    await storage.secureSet(TOKEN_KEY, token);
    setUserState(u);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {}
    setToken(null);
    await storage.secureRemove(TOKEN_KEY);
    setUserState(null);
  }, []);

  return (
    <Ctx.Provider value={{ ready, user, signIn, signOut, refresh, setUser: setUserState }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
