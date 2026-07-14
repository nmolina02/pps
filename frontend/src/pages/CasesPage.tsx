import { Link, useParams } from 'react-router-dom';
import { listCases } from '../api/cases';
import { useApi } from '../hooks/useApi';
import { ErrorPanel } from './TopicsPage';

export function CasesPage() {
  const { topicSlug } = useParams<{ topicSlug: string }>();
  const state = useApi(() => listCases(topicSlug), [topicSlug]);

  const topicName =
    state.status === 'ready' && state.data.results.length > 0
      ? state.data.results[0].topic.name
      : topicSlug;

  return (
    <div className="container" style={{ padding: '48px 24px 64px' }}>
      <Link to="/" className="mono" style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
        ← volver
      </Link>
      <p className="mono prompt" style={{ color: 'var(--text-dim)', fontSize: '0.82rem', marginTop: 18, marginBottom: 10 }}>
        cd /banco-de-casos/{topicSlug}
      </p>
      <h1 style={{ marginBottom: 32 }}>{topicName}</h1>

      {state.status === 'loading' && <p className="mono">cargando casos…</p>}
      {state.status === 'error' && <ErrorPanel message={state.error.message} />}
      {state.status === 'ready' && state.data.results.length === 0 && (
        <p className="mono">Todavía no hay casos cargados para este tema.</p>
      )}
      {state.status === 'ready' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {state.data.results.map((c) => (
            <Link key={c.id} to={`/cases/${c.slug}`}>
              <div
                className="panel"
                style={{
                  padding: '18px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  transition: 'border-color .15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="status-dot warn" />
                  <span style={{ color: 'var(--text)' }}>{c.title}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
