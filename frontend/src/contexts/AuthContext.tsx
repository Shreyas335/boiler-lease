import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { User } from "../types/auth";
import * as authApi from "../api/auth";

type LoginResult =
  | { success: true }
  | { requires_2fa: true; temp_token: string };

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (login: string, password: string) => Promise<LoginResult>;
  verify2FA: (tempToken: string, code: string) => Promise<void>;
  register: (params: Parameters<typeof authApi.register>[0]) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    try {
      await authApi.fetchCsrfToken();
      const currentUser = await authApi.getCurrentUser();
      setUser(currentUser);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = useCallback(
    async (login: string, password: string): Promise<LoginResult> => {
      const data = await authApi.login(login, password);
      if (data.requires_2fa && data.temp_token) {
        return { requires_2fa: true, temp_token: data.temp_token };
      }
      setUser(data as User);
      return { success: true };
    },
    []
  );

  const verify2FA = useCallback(async (tempToken: string, code: string) => {
    const loggedInUser = await authApi.verify2FALogin(tempToken, code);
    setUser(loggedInUser);
  }, []);

  const register = useCallback(
    async (params: Parameters<typeof authApi.register>[0]) => {
      const newUser = await authApi.register(params);
      setUser(newUser);
    },
    []
  );

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const currentUser = await authApi.getCurrentUser();
    setUser(currentUser);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, verify2FA, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
