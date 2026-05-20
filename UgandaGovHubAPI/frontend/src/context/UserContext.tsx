import React, { createContext, useContext, useState } from 'react';

export type UserRole = 'developer' | 'api_owner' | 'admin' | 'reviewer';

export interface MDA {
  id: string;
  name: string;
  shortName: string;
}

interface UserContextType {
  role: UserRole;
  mdaId: string;
  setRole: (role: UserRole) => void;
  setMdaId: (mdaId: string) => void;
  mdas: MDA[];
  currentMda: MDA | undefined;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const MDAS_LIST: MDA[] = [
  { id: 'mda-01', name: 'National Identification and Registration Authority', shortName: 'NIRA' },
  { id: 'mda-02', name: 'Uganda Revenue Authority', shortName: 'URA' },
  { id: 'mda-03', name: 'Uganda Registration Services Bureau', shortName: 'URSB' },
  { id: 'mda-04', name: 'Ministry of Works and Transport', shortName: 'MoWT' },
  { id: 'mda-05', name: 'Ministry of ICT and National Guidance', shortName: 'MoICT' },
  { id: 'mda-06', name: 'Ministry of Health', shortName: 'MoH' },
];

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<UserRole>(() => {
    return (localStorage.getItem('govhub_role') as UserRole) || 'developer';
  });

  const [mdaId, setMdaIdState] = useState<string>(() => {
    return localStorage.getItem('govhub_mda_id') || 'mda-06'; // Default to MoH developer
  });

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole);
    localStorage.setItem('govhub_role', newRole);
    
    // Automatically set logical MDA when switching roles
    if (newRole === 'admin') {
      setMdaId('mda-05'); // MoICT owns the platform admin role
    } else if (newRole === 'api_owner') {
      // Default to NIRA for owner view
      setMdaId('mda-01');
    } else if (newRole === 'reviewer') {
      setMdaId('mda-05'); // Platform auditor/reviewer
    } else {
      // Developer
      setMdaId('mda-06'); // MoH
    }
  };

  const setMdaId = (newMdaId: string) => {
    setMdaIdState(newMdaId);
    localStorage.setItem('govhub_mda_id', newMdaId);
  };

  const currentMda = MDAS_LIST.find(m => m.id === mdaId);

  return (
    <UserContext.Provider value={{ role, mdaId, setRole, setMdaId, mdas: MDAS_LIST, currentMda }}>
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
