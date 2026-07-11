import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDocente } from '../context/DocenteContext';
import { listTopics } from '../api/cases';
import { createQuiz, deleteQuiz, getQuiz, startQuiz, updateQuiz } from '../api/docente';
import { QUESTION_TYPE_LABELS } from '../api/types';
import type { CreateSessionQuestionInput, QuestionType, QuizWriteInput, Topic } from '../api/types';

function emptyOptions(type: QuestionType): CreateSessionQuestionInput['options'] {
  const count = type === 'fill_blank' ? 1 : 2;
  return Array.from({ length: count }, () => ({ text: '', is_correct: false }));
}

function emptyDraft(): CreateSessionQuestionInput {
  return {
    text: '',
    question_type: 'single_choice',
    justification: '',
    options: emptyOptions('single_choice'),
    points: 100,
    duration_seconds: 20,
    grace_seconds: 2,
  };
}

export function CreateSessionPage() {
  const { docente } = useDocente();
  const navigate = useNavigate();
  const { quizId } = useParams<{ quizId: string }>();
  const isEditing = Boolean(quizId);

  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicId, setTopicId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [sharedUsernames, setSharedUsernames] = useState<string[]>([]);
  const [usernameInput, setUsernameInput] = useState('');
  const [drafts, setDrafts] = useState<CreateSessionQuestionInput[]>([]);
  const [loading, setLoading] = useState(isEditing);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listTopics().then(setTopics).catch(() => setTopics([]));
  }, []);

  useEffect(() => {
    if (!docente || !quizId) return;
    getQuiz(docente.token, Number(quizId))
      .then((quiz) => {
        setTopicId(quiz.topic.id);
        setTitle(quiz.title);
        setSharedUsernames(quiz.shared_with);
        setDrafts(
          quiz.questions.map((q) => ({
            text: q.text,
            question_type: q.question_type,
            justification: q.justification,
            options: q.options.map((o) => ({ text: o.text, is_correct: o.is_correct })),
            points: q.points,
            duration_seconds: q.duration_seconds,
            grace_seconds: q.grace_seconds,
          })),
        );
      })
      .catch(() => setError('No se pudo cargar el cuestionario.'))
      .finally(() => setLoading(false));
  }, [docente, quizId]);

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

  if (isEditing && loading) {
    return (
      <div className="container" style={{ padding: '80px 24px', textAlign: 'center' }}>
        <p className="mono cursor">cargando cuestionario</p>
      </div>
    );
  }

  function handleTopicChange(nextTopicId: number | null) {
    setTopicId(nextTopicId);
    setDrafts([]);
  }

  function addSharedUsername() {
    const username = usernameInput.trim();
    if (username && !sharedUsernames.includes(username)) {
      setSharedUsernames((prev) => [...prev, username]);
    }
    setUsernameInput('');
  }

  function removeSharedUsername(username: string) {
    setSharedUsernames((prev) => prev.filter((u) => u !== username));
  }

  async function handleDelete() {
    if (!docente || !quizId) return;
    const confirmed = window.confirm(
      `¿Eliminar "${title}"? Se pierde el historial de sesiones jugadas con este cuestionario.`,
    );
    if (!confirmed) return;
    try {
      await deleteQuiz(docente.token, Number(quizId));
      navigate('/docente/cuestionarios');
    } catch {
      setError('No se pudo eliminar el cuestionario.');
    }
  }

  function addDraft() {
    setDrafts((prev) => [...prev, emptyDraft()]);
  }

  function removeDraft(index: number) {
    setDrafts((prev) => prev.filter((_, i) => i !== index));
  }

  function updateDraft(index: number, patch: Partial<CreateSessionQuestionInput>) {
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  function handleTypeChange(index: number, nextType: QuestionType) {
    setDrafts((prev) =>
      prev.map((d, i) => {
        if (i !== index) return d;
        const cleared = d.options.map((o) => ({ ...o, is_correct: false }));
        const minRows = nextType === 'fill_blank' ? 1 : 2;
        while (cleared.length < minRows) cleared.push({ text: '', is_correct: false });
        return { ...d, question_type: nextType, options: cleared };
      }),
    );
  }

  function updateOptionText(draftIndex: number, optionIndex: number, text: string) {
    setDrafts((prev) =>
      prev.map((d, i) =>
        i !== draftIndex ? d : { ...d, options: d.options.map((o, oi) => (oi === optionIndex ? { ...o, text } : o)) },
      ),
    );
  }

  function toggleCorrect(draftIndex: number, optionIndex: number) {
    setDrafts((prev) =>
      prev.map((d, i) => {
        if (i !== draftIndex) return d;
        if (d.question_type === 'single_choice') {
          return { ...d, options: d.options.map((o, oi) => ({ ...o, is_correct: oi === optionIndex })) };
        }
        return {
          ...d,
          options: d.options.map((o, oi) => (oi === optionIndex ? { ...o, is_correct: !o.is_correct } : o)),
        };
      }),
    );
  }

  function addOption(draftIndex: number) {
    setDrafts((prev) =>
      prev.map((d, i) => (i !== draftIndex ? d : { ...d, options: [...d.options, { text: '', is_correct: false }] })),
    );
  }

  function removeOption(draftIndex: number, optionIndex: number) {
    setDrafts((prev) =>
      prev.map((d, i) => (i !== draftIndex ? d : { ...d, options: d.options.filter((_, oi) => oi !== optionIndex) })),
    );
  }

  async function handleSubmit() {
    if (!docente || topicId === null || drafts.length === 0) return;
    if (!title.trim()) {
      setError('El cuestionario necesita un título.');
      return;
    }

    for (const draft of drafts) {
      if (!draft.text.trim() || !draft.justification.trim()) {
        setError('Todas las preguntas necesitan enunciado y justificación.');
        return;
      }
      const minOptions = draft.question_type === 'fill_blank' ? 1 : 2;
      const trimmed = draft.options.map((o) => ({ ...o, text: o.text.trim() })).filter((o) => o.text.length > 0);
      if (trimmed.length < minOptions) {
        setError(`Cada pregunta necesita al menos ${minOptions} opción(es).`);
        return;
      }
      if (draft.question_type !== 'fill_blank') {
        const correctCount = trimmed.filter((o) => o.is_correct).length;
        if (draft.question_type === 'single_choice' && correctCount !== 1) {
          setError('Las preguntas de opción única necesitan exactamente una opción correcta.');
          return;
        }
        if (draft.question_type === 'multiple_choice' && correctCount < 1) {
          setError('Las preguntas de opción múltiple necesitan al menos una opción correcta.');
          return;
        }
      }
    }

    setCreating(true);
    setError(null);
    const payload: QuizWriteInput = {
      topic_id: topicId,
      title: title.trim(),
      shared_with_usernames: sharedUsernames,
      questions: drafts.map((d) => ({
        ...d,
        text: d.text.trim(),
        justification: d.justification.trim(),
        options: d.options.map((o) => ({ text: o.text.trim(), is_correct: o.is_correct })).filter((o) => o.text),
      })),
    };

    if (isEditing && quizId) {
      try {
        await updateQuiz(docente.token, Number(quizId), payload);
        navigate('/docente/cuestionarios');
      } catch {
        setError('No se pudieron guardar los cambios.');
      } finally {
        setCreating(false);
      }
      return;
    }

    let newQuizId: number;
    try {
      const quiz = await createQuiz(docente.token, payload);
      newQuizId = quiz.id;
    } catch {
      setError('No se pudo guardar el cuestionario.');
      setCreating(false);
      return;
    }
    try {
      const session = await startQuiz(docente.token, newQuizId);
      navigate(`/docente/sala/${session.code}`);
    } catch {
      setError('El cuestionario se guardó, pero no se pudo iniciar la sesión. Podés iniciarla desde "cuestionarios".');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="container" style={{ padding: '40px 24px 96px', maxWidth: 760 }}>
      <p className="mono prompt" style={{ color: 'var(--text-dim)', fontSize: '0.82rem', marginBottom: 10 }}>
        {isEditing ? `quiz --edit ${quizId}` : 'new-quiz --interactive'}
      </p>
      <h1 style={{ marginBottom: 28 }}>{isEditing ? 'Editar cuestionario' : 'Armar cuestionario'}</h1>

      <section style={{ marginBottom: 28 }}>
        <h3 style={{ marginBottom: 10 }}>Título</h3>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="nombre del cuestionario"
          className="mono"
          style={{ ...inputStyle, maxWidth: 400 }}
        />

        <p className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: 16, marginBottom: 8 }}>
          compartir con (username del docente)
        </p>
        <div style={{ display: 'flex', gap: 8, maxWidth: 400 }}>
          <input
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addSharedUsername();
              }
            }}
            placeholder="usuario del docente"
            className="mono"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button type="button" className="btn" onClick={addSharedUsername}>
            agregar
          </button>
        </div>
        {sharedUsernames.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            {sharedUsernames.map((username) => (
              <span key={username} className="chip" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {username}
                <button
                  type="button"
                  onClick={() => removeSharedUsername(username)}
                  className="mono"
                  style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 0, fontSize: '0.85rem' }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      <section style={{ marginBottom: 28 }}>
        <h3 style={{ marginBottom: 10 }}>1. Tema</h3>
        <select
          value={topicId ?? ''}
          onChange={(e) => handleTopicChange(e.target.value ? Number(e.target.value) : null)}
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
          <h3 style={{ marginBottom: 14 }}>2. Preguntas ({drafts.length})</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {drafts.map((draft, index) => (
              <QuestionDraftEditor
                key={index}
                questionIndex={index}
                draft={draft}
                onChangeType={(t) => handleTypeChange(index, t)}
                onChangeField={(patch) => updateDraft(index, patch)}
                onChangeOptionText={(oi, text) => updateOptionText(index, oi, text)}
                onToggleCorrect={(oi) => toggleCorrect(index, oi)}
                onAddOption={() => addOption(index)}
                onRemoveOption={(oi) => removeOption(index, oi)}
                onRemove={() => removeDraft(index)}
              />
            ))}
          </div>

          <button type="button" className="btn" style={{ marginTop: 16 }} onClick={addDraft}>
            + agregar pregunta
          </button>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button
              className="btn primary"
              style={{ marginTop: 24 }}
              disabled={drafts.length === 0 || !title.trim() || creating}
              onClick={handleSubmit}
            >
              {creating
                ? 'guardando…'
                : isEditing
                  ? 'guardar cambios →'
                  : `guardar y arrancar (${drafts.length} pregunta${drafts.length === 1 ? '' : 's'}) →`}
            </button>
            {isEditing && (
              <button
                type="button"
                className="btn"
                style={{ marginTop: 24, borderColor: 'var(--danger)', color: 'var(--danger)' }}
                onClick={handleDelete}
              >
                eliminar cuestionario
              </button>
            )}
          </div>
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

function QuestionDraftEditor({
  questionIndex,
  draft,
  onChangeType,
  onChangeField,
  onChangeOptionText,
  onToggleCorrect,
  onAddOption,
  onRemoveOption,
  onRemove,
}: {
  questionIndex: number;
  draft: CreateSessionQuestionInput;
  onChangeType: (t: QuestionType) => void;
  onChangeField: (patch: Partial<CreateSessionQuestionInput>) => void;
  onChangeOptionText: (optionIndex: number, text: string) => void;
  onToggleCorrect: (optionIndex: number) => void;
  onAddOption: () => void;
  onRemoveOption: (optionIndex: number) => void;
  onRemove: () => void;
}) {
  const minOptions = draft.question_type === 'fill_blank' ? 1 : 2;

  return (
    <div className="panel" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <select
          value={draft.question_type}
          onChange={(e) => onChangeType(e.target.value as QuestionType)}
          className="mono"
          style={{ ...selectStyle, minWidth: 180 }}
        >
          {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((t) => (
            <option key={t} value={t}>
              {QUESTION_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onRemove}
          className="mono"
          style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.85rem' }}
        >
          quitar pregunta
        </button>
      </div>

      <textarea
        value={draft.text}
        onChange={(e) => onChangeField({ text: e.target.value })}
        placeholder="enunciado"
        className="mono"
        style={textareaStyle}
        rows={2}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {draft.options.map((option, oi) => (
          <div key={oi} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {draft.question_type !== 'fill_blank' && (
              <input
                type={draft.question_type === 'single_choice' ? 'radio' : 'checkbox'}
                name={`correct-option-${questionIndex}`}
                checked={option.is_correct}
                onChange={() => onToggleCorrect(oi)}
                title="marcar como correcta"
              />
            )}
            <input
              value={option.text}
              onChange={(e) => onChangeOptionText(oi, e.target.value)}
              className="mono"
              style={{ ...inputStyle, flex: 1 }}
              placeholder={draft.question_type === 'fill_blank' ? 'respuesta aceptada' : 'texto de la opción'}
            />
            <button
              type="button"
              onClick={() => onRemoveOption(oi)}
              disabled={draft.options.length <= minOptions}
              className="mono"
              style={{
                background: 'none',
                border: 'none',
                color: draft.options.length <= minOptions ? 'var(--text-dim)' : 'var(--danger)',
                cursor: draft.options.length <= minOptions ? 'default' : 'pointer',
                fontSize: '0.85rem',
              }}
            >
              quitar
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={onAddOption}
          className="mono"
          style={{ background: 'none', border: 'none', color: 'var(--accent-strong)', cursor: 'pointer', fontSize: '0.85rem', alignSelf: 'flex-start' }}
        >
          + agregar opción
        </button>
      </div>

      <textarea
        value={draft.justification}
        onChange={(e) => onChangeField({ justification: e.target.value })}
        placeholder="justificación (se muestra después de responder)"
        className="mono"
        style={textareaStyle}
        rows={2}
      />

      <div style={{ display: 'flex', gap: 16 }}>
        <NumberField label="pts" value={draft.points} onChange={(v) => onChangeField({ points: v })} />
        <NumberField label="seg" value={draft.duration_seconds} onChange={(v) => onChangeField({ duration_seconds: v })} />
        <NumberField label="gracia s" value={draft.grace_seconds} onChange={(v) => onChangeField({ grace_seconds: v })} />
      </div>
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
