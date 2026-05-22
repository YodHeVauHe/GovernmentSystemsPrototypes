import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type UserRole = 'developer' | 'api_owner' | 'admin' | 'reviewer';
export type UserStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export interface MDA {
  id: string;
  name: string;
  shortName: string;
  logoUrl: string;
  logoSourceUrl: string;
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
  {
    id: 'mda-01',
    name: 'National Identification and Registration Authority',
    shortName: 'NIRA',
    logoUrl: '/mda-logos/nira.png',
    logoSourceUrl: 'https://www.nira.go.ug/media/2021/05/nira_logo_black@2x.png',
  },
  {
    id: 'mda-02',
    name: 'Uganda Revenue Authority',
    shortName: 'URA',
    logoUrl: '/mda-logos/ura.png',
    logoSourceUrl: 'https://ura.go.ug/wp-content/uploads/2022/10/URA-logo.png',
  },
  {
    id: 'mda-03',
    name: 'Uganda Registration Services Bureau',
    shortName: 'URSB',
    logoUrl: '/mda-logos/ursb.png',
    logoSourceUrl: 'https://ursb.go.ug/wp-content/uploads/2021/10/URSB-LOGO.png',
  },
  {
    id: 'mda-04',
    name: 'Ministry of Works and Transport',
    shortName: 'MoWT',
    logoUrl: '/mda-logos/mowt.png',
    logoSourceUrl: 'https://works.go.ug/wp-content/uploads/2025/09/logo.png',
  },
  {
    id: 'mda-05',
    name: 'Ministry of ICT and National Guidance',
    shortName: 'MoICT',
    logoUrl: '/mda-logos/moict.png',
    logoSourceUrl: 'https://ict.go.ug/site/ictlogo.png',
  },
  {
    id: 'mda-06',
    name: 'Ministry of Health',
    shortName: 'MoH',
    logoUrl: '/mda-logos/moh.png',
    logoSourceUrl: 'https://health.go.ug/wp-content/uploads/2025/02/MoH-Logo.png',
  },
  {
    id: 'mda-07',
    name: 'Public Procurement and Disposal of Public Assets Authority',
    shortName: 'PPDA',
    logoUrl: '/mda-logos/ppda.png',
    logoSourceUrl: 'https://www.ppda.go.ug/wp-content/themes/ppda/images/logo/logo.png',
  },
  {
    id: 'mda-08',
    name: 'National Social Security Fund',
    shortName: 'NSSF',
    logoUrl: '/mda-logos/nssf.jpg',
    logoSourceUrl: 'https://mastercardfdn.org/en/partners/nssf-uganda/',
  },
  {
    id: 'mda-09',
    name: 'Uganda Police Force',
    shortName: 'UPF',
    logoUrl: '/mda-logos/upf.png',
    logoSourceUrl: 'https://upf.go.ug/wp-content/uploads/2026/04/header_banner_logo.png',
  },
  {
    id: 'mda-10',
    name: 'National Information Technology Authority - Uganda',
    shortName: 'NITA-U',
    logoUrl: '/mda-logos/nita.png',
    logoSourceUrl: 'https://www.nita.go.ug/sites/default/files/LOGOS8-07.png',
  },
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
