import { Link, useParams } from 'react-router-dom';
import { getCase } from '../api/cases';
import { useApi } from '../hooks/useApi';
import { ErrorPanel } from './TopicsPage';
import { QuestionCard } from '../components/QuestionCard';
import { VisualModelPreview } from '../components/visualModels/VisualModelPreview';

export function CaseDetailPage() {
  const { caseSlug } = useParams<{ caseSlug: string }>();
  const state = useApi(() => getCase(caseSlug!), [caseSlug]);

  if (state.status === 'loading') {
    return (
      <div className="container" style={{ padding: '48px 24px' }}>
        <p className="mono">cargando caso…</p>
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <div className="container" style={{ padding: '48px 24px' }}>
        <ErrorPanel message={state.error.message} />
      </div>
    );
  }

  const c = state.data;

  return (
    <div className="container" style={{ padding: '40px 24px 72px' }}>
      <Link to={`/topics/${c.topic.slug}`} className="mono" style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
        ← {c.topic.name}
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 18, marginBottom: 6 }}>
        <span className="status-dot warn" />
        <span className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
          case://{c.topic.slug}/{c.slug}
        </span>
      </div>
      <h1 style={{ marginBottom: 14 }}>{c.title}</h1>

      {c.graphic?.data != null && (
        <div style={{ marginTop: 12 }}>
          <VisualModelPreview data={c.graphic.data} />
        </div>
      )}

      <Section label="C" title="Caso de falla" text={c.scenario} />
      <Section label="A" title="Análisis guiado" text={c.guiding_questions} />
      <Section label="F" title="Formalización conceptual" text={c.theory} accent="ok" />

      {c.questions.length > 0 && (
        <div style={{ marginTop: 44 }}>
          <p className="mono prompt" style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginBottom: 16 }}>
            E — evaluación conceptual
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {c.questions.map((q, i) => (
              <QuestionCard key={q.id} question={q} index={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Section({
  label,
  title,
  text,
  accent = 'accent',
}: {
  label: string;
  title: string;
  text: string;
  accent?: 'accent' | 'ok';
}) {
  const color = accent === 'ok' ? 'var(--ok)' : 'var(--accent-strong)';
  return (
    <div style={{ marginTop: 36 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
        <span className="mono" style={{ fontSize: '1.1rem', fontWeight: 700, color }}>
          {label}
        </span>
        <h2>{title}</h2>
      </div>
      <div className="panel" style={{ padding: '18px 22px', borderLeft: `2px solid ${color}` }}>
        <p style={{ color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{text}</p>
      </div>
    </div>
  );
}
