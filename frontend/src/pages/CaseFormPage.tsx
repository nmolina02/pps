import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useDocente } from '../context/DocenteContext';
import { listTopics, getCase } from '../api/cases';
import { createCase, updateCase } from '../api/docente';
import { VISUAL_MODEL_LABELS } from '../api/types';
import type { Topic, VisualModel } from '../api/types';

const VISUAL_MODELS = Object.keys(VISUAL_MODEL_LABELS) as VisualModel[];

export function CaseFormPage() {
  const { docente } = useDocente();
  const { caseSlug } = useParams<{ caseSlug: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(caseSlug);

  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicId, setTopicId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [scenario, setScenario] = useState('');
  const [guidingQuestions, setGuidingQuestions] = useState('');
  const [theory, setTheory] = useState('');
  const [visualModel, setVisualModel] = useState<VisualModel>(VISUAL_MODELS[0]);
  const [visualModelData, setVisualModelData] = useState('');
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listTopics().then(setTopics).catch(() => setTopics([]));
  }, []);

  useEffect(() => {
    if (!caseSlug) return;
    getCase(caseSlug)
      .then((c) => {
        setTopicId(c.topic.id);
        setTitle(c.title);
        setScenario(c.scenario);
        setGuidingQuestions(c.guiding_questions);
        setTheory(c.theory);
        setVisualModel(c.visual_model);
        setVisualModelData(c.visual_model_data ? JSON.stringify(c.visual_model_data, null, 2) : '');
      })
      .catch(() => setError('No se pudo cargar el caso.'))
      .finally(() => setLoading(false));
  }, [caseSlug]);

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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!docente || topicId === null || !title.trim()) return;

    let parsedVisualModelData: unknown = null;
    if (visualModelData.trim()) {
      try {
        parsedVisualModelData = JSON.parse(visualModelData);
      } catch {
        setError('El modelo visual (JSON) no es válido.');
        return;
      }
    }

    setSaving(true);
    setError(null);
    const payload = {
      topic: topicId,
      title: title.trim(),
      scenario,
      guiding_questions: guidingQuestions,
      theory,
      visual_model: visualModel,
      visual_model_data: parsedVisualModelData,
    };
    try {
      if (isEditing && caseSlug) {
        await updateCase(docente.token, caseSlug, payload);
      } else {
        await createCase(docente.token, payload);
      }
      navigate('/docente/casos');
    } catch {
      setError('No se pudo guardar el caso.');
    } finally {
      setSaving(false);
    }
  }

  if (isEditing && loading) {
    return (
      <div className="container" style={{ padding: '80px 24px', textAlign: 'center' }}>
        <p className="mono cursor">cargando caso</p>
      </div>
    );
  }

  if (isEditing && !loading && error && !title) {
    return <Navigate to="/docente/casos" replace />;
  }

  return (
    <div className="container" style={{ padding: '40px 24px 96px', maxWidth: 760 }}>
      <p className="mono prompt" style={{ color: 'var(--text-dim)', fontSize: '0.82rem', marginBottom: 10 }}>
        {isEditing ? `case --edit ${caseSlug}` : 'case --new'}
      </p>
      <h1 style={{ marginBottom: 28 }}>{isEditing ? 'Editar caso' : 'Nuevo caso de falla'}</h1>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Field label="Tema">
          <select
            value={topicId ?? ''}
            onChange={(e) => setTopicId(e.target.value ? Number(e.target.value) : null)}
            className="mono"
            style={selectStyle}
          >
            <option value="">seleccionar…</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Título">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="mono" style={inputStyle} />
        </Field>

        <Field label="Escenario (caso de falla)">
          <textarea value={scenario} onChange={(e) => setScenario(e.target.value)} className="mono" style={textareaStyle} rows={5} />
        </Field>

        <Field label="Preguntas guía (análisis)">
          <textarea
            value={guidingQuestions}
            onChange={(e) => setGuidingQuestions(e.target.value)}
            className="mono"
            style={textareaStyle}
            rows={4}
          />
        </Field>

        <Field label="Teoría (formalización)">
          <textarea value={theory} onChange={(e) => setTheory(e.target.value)} className="mono" style={textareaStyle} rows={5} />
        </Field>

        <Field label="Modelo visual">
          <select
            value={visualModel}
            onChange={(e) => setVisualModel(e.target.value as VisualModel)}
            className="mono"
            style={selectStyle}
          >
            {VISUAL_MODELS.map((vm) => (
              <option key={vm} value={vm}>
                {VISUAL_MODEL_LABELS[vm]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Datos del modelo visual (JSON, opcional)">
          <textarea
            value={visualModelData}
            onChange={(e) => setVisualModelData(e.target.value)}
            className="mono"
            style={textareaStyle}
            rows={4}
            placeholder="{}"
          />
        </Field>

        <div>
          <button type="submit" className="btn primary" disabled={saving || topicId === null || !title.trim()}>
            {saving ? 'guardando…' : isEditing ? 'guardar cambios →' : 'crear caso →'}
          </button>
        </div>

        {error && (
          <p className="mono" style={{ color: 'var(--danger)', fontSize: '0.82rem' }}>
            <span className="status-dot danger" />
            {error}
          </p>
        )}
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
        {label}
      </span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-inset)',
  border: '1px solid var(--border-strong)',
  borderRadius: 3,
  padding: '0.65em 0.9em',
  color: 'var(--text)',
  fontSize: '0.92rem',
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: 'vertical',
  fontFamily: 'inherit',
  lineHeight: 1.5,
};

const selectStyle: React.CSSProperties = {
  background: 'var(--bg-inset)',
  border: '1px solid var(--border-strong)',
  borderRadius: 3,
  padding: '0.6em 0.9em',
  color: 'var(--text)',
  fontSize: '0.9rem',
  minWidth: 240,
};
