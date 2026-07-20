import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDocente } from '../context/DocenteContext';
import { listMyCases } from '../api/cases';
import type { CaseListItem } from '../api/types';

const DIACRITICS = /[̀-ͯ]/g;
const PAGE_SIZE = 20;

function normalize(value: string): string {
  return value.normalize('NFD').replace(DIACRITICS, '').toLowerCase();
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-inset)',
  border: '1px solid var(--border-strong)',
  borderRadius: 3,
  padding: '0.65em 0.9em',
  color: 'var(--text)',
  fontSize: '0.92rem',
};

export function CaseManagePage() {
  const { docente } = useDocente();
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!docente) return;
    listMyCases(docente.token)
      .then(setCases)
      .finally(() => setLoading(false));
  }, [docente]);

  const filtered = useMemo(() => {
    const query = normalize(search.trim());
    if (!query) return cases;
    return cases.filter((c) => normalize(c.title).includes(query));
  }, [cases, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search]);

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
          <h1>Mis casos de falla</h1>
        </div>
        <Link to="/docente/casos/nuevo" className="btn primary">
          nuevo caso →
        </Link>
      </div>

      {loading && <p className="mono cursor">cargando casos</p>}

      {!loading && cases.length === 0 && (
        <p className="mono" style={{ color: 'var(--text-dim)' }}>
          Todavía no cargaste ningún caso.
        </p>
      )}

      {!loading && cases.length > 0 && (
        <div style={{ position: 'relative', marginBottom: 20 }}>
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-dim)"
            strokeWidth="2"
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
          >
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.1" y2="16.1" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mono"
            placeholder="buscar por título…"
            style={{ ...inputStyle, width: '100%', paddingLeft: '2.4em' }}
          />
        </div>
      )}

      {!loading && cases.length > 0 && filtered.length === 0 && (
        <p className="mono" style={{ color: 'var(--text-dim)' }}>
          Ningún caso coincide con "{search}".
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {paged.map((c) => (
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

      {pageCount > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 28 }}>
          <button
            type="button"
            className="btn"
            disabled={currentPage === 1}
            onClick={() => setPage(currentPage - 1)}
            style={{ padding: '0.4em 0.8em' }}
          >
            ‹ anterior
          </button>
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              className="mono"
              onClick={() => setPage(n)}
              style={{
                minWidth: 30,
                padding: '0.4em 0.6em',
                borderRadius: 3,
                border: n === currentPage ? '1px solid var(--accent-strong)' : '1px solid var(--border-strong)',
                background: n === currentPage ? 'var(--accent-soft)' : 'var(--bg-inset)',
                color: n === currentPage ? 'var(--accent-strong)' : 'var(--text-dim)',
                fontSize: '0.82rem',
                cursor: 'pointer',
              }}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            className="btn"
            disabled={currentPage === pageCount}
            onClick={() => setPage(currentPage + 1)}
            style={{ padding: '0.4em 0.8em' }}
          >
            siguiente ›
          </button>
        </div>
      )}
    </div>
  );
}
