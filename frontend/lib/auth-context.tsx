"use client";

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Role, SessionUser } from "./types";
import { api, ApiError, getToken, setToken } from "./api";

interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  role: Role;
  institution?: string;
}

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  applySession: (token: string, sessionUser: SessionUser) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const USER_STORAGE_KEY = "aipath.user";

function landingPageFor(role: Role) {
  if (role === "lab_tech") return "/queue";
  if (role === "admin") return "/admin";
  return "/dashboard";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const bootstrap = async () => {
      const token = getToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const raw = window.localStorage.getItem(USER_STORAGE_KEY);
        if (raw) setUser(JSON.parse(raw));
        // Verify token is still valid / refresh user info in the background.
        const me = await api.get<{ user: SessionUser }>("/api/auth/me");
        setUser(me.user);
        window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(me.user));
      } catch {
        setToken(null);
        window.localStorage.removeItem(USER_STORAGE_KEY);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    bootstrap();
  }, []);

  const persistSession = (token: string, sessionUser: SessionUser) => {
    setToken(token);
    try {
      window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(sessionUser));
    } catch {
      // ignore
    }
    setUser(sessionUser);
  };

  const login = async (email: string, password: string) => {
    setError(null);
    try {
      const res = await api.post<{ token: string; user: SessionUser }>("/api/auth/login", { email, password });
      persistSession(res.token, res.user);
      router.push(landingPageFor(res.user.role));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Unable to reach the server. Please try again.";
      setError(message);
      throw err;
    }
  };

  const register = async (payload: RegisterPayload) => {
    setError(null);
    try {
      const res = await api.post<{ token: string; user: SessionUser }>("/api/auth/register", payload);
      persistSession(res.token, res.user);
      router.push(landingPageFor(res.user.role));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Unable to reach the server. Please try again.";
      setError(message);
      throw err;
    }
  };

  const logout = () => {
    setToken(null);
    try {
      window.localStorage.removeItem(USER_STORAGE_KEY);
    } catch {
      // ignore
    }
    setUser(null);
    router.push("/login");
  };

  const clearError = () => setError(null);

  const applySession = (token: string, sessionUser: SessionUser) => {
    persistSession(token, sessionUser);
    router.push(landingPageFor(sessionUser.role));
  };

  const value = useMemo(
    () => ({ user, loading, error, login, register, logout, clearError, applySession }),
    [user, loading, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
