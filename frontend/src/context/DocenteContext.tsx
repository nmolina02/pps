import { createContext, useContext, useState, type ReactNode } from 'react';
import { obtainToken } from '../api/auth';
import { getTeacherProfile, updateTeacherPreferences } from '../api/docente';
import type { Theme } from '../api/types';

interface Docente {
  username: string;
  token: string;
  avatar: number;
  theme: Theme;
}

const STORAGE_KEY = 'cafe:docente';

function loadDocente(): Docente | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Docente) : null;
  } catch {
    return null;
  }
}

function saveDocente(docente: Docente | null) {
  if (docente) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(docente));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

interface DocenteContextValue {
  docente: Docente | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  setAvatar: (avatar: number) => void;
  setTheme: (theme: Theme) => void;
}

const DocenteContext = createContext<DocenteContextValue | null>(null);

export function DocenteProvider({ children }: { children: ReactNode }) {
  const [docente, setDocente] = useState<Docente | null>(() => loadDocente());

  async function login(username: string, password: string) {
    const { token } = await obtainToken(username, password);
    // El perfil (avatar/theme) se crea perezosamente en el backend en el
    // primer GET, así que siempre hay datos para traer acá.
    const profile = await getTeacherProfile(token);
    const next: Docente = { username, token, avatar: profile.avatar, theme: profile.theme };
    setDocente(next);
    saveDocente(next);
  }

  function logout() {
    setDocente(null);
    saveDocente(null);
  }

  function setAvatar(avatar: number) {
    setDocente((prev) => {
      if (!prev) return prev;
      const next = { ...prev, avatar };
      saveDocente(next);
      updateTeacherPreferences(next.token, { avatar }).catch((err) =>
        console.error('No se pudo guardar el avatar en el servidor', err),
      );
      return next;
    });
  }

  function setTheme(theme: Theme) {
    setDocente((prev) => {
      if (!prev) return prev;
      const next = { ...prev, theme };
      saveDocente(next);
      updateTeacherPreferences(next.token, { theme }).catch((err) =>
        console.error('No se pudo guardar el tema en el servidor', err),
      );
      return next;
    });
  }

  return (
    <DocenteContext.Provider value={{ docente, login, logout, setAvatar, setTheme }}>
      {children}
    </DocenteContext.Provider>
  );
}

export function useDocente() {
  const ctx = useContext(DocenteContext);
  if (!ctx) throw new Error('useDocente debe usarse dentro de <DocenteProvider>');
  return ctx;
}
