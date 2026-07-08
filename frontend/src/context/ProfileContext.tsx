import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getStudentProfile } from '../api/students';

export type Theme = 'dark' | 'light';

export interface LocalProfile {
  legajo: string;
  fullName: string;
  avatar: number;
  theme: Theme;
}

const STORAGE_KEY = 'cafe:profile';

function loadProfile(): LocalProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LocalProfile) : null;
  } catch {
    return null;
  }
}

function saveProfile(profile: LocalProfile | null) {
  if (profile) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
  document.documentElement.dataset.theme = profile?.theme === 'light' ? 'light' : 'dark';
}

interface ProfileContextValue {
  profile: LocalProfile | null;
  identify: (legajo: string) => Promise<void>;
  setAvatar: (avatar: number) => void;
  setTheme: (theme: Theme) => void;
  forget: () => void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<LocalProfile | null>(() => loadProfile());

  useEffect(() => {
    document.documentElement.dataset.theme = profile?.theme === 'light' ? 'light' : 'dark';
  }, [profile?.theme]);

  async function identify(legajo: string) {
    const data = await getStudentProfile(legajo);
    const next: LocalProfile = {
      legajo: data.legajo,
      fullName: data.full_name,
      avatar: profile?.avatar ?? 0,
      theme: profile?.theme ?? 'dark',
    };
    setProfile(next);
    saveProfile(next);
  }

  function setAvatar(avatar: number) {
    setProfile((prev) => {
      if (!prev) return prev;
      const next = { ...prev, avatar };
      saveProfile(next);
      return next;
    });
  }

  function setTheme(theme: Theme) {
    setProfile((prev) => {
      const next = prev ? { ...prev, theme } : prev;
      if (next) saveProfile(next);
      else document.documentElement.dataset.theme = theme;
      return next;
    });
  }

  function forget() {
    setProfile(null);
    saveProfile(null);
  }

  return (
    <ProfileContext.Provider value={{ profile, identify, setAvatar, setTheme, forget }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile debe usarse dentro de <ProfileProvider>');
  return ctx;
}
