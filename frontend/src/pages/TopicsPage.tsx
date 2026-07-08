import { Link } from 'react-router-dom';
import { listTopics } from '../api/cases';
import { useApi } from '../hooks/useApi';

export function TopicsPage() {
  const state = useApi(listTopics, []);

  return (
    <div className="container" style={{ padding: '48px 24px 64px' }}>
      <p className="mono prompt" style={{ color: 'var(--text-dim)', fontSize: '0.82rem', marginBottom: 10 }}>
        ls /banco-de-casos
      </p>
      <h1 className="cursor" style={{ marginBottom: 12 }}>
        Casos de falla — Sistemas Operativos
      </h1>
      <p style={{ maxWidth: 640, marginBottom: 40 }}>
        Cada tema arranca de un incidente real, no de una definición. Elegí un tema para
        explorar sus casos: diagnosticá el síntoma, formulá hipótesis y después contrastalas
        con la formalización conceptual.
      </p>

      {state.status === 'loading' && <p className="mono">cargando temas…</p>}
      {state.status === 'error' && (
        <ErrorPanel message={state.error.message} />
      )}
      {state.status === 'ready' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 16,
          }}
        >
          {state.data.map((topic, i) => (
            <Link key={topic.id} to={`/topics/${topic.slug}`}>
              <div
                className="panel panel-corners"
                style={{ padding: '22px 20px', height: '100%', transition: 'border-color .15s' }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <span className="mono" style={{ color: 'var(--text-dim)', fontSize: '0.78rem' }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 style={{ marginTop: 10, color: 'var(--text)' }}>{topic.name}</h3>
                <p className="mono" style={{ fontSize: '0.76rem', marginTop: 8, color: 'var(--text-dim)' }}>
                  /{topic.slug}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function ErrorPanel({ message }: { message: string }) {
  return (
    <div
      className="panel"
      style={{ padding: '18px 20px', borderColor: 'rgba(255,107,107,0.4)', background: 'var(--danger-soft)' }}
    >
      <p className="mono" style={{ color: 'var(--danger)' }}>
        <span className="status-dot danger" />
        {message}
      </p>
    </div>
  );
}
