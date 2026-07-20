import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useDocente } from '../context/DocenteContext';
import { listTopics, getCase } from '../api/cases';
import { createCase, deleteCase, updateCase } from '../api/docente';
import type { Topic } from '../api/types';
import { VisualModelEditorPreview } from '../components/visualModels/VisualModelPreview';
import { examplesByTema, REGISTRY_EXAMPLES } from '../components/visualModels/registry';

const EXAMPLE_GROUPS = examplesByTema();
const FIRST_EXAMPLE = EXAMPLE_GROUPS[0]?.items[0]?.tipo ?? '';

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
  const [graphicData, setGraphicData] = useState('');
  const [exampleKind, setExampleKind] = useState<string>(FIRST_EXAMPLE);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [caseAuthor, setCaseAuthor] = useState<string | null>(null);

  useEffect(() => {
    listTopics().then(setTopics).catch(() => setTopics([]));
  }, []);

  useEffect(() => {
    if (!caseSlug) return;
    getCase(caseSlug)
      .then((c) => {
        setCaseAuthor(c.author);
        setTopicId(c.topic.id);
        setTitle(c.title);
        setScenario(c.scenario);
        setGuidingQuestions(c.guiding_questions);
        setTheory(c.theory);
        setGraphicData(c.graphic?.data ? JSON.stringify(c.graphic.data, null, 2) : '');
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

    let parsedGraphicData: unknown = null;
    if (graphicData.trim()) {
      try {
        parsedGraphicData = JSON.parse(graphicData);
      } catch {
        setError('El gráfico (JSON) no es válido.');
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
      graphic_data: parsedGraphicData,
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

  async function handleDelete() {
    if (!docente || !caseSlug) return;
    const confirmed = window.confirm(`¿Eliminar "${title}"? También se borra su gráfico asociado.`);
    if (!confirmed) return;
    try {
      await deleteCase(docente.token, caseSlug);
      navigate('/docente/casos');
    } catch {
      setError('No se pudo eliminar el caso.');
    }
  }

  function handleCancel() {
    const hasContent =
      title.trim().length > 0 ||
      scenario.trim().length > 0 ||
      guidingQuestions.trim().length > 0 ||
      theory.trim().length > 0 ||
      graphicData.trim().length > 0 ||
      topicId !== null;
    if (hasContent && !window.confirm('¿Cancelar? Se pierde lo que armaste hasta ahora, no se guarda nada.')) {
      return;
    }
    navigate('/docente/casos');
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

  if (isEditing && !loading && caseAuthor !== null && caseAuthor !== docente.username) {
    return (
      <div className="container" style={{ padding: '80px 24px', textAlign: 'center' }}>
        <p style={{ marginBottom: 14 }}>
          Este caso es de <strong>{caseAuthor}</strong> — solo el autor puede editarlo o borrarlo.
        </p>
        <Link to="/docente/casos" className="btn primary">
          volver →
        </Link>
      </div>
    );
  }

  let parsedPreviewData: unknown = null;
  let previewJsonInvalid = false;
  try {
    parsedPreviewData = graphicData.trim() ? JSON.parse(graphicData) : null;
  } catch {
    previewJsonInvalid = true;
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

        <Field label="Gráfico del caso (JSON, opcional)">
          <textarea
            value={graphicData}
            onChange={(e) => setGraphicData(e.target.value)}
            className="mono"
            style={textareaStyle}
            rows={8}
            placeholder="{}"
          />
        </Field>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={exampleKind}
            onChange={(e) => setExampleKind(e.target.value)}
            className="mono"
            style={{ ...selectStyle, minWidth: 0 }}
          >
            {EXAMPLE_GROUPS.map((group) => (
              <optgroup key={group.tema} label={group.tema}>
                {group.items.map((item) => (
                  <option key={item.tipo} value={item.tipo}>
                    {item.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <button
            type="button"
            className="mono"
            onClick={() => setGraphicData(JSON.stringify(REGISTRY_EXAMPLES[exampleKind], null, 2))}
            style={{ background: 'none', border: 'none', color: 'var(--accent-strong)', cursor: 'pointer', fontSize: '0.82rem', padding: 0 }}
          >
            cargar ejemplo →
          </button>
        </div>
        <p className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: -12 }}>
          no hace falta elegir el tipo de gráfico a mano para tu propio caso — poné un campo "tipo" en tu
          JSON (o dejalo sin tipo y se intenta detectar solo). Los ejemplos de arriba son solo para empezar.
        </p>

        <Field label="Previsualización">
          {previewJsonInvalid ? (
            <p className="mono" style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>
              El JSON tiene un error de sintaxis, corregilo para ver la previsualización.
            </p>
          ) : (
            <VisualModelEditorPreview data={parsedPreviewData} />
          )}
        </Field>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          {isEditing ? (
            <button type="button" className="btn danger" onClick={handleDelete}>
              eliminar caso
            </button>
          ) : (
            <button type="button" className="btn danger" disabled={saving} onClick={handleCancel}>
              cancelar
            </button>
          )}
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
