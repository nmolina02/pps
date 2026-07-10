import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useDocente } from '../context/DocenteContext';
import { listTopics, listCases } from '../api/cases';
import { getQuestion, createQuestion, updateQuestion } from '../api/docente';
import { QUESTION_TYPE_LABELS } from '../api/types';
import type { CaseListItem, QuestionType, Topic } from '../api/types';

const QUESTION_TYPES = Object.keys(QUESTION_TYPE_LABELS) as QuestionType[];

interface OptionRow {
  text: string;
  is_correct: boolean;
}

function emptyOptions(type: QuestionType): OptionRow[] {
  const count = type === 'fill_blank' ? 1 : 2;
  return Array.from({ length: count }, () => ({ text: '', is_correct: false }));
}

export function QuestionFormPage() {
  const { docente } = useDocente();
  const { questionId } = useParams<{ questionId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEditing = Boolean(questionId);

  const [topics, setTopics] = useState<Topic[]>([]);
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [topicId, setTopicId] = useState<number | null>(() => {
    const fromQuery = searchParams.get('topic');
    return fromQuery ? Number(fromQuery) : null;
  });
  const [caseId, setCaseId] = useState<number | null>(null);
  const [questionType, setQuestionType] = useState<QuestionType>('single_choice');
  const [text, setText] = useState('');
  const [justification, setJustification] = useState('');
  const [conceptualError, setConceptualError] = useState('');
  const [options, setOptions] = useState<OptionRow[]>(() => emptyOptions('single_choice'));
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listTopics().then(setTopics).catch(() => setTopics([]));
  }, []);

  useEffect(() => {
    if (topicId === null) {
      setCases([]);
      return;
    }
    const topic = topics.find((t) => t.id === topicId);
    if (!topic) return;
    listCases(topic.slug).then((data) => setCases(data.results));
  }, [topicId, topics]);

  useEffect(() => {
    if (!docente || !questionId) return;
    getQuestion(docente.token, Number(questionId))
      .then((q) => {
        setTopicId(q.topic);
        setCaseId(q.case);
        setQuestionType(q.question_type);
        setText(q.text);
        setJustification(q.justification);
        setConceptualError(q.conceptual_error);
        setOptions(q.options.map((o) => ({ text: o.text, is_correct: o.is_correct })));
      })
      .catch(() => setError('No se pudo cargar la pregunta.'))
      .finally(() => setLoading(false));
  }, [docente, questionId]);

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

  function handleTypeChange(nextType: QuestionType) {
    setQuestionType(nextType);
    setOptions((prev) => {
      const cleared = prev.map((o) => ({ ...o, is_correct: false }));
      const minRows = nextType === 'fill_blank' ? 1 : 2;
      while (cleared.length < minRows) cleared.push({ text: '', is_correct: false });
      return cleared;
    });
  }

  function updateOptionText(index: number, value: string) {
    setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, text: value } : o)));
  }

  function toggleCorrect(index: number) {
    setOptions((prev) => {
      if (questionType === 'single_choice') {
        return prev.map((o, i) => ({ ...o, is_correct: i === index }));
      }
      return prev.map((o, i) => (i === index ? { ...o, is_correct: !o.is_correct } : o));
    });
  }

  function addOption() {
    setOptions((prev) => [...prev, { text: '', is_correct: false }]);
  }

  function removeOption(index: number) {
    setOptions((prev) => prev.filter((_, i) => i !== index));
  }

  const minOptions = questionType === 'fill_blank' ? 1 : 2;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!docente || topicId === null || !text.trim() || !justification.trim()) return;

    const trimmed = options
      .map((o) => ({ ...o, text: o.text.trim() }))
      .filter((o) => o.text.length > 0);

    if (trimmed.length < minOptions) {
      setError(`Se necesitan al menos ${minOptions} opción(es).`);
      return;
    }
    if (questionType !== 'fill_blank') {
      const correctCount = trimmed.filter((o) => o.is_correct).length;
      if (questionType === 'single_choice' && correctCount !== 1) {
        setError('Opción única necesita exactamente una opción correcta.');
        return;
      }
      if (questionType === 'multiple_choice' && correctCount < 1) {
        setError('Opción múltiple necesita al menos una opción correcta.');
        return;
      }
    }

    setSaving(true);
    setError(null);
    const payload = {
      topic: topicId,
      case: caseId,
      text: text.trim(),
      question_type: questionType,
      justification: justification.trim(),
      conceptual_error: conceptualError.trim(),
      options: trimmed.map((o) => ({ text: o.text, is_correct: questionType === 'fill_blank' ? true : o.is_correct })),
    };
    try {
      if (isEditing && questionId) {
        await updateQuestion(docente.token, Number(questionId), payload);
      } else {
        await createQuestion(docente.token, payload);
      }
      navigate('/docente/preguntas');
    } catch {
      setError('No se pudo guardar la pregunta.');
    } finally {
      setSaving(false);
    }
  }

  if (isEditing && loading) {
    return (
      <div className="container" style={{ padding: '80px 24px', textAlign: 'center' }}>
        <p className="mono cursor">cargando pregunta</p>
      </div>
    );
  }

  if (isEditing && !loading && error && !text) {
    return <Navigate to="/docente/preguntas" replace />;
  }

  return (
    <div className="container" style={{ padding: '40px 24px 96px', maxWidth: 760 }}>
      <p className="mono prompt" style={{ color: 'var(--text-dim)', fontSize: '0.82rem', marginBottom: 10 }}>
        {isEditing ? `question --edit ${questionId}` : 'question --new'}
      </p>
      <h1 style={{ marginBottom: 28 }}>{isEditing ? 'Editar pregunta' : 'Nueva pregunta'}</h1>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Field label="Tema">
          <select
            value={topicId ?? ''}
            onChange={(e) => {
              setTopicId(e.target.value ? Number(e.target.value) : null);
              setCaseId(null);
            }}
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

        <Field label="Caso de falla (opcional)">
          <select
            value={caseId ?? ''}
            onChange={(e) => setCaseId(e.target.value ? Number(e.target.value) : null)}
            className="mono"
            style={selectStyle}
            disabled={topicId === null}
          >
            <option value="">ninguno</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Tipo de pregunta">
          <select
            value={questionType}
            onChange={(e) => handleTypeChange(e.target.value as QuestionType)}
            className="mono"
            style={selectStyle}
          >
            {QUESTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {QUESTION_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Enunciado">
          <textarea value={text} onChange={(e) => setText(e.target.value)} className="mono" style={textareaStyle} rows={3} />
        </Field>

        <Field label={questionType === 'fill_blank' ? 'Respuestas aceptadas' : 'Opciones'}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {options.map((option, index) => (
              <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {questionType !== 'fill_blank' && (
                  <input
                    type={questionType === 'single_choice' ? 'radio' : 'checkbox'}
                    name="correct-option"
                    checked={option.is_correct}
                    onChange={() => toggleCorrect(index)}
                    title="marcar como correcta"
                  />
                )}
                <input
                  value={option.text}
                  onChange={(e) => updateOptionText(index, e.target.value)}
                  className="mono"
                  style={{ ...inputStyle, flex: 1 }}
                  placeholder={questionType === 'fill_blank' ? 'respuesta aceptada' : 'texto de la opción'}
                />
                <button
                  type="button"
                  onClick={() => removeOption(index)}
                  disabled={options.length <= minOptions}
                  className="mono"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: options.length <= minOptions ? 'var(--text-dim)' : 'var(--danger)',
                    cursor: options.length <= minOptions ? 'default' : 'pointer',
                    fontSize: '0.85rem',
                  }}
                >
                  quitar
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addOption}
              className="mono"
              style={{ background: 'none', border: 'none', color: 'var(--accent-strong)', cursor: 'pointer', fontSize: '0.85rem', alignSelf: 'flex-start' }}
            >
              + agregar opción
            </button>
          </div>
        </Field>

        <Field label="Justificación (se muestra después de responder)">
          <textarea
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            className="mono"
            style={textareaStyle}
            rows={3}
          />
        </Field>

        <Field label="Error conceptual que busca detectar (opcional)">
          <input
            value={conceptualError}
            onChange={(e) => setConceptualError(e.target.value)}
            className="mono"
            style={inputStyle}
          />
        </Field>

        <div>
          <button
            type="submit"
            className="btn primary"
            disabled={saving || topicId === null || !text.trim() || !justification.trim()}
          >
            {saving ? 'guardando…' : isEditing ? 'guardar cambios →' : 'crear pregunta →'}
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
