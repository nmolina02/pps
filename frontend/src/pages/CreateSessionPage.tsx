import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDocente } from '../context/DocenteContext';
import { listTopics } from '../api/cases';
import { listQuestions } from '../api/questions';
import { createSession } from '../api/host';
import { QUESTION_TYPE_LABELS } from '../api/types';
import type { CreateSessionQuestionInput, Question, Topic } from '../api/types';

export function CreateSessionPage() {
  const { docente } = useDocente();
  const navigate = useNavigate();

  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicId, setTopicId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selected, setSelected] = useState<CreateSessionQuestionInput[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listTopics().then(setTopics).catch(() => setTopics([]));
  }, []);

  useEffect(() => {
    setSelected([]);
    if (topicId === null) {
      setQuestions([]);
      return;
    }
    const topic = topics.find((t) => t.id === topicId);
    if (!topic) return;
    listQuestions(topic.slug).then((data) => setQuestions(data.results));
  }, [topicId, topics]);

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

  function toggleQuestion(q: Question) {
    setSelected((prev) => {
      const exists = prev.find((s) => s.question_id === q.id);
      if (exists) return prev.filter((s) => s.question_id !== q.id);
      return [...prev, { question_id: q.id, points: 100, duration_seconds: 20, grace_seconds: 2 }];
    });
  }

  function updateSelected(questionId: number, patch: Partial<CreateSessionQuestionInput>) {
    setSelected((prev) => prev.map((s) => (s.question_id === questionId ? { ...s, ...patch } : s)));
  }

  async function handleCreate() {
    if (topicId === null || selected.length === 0) return;
    setCreating(true);
    setError(null);
    try {
      const session = await createSession(docente.token, { topic_id: topicId, questions: selected });
      navigate(`/docente/sala/${session.code}`);
    } catch {
      setError('No se pudo crear la sesión.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="container" style={{ padding: '40px 24px 96px', maxWidth: 760 }}>
      <p className="mono prompt" style={{ color: 'var(--text-dim)', fontSize: '0.82rem', marginBottom: 10 }}>
        new-session --interactive
      </p>
      <h1 style={{ marginBottom: 28 }}>Armar cuestionario</h1>

      <section style={{ marginBottom: 28 }}>
        <h3 style={{ marginBottom: 10 }}>1. Tema</h3>
        <select
          value={topicId ?? ''}
          onChange={(e) => setTopicId(e.target.value ? Number(e.target.value) : null)}
          className="mono"
          style={{ ...selectStyle }}
        >
          <option value="">seleccionar…</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </section>

      {topicId !== null && (
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <h3>2. Preguntas ({selected.length} seleccionadas)</h3>
            <Link to={`/docente/preguntas/nueva?topic=${topicId}`} className="mono" style={{ color: 'var(--accent-strong)', fontSize: '0.85rem' }}>
              + nueva pregunta
            </Link>
          </div>
          {questions.length === 0 && <p className="mono">Este tema todavía no tiene preguntas cargadas.</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {questions.map((q) => {
              const sel = selected.find((s) => s.question_id === q.id);
              return (
                <div
                  key={q.id}
                  className="panel"
                  style={{ padding: '14px 16px', borderColor: sel ? 'var(--accent)' : 'var(--border)' }}
                >
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!sel} onChange={() => toggleQuestion(q)} style={{ marginTop: 4 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <span style={{ color: 'var(--text)' }}>{q.text}</span>
                        <span className="chip">{QUESTION_TYPE_LABELS[q.question_type]}</span>
                      </div>
                    </div>
                  </label>
                  {sel && (
                    <div style={{ display: 'flex', gap: 16, marginTop: 12, paddingLeft: 28 }}>
                      <NumberField label="pts" value={sel.points} onChange={(v) => updateSelected(q.id, { points: v })} />
                      <NumberField
                        label="seg"
                        value={sel.duration_seconds}
                        onChange={(v) => updateSelected(q.id, { duration_seconds: v })}
                      />
                      <NumberField
                        label="gracia s"
                        value={sel.grace_seconds}
                        onChange={(v) => updateSelected(q.id, { grace_seconds: v })}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button
            className="btn primary"
            style={{ marginTop: 24 }}
            disabled={selected.length === 0 || creating}
            onClick={handleCreate}
          >
            {creating ? 'creando…' : `crear sesión con ${selected.length} pregunta${selected.length === 1 ? '' : 's'} →`}
          </button>
          {error && (
            <p className="mono" style={{ color: 'var(--danger)', fontSize: '0.82rem', marginTop: 12 }}>
              <span className="status-dot danger" />
              {error}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 6 }}>
      {label}
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mono"
        style={{
          width: 60,
          background: 'var(--bg-inset)',
          border: '1px solid var(--border-strong)',
          borderRadius: 3,
          padding: '0.3em 0.5em',
          color: 'var(--text)',
        }}
      />
    </label>
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
