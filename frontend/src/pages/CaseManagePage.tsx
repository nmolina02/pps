import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDocente } from '../context/DocenteContext';
import { listCases } from '../api/cases';
import type { CaseListItem } from '../api/types';

export function CaseManagePage() {
  const { docente } = useDocente();
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listCases()
      .then((data) => setCases(data.results))
      .finally(() => setLoading(false));
  }, []);

  if (!docente) {
    return (
      <div className="container" style={{ padding: '48px 24px' }}>
        <p style={{ marginBottom: 14 }}>Necesitás iniciar sesión como docente.</p>
        <Link to="/docente" className="btn primary">
          ir a login →
        </Link>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '40px 24px 96px', maxWidth: 760 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <p className="mono prompt" style={{ color: 'var(--text-dim)', fontSize: '0.82rem', marginBottom: 10 }}>
            cases --manage
          </p>
          <h1>Casos de falla</h1>
        </div>
        <Link to="/docente/casos/nuevo" className="btn primary">
          nuevo caso →
        </Link>
      </div>

      {loading && <p className="mono cursor">cargando casos</p>}

      {!loading && cases.length === 0 && (
        <p className="mono" style={{ color: 'var(--text-dim)' }}>
          Todavía no hay casos cargados.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {cases.map((c) => (
          <div
            key={c.id}
            className="panel"
            style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <div>
              <p style={{ color: 'var(--text)' }}>{c.title}</p>
              <p className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: 4 }}>
                {c.topic.name}
              </p>
            </div>
            <Link to={`/docente/casos/${c.slug}/editar`} className="mono" style={{ color: 'var(--accent-strong)', fontSize: '0.85rem' }}>
              editar →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
