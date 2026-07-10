import { createContext, useContext, useState, type ReactNode } from 'react';
import { getStudentProfile, updateStudentPreferences } from '../api/students';
import type { Theme } from '../api/types';

export type { Theme } from '../api/types';

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

  async function identify(legajo: string) {
    // El backend es la fuente de verdad de avatar/theme: así las preferencias
    // viajan con el alumno entre dispositivos, no solo en este navegador.
    const data = await getStudentProfile(legajo);
    const next: LocalProfile = {
      legajo: data.legajo,
      fullName: data.full_name,
      avatar: data.avatar,
      theme: data.theme,
    };
    setProfile(next);
    saveProfile(next);
  }

  function setAvatar(avatar: number) {
    setProfile((prev) => {
      if (!prev) return prev;
      const next = { ...prev, avatar };
      saveProfile(next);
      updateStudentPreferences(next.legajo, { avatar }).catch((err) =>
        console.error('No se pudo guardar el avatar en el servidor', err),
      );
      return next;
    });
  }

  function setTheme(theme: Theme) {
    setProfile((prev) => {
      if (!prev) return prev;
      const next = { ...prev, theme };
      saveProfile(next);
      updateStudentPreferences(next.legajo, { theme }).catch((err) =>
        console.error('No se pudo guardar el tema en el servidor', err),
      );
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
