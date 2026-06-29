"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ChallengeType } from '@/types';
import { propFirmPresets } from '@/data/propFirmPresets';

interface AdminContextType {
  isAdmin: boolean;
  toggleAdmin: () => void;
  challengeTypes: ChallengeType[];
  addChallengeType: (type: ChallengeType) => void;
  updateChallengeType: (id: string, type: ChallengeType) => void;
  deleteChallengeType: (id: string) => void;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

const ADMIN_STORAGE_KEY = 'prop_firm_admin_enabled';
const CHALLENGE_TYPES_STORAGE_KEY = 'prop_firm_challenge_types';

export function AdminProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [challengeTypes, setChallengeTypes] = useState<ChallengeType[]>([]);

  // Load admin state from localStorage
  useEffect(() => {
    const storedAdmin = localStorage.getItem(ADMIN_STORAGE_KEY);
    if (storedAdmin === 'true') {
      setIsAdmin(true);
    }
  }, []);

  // Load challenge types from localStorage or use presets
  useEffect(() => {
    const storedTypes = localStorage.getItem(CHALLENGE_TYPES_STORAGE_KEY);
    if (storedTypes) {
      setChallengeTypes(JSON.parse(storedTypes));
    } else {
      // Initialize with presets
      setChallengeTypes(propFirmPresets);
      localStorage.setItem(CHALLENGE_TYPES_STORAGE_KEY, JSON.stringify(propFirmPresets));
    }
  }, []);

  const toggleAdmin = () => {
    const newState = !isAdmin;
    setIsAdmin(newState);
    localStorage.setItem(ADMIN_STORAGE_KEY, String(newState));
  };

  const addChallengeType = (type: ChallengeType) => {
    const newTypes = [...challengeTypes, type];
    setChallengeTypes(newTypes);
    localStorage.setItem(CHALLENGE_TYPES_STORAGE_KEY, JSON.stringify(newTypes));
  };

  const updateChallengeType = (id: string, updatedType: ChallengeType) => {
    const newTypes = challengeTypes.map(type => 
      type.id === id ? updatedType : type
    );
    setChallengeTypes(newTypes);
    localStorage.setItem(CHALLENGE_TYPES_STORAGE_KEY, JSON.stringify(newTypes));
  };

  const deleteChallengeType = (id: string) => {
    const newTypes = challengeTypes.filter(type => type.id !== id);
    setChallengeTypes(newTypes);
    localStorage.setItem(CHALLENGE_TYPES_STORAGE_KEY, JSON.stringify(newTypes));
  };

  return (
    <AdminContext.Provider value={{
      isAdmin,
      toggleAdmin,
      challengeTypes,
      addChallengeType,
      updateChallengeType,
      deleteChallengeType,
    }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
}
