import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getMe, type User } from '../api/endpoints';
import { ApiError } from '../api/client';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  login: () => {},
  logout: async () => {},
  setUser: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      try {
        if (!localStorage.getItem('auth_token')) return;
        const restoredUser = await getMe();
        if (active) setUser(restoredUser);
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 400)) {
          localStorage.removeItem('auth_token');
        }
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    restoreSession();
    return () => { active = false; };
  }, []);

  function login(token: string, user: User) {
    localStorage.setItem('auth_token', token);
    setUser(user);
  }

  async function logout() {
    localStorage.removeItem('auth_token');
    sessionStorage.removeItem('ai_bole_show_onboarding');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
