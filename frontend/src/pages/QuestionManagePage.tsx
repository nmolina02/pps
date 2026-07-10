import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDocente } from '../context/DocenteContext';
import { listTopics } from '../api/cases';
import { listQuestions } from '../api/questions';
import { QUESTION_TYPE_LABELS } from '../api/types';
import type { Question, Topic } from '../api/types';

export function QuestionManagePage() {
  const { docente } = useDocente();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicSlug, setTopicSlug] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listTopics().then(setTopics).catch(() => setTopics([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    listQuestions(topicSlug || undefined)
      .then((data) => setQuestions(data.results))
      .finally(() => setLoading(false));
  }, [topicSlug]);

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
            questions --manage
          </p>
          <h1>Banco de preguntas</h1>
        </div>
        <Link to="/docente/preguntas/nueva" className="btn primary">
          nueva pregunta →
        </Link>
      </div>

      <div style={{ marginBottom: 20 }}>
        <select value={topicSlug} onChange={(e) => setTopicSlug(e.target.value)} className="mono" style={selectStyle}>
          <option value="">todos los temas</option>
          {topics.map((t) => (
            <option key={t.id} value={t.slug}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {loading && <p className="mono cursor">cargando preguntas</p>}

      {!loading && questions.length === 0 && (
        <p className="mono" style={{ color: 'var(--text-dim)' }}>
          Todavía no hay preguntas cargadas.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {questions.map((q) => (
          <div
            key={q.id}
            className="panel"
            style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}
          >
            <div style={{ minWidth: 0 }}>
              <p style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {q.text}
              </p>
              <p className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: 4 }}>
                {QUESTION_TYPE_LABELS[q.question_type]} · {q.options.length} opción(es)
              </p>
            </div>
            <Link
              to={`/docente/preguntas/${q.id}/editar`}
              className="mono"
              style={{ color: 'var(--accent-strong)', fontSize: '0.85rem', flexShrink: 0 }}
            >
              editar →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  background: 'var(--bg-inset)',
  border: '1px solid var(--border-strong)',
  borderRadius: 3,
  padding: '0.6em 0.9em',
  color: 'var(--text)',
  fontSize: '0.9rem',
  minWidth: 240,
};
