import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type UserRole = 'developer' | 'api_owner' | 'admin' | 'reviewer';
export type UserStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export interface MDA {
  id: string;
  name: string;
  shortName: string;
}

export interface AuthUser {
  id: string;
  full_name: string;
  email: string;
  account_type: string;
  requested_role: UserRole;
  requested_mda_id: string | null;
  requested_organization: string;
  requested_purpose: string;
  status: UserStatus;
  role: UserRole | null;
  mda_id: string | null;
  rejection_reason: string | null;
}

interface SignupInput {
  full_name: string;
  email: string;
  password: string;
  account_type: string;
  requested_role: UserRole;
  requested_mda_id: string | null;
  requested_organization: string;
  requested_purpose: string;
}

interface UserContextType {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  role: UserRole;
  mdaId: string;
  isAuthenticated: boolean;
  isApproved: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  signup: (input: SignupInput) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setRole: (role: UserRole) => void;
  setMdaId: (mdaId: string) => void;
  mdas: MDA[];
  currentMda: MDA | undefined;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
const TOKEN_KEY = 'govhub_auth_token';

export const MDAS_LIST: MDA[] = [
  { id: 'mda-01', name: 'National Identification and Registration Authority', shortName: 'NIRA' },
  { id: 'mda-02', name: 'Uganda Revenue Authority', shortName: 'URA' },
  { id: 'mda-03', name: 'Uganda Registration Services Bureau', shortName: 'URSB' },
  { id: 'mda-04', name: 'Ministry of Works and Transport', shortName: 'MoWT' },
  { id: 'mda-05', name: 'Ministry of ICT and National Guidance', shortName: 'MoICT' },
  { id: 'mda-06', name: 'Ministry of Health', shortName: 'MoH' },
];

async function parseAuthResponse(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || 'Authentication request failed.');
  }
  return body;
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init = {}) => {
      const currentToken = localStorage.getItem(TOKEN_KEY);
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const isApiRequest = url.startsWith('/api') || url.startsWith(API_BASE);
      const headers = new Headers(init.headers);

      if (currentToken && isApiRequest && !headers.has('authorization')) {
        headers.set('authorization', `Bearer ${currentToken}`);
      }

      return originalFetch(input, { ...init, headers });
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  const refreshUser = async () => {
    const currentToken = localStorage.getItem(TOKEN_KEY);
    if (!currentToken) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const body = await parseAuthResponse(await fetch(`${API_BASE}/api/auth/me`));
      setUser(body.user);
      setToken(currentToken);
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (email: string, password: string) => {
    const body = await parseAuthResponse(await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }));
    localStorage.setItem(TOKEN_KEY, body.token);
    setToken(body.token);
    setUser(body.user);
    return body.user as AuthUser;
  };

  const signup = async (input: SignupInput) => {
    const body = await parseAuthResponse(await fetch(`${API_BASE}/api/auth/signup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    }));
    return body.user as AuthUser;
  };

  const logout = async () => {
    await fetch(`${API_BASE}/api/auth/logout`, { method: 'POST' }).catch(() => undefined);
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  };

  const role = user?.status === 'APPROVED' && user.role ? user.role : 'developer';
  const mdaId = user?.status === 'APPROVED' && user.mda_id ? user.mda_id : user?.requested_mda_id || '';
  const currentMda = useMemo(() => MDAS_LIST.find(m => m.id === mdaId), [mdaId]);

  return (
    <UserContext.Provider value={{
      user,
      token,
      loading,
      role,
      mdaId,
      isAuthenticated: Boolean(user),
      isApproved: user?.status === 'APPROVED',
      login,
      signup,
      logout,
      refreshUser,
      setRole: () => undefined,
      setMdaId: () => undefined,
      mdas: MDAS_LIST,
      currentMda,
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
