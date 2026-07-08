import { createContext, useContext, useState, type ReactNode } from 'react';
import { obtainToken } from '../api/auth';

interface Docente {
  username: string;
  token: string;
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

interface DocenteContextValue {
  docente: Docente | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const DocenteContext = createContext<DocenteContextValue | null>(null);

export function DocenteProvider({ children }: { children: ReactNode }) {
  const [docente, setDocente] = useState<Docente | null>(() => loadDocente());

  async function login(username: string, password: string) {
    const { token } = await obtainToken(username, password);
    const next = { username, token };
    setDocente(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function logout() {
    setDocente(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  return <DocenteContext.Provider value={{ docente, login, logout }}>{children}</DocenteContext.Provider>;
}

export function useDocente() {
  const ctx = useContext(DocenteContext);
  if (!ctx) throw new Error('useDocente debe usarse dentro de <DocenteProvider>');
  return ctx;
}
