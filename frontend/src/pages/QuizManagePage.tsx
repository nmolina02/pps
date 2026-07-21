import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDocente } from '../context/DocenteContext';
import {
  listQuizzes,
  startQuiz,
  clearMyHistory,
  shareQuizzesWithComisiones,
  unshareQuizzesFromComisiones,
} from '../api/docente';
import type { Quiz } from '../api/types';

// Mayúsculas para que siempre coincida con Student.comision (normalizada
// igual del lado del backend) sin importar cómo la tipeó el docente.
function parseComisiones(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(',')
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean),
    ),
  );
}

export function QuizManagePage() {
  const { docente } = useDocente();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [clearMode, setClearMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [clearing, setClearing] = useState(false);

  const [shareMode, setShareMode] = useState(false);
  const [shareSelectedIds, setShareSelectedIds] = useState<Set<number>>(new Set());
  const [comisionesInput, setComisionesInput] = useState('');
  const [sharing, setSharing] = useState(false);
  const [unsharing, setUnsharing] = useState(false);
  const [shareSuccess, setShareSuccess] = useState<string | null>(null);

  function refresh(token: string) {
    setLoading(true);
    listQuizzes(token)
      .then(setQuizzes)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (docente) refresh(docente.token);
  }, [docente?.token]);

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

  async function handleStart(quiz: Quiz) {
    if (!docente) return;
    setBusyId(quiz.id);
    setError(null);
    try {
      const session = await startQuiz(docente.token, quiz.id);
      navigate(`/docente/sala/${session.code}`);
    } catch {
      setError('No se pudo iniciar la sesión.');
      setBusyId(null);
    }
  }

  function enterClearMode() {
    cancelShareMode();
    setClearMode(true);
    setSelectedIds(new Set());
    setError(null);
  }

  function cancelClearMode() {
    setClearMode(false);
    setSelectedIds(new Set());
  }

  function enterShareMode() {
    cancelClearMode();
    setShareMode(true);
    setShareSelectedIds(new Set());
    setComisionesInput('');
    setShareSuccess(null);
    setError(null);
  }

  function cancelShareMode() {
    setShareMode(false);
    setShareSelectedIds(new Set());
    setComisionesInput('');
  }

  function toggleShareSelected(quizId: number) {
    setShareSuccess(null);
    setShareSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(quizId)) next.delete(quizId);
      else next.add(quizId);
      return next;
    });
  }

  function selectAllShare() {
    setShareSelectedIds(
      new Set(
        quizzes
          .filter((q) => q.host === docente?.username || q.shared_with.includes(docente?.username ?? ''))
          .map((q) => q.id),
      ),
    );
  }

  function selectNoneShare() {
    setShareSelectedIds(new Set());
  }

  function toggleSelected(quizId: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(quizId)) next.delete(quizId);
      else next.add(quizId);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(quizzes.map((q) => q.id)));
  }

  function selectNone() {
    setSelectedIds(new Set());
  }

  async function handleClearHistory() {
    if (!docente || selectedIds.size === 0) return;
    const quizIds = Array.from(selectedIds);
    const confirmed = window.confirm(
      `Se reseteará el puntaje acumulado de todos los alumnos en las sesiones que arrancaste de ${quizIds.length} cuestionario${quizIds.length === 1 ? '' : 's'} seleccionado${quizIds.length === 1 ? '' : 's'}. No afecta las sesiones de otros docentes. ¿Continuar?`,
    );
    if (!confirmed) return;
    setClearing(true);
    setError(null);
    try {
      await clearMyHistory(docente.token, quizIds);
      cancelClearMode();
    } catch {
      setError('No se pudo limpiar el puntaje.');
    } finally {
      setClearing(false);
    }
  }

  async function handleShare() {
    if (!docente || shareSelectedIds.size === 0) return;
    const comisiones = parseComisiones(comisionesInput);
    if (comisiones.length === 0) {
      setError('Ingresá al menos una comisión.');
      return;
    }
    setSharing(true);
    setError(null);
    try {
      await shareQuizzesWithComisiones(docente.token, {
        quiz_ids: Array.from(shareSelectedIds),
        comisiones,
      });
      setShareSuccess(`Compartido con ${comisiones.length === 1 ? 'la comisión' : 'las comisiones'} ${comisiones.join(', ')}.`);
      setComisionesInput('');
      setShareSelectedIds(new Set());
      refresh(docente.token);
    } catch {
      setError('No se pudo compartir el cuestionario.');
    } finally {
      setSharing(false);
    }
  }

  async function handleUnshare() {
    if (!docente || shareSelectedIds.size === 0) return;
    const comisiones = parseComisiones(comisionesInput);
    if (comisiones.length === 0) {
      setError('Ingresá al menos una comisión.');
      return;
    }
    setUnsharing(true);
    setError(null);
    try {
      await unshareQuizzesFromComisiones(docente.token, {
        quiz_ids: Array.from(shareSelectedIds),
        comisiones,
      });
      setShareSuccess(`Se dejó de compartir con ${comisiones.length === 1 ? 'la comisión' : 'las comisiones'} ${comisiones.join(', ')}.`);
      setComisionesInput('');
      setShareSelectedIds(new Set());
      refresh(docente.token);
    } catch {
      setError('No se pudo dejar de compartir el cuestionario.');
    } finally {
      setUnsharing(false);
    }
  }

  return (
    <div className="container" style={{ padding: '40px 24px 96px', maxWidth: 760 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <p className="mono prompt" style={{ color: 'var(--text-dim)', fontSize: '0.82rem', marginBottom: 10 }}>
            quizzes --manage
          </p>
          <h1>Cuestionarios</h1>
        </div>
        <Link to="/docente/cuestionarios/nuevo" className="btn primary">
          nuevo cuestionario →
        </Link>
      </div>

      {!clearMode && !shareMode && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn danger"
            onClick={enterClearMode}
            style={{ fontSize: '0.78rem', padding: '0.5em 0.9em' }}
          >
            ⟲ limpiar puntaje acumulado…
          </button>
          <button
            type="button"
            className="btn"
            onClick={enterShareMode}
            style={{ fontSize: '0.78rem', padding: '0.5em 0.9em' }}
          >
            ⇪ compartir a alumnos…
          </button>
        </div>
      )}

      {shareSuccess && !shareMode && (
        <p className="mono" style={{ color: 'var(--ok)', fontSize: '0.78rem', marginBottom: 20 }}>
          <span className="status-dot ok" />
          {shareSuccess}
        </p>
      )}

      {shareMode && (
        <div
          className="panel"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            padding: '14px 16px',
            marginBottom: 20,
            borderColor: 'var(--accent)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <p className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
              elegí los cuestionarios a compartir · {shareSelectedIds.size} seleccionado{shareSelectedIds.size === 1 ? '' : 's'}
            </p>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button
                type="button"
                className="mono"
                onClick={selectAllShare}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.78rem' }}
              >
                todos
              </button>
              <button
                type="button"
                className="mono"
                onClick={selectNoneShare}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.78rem' }}
              >
                ninguno
              </button>
              <button
                type="button"
                className="mono"
                onClick={cancelShareMode}
                disabled={sharing}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.78rem' }}
              >
                cancelar
              </button>
            </div>
          </div>

          {shareSelectedIds.size > 0 && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                value={comisionesInput}
                onChange={(e) => setComisionesInput(e.target.value)}
                placeholder="comisiones separadas por coma"
                className="mono"
                style={{
                  flex: 1,
                  minWidth: 220,
                  background: 'var(--bg-inset)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 3,
                  padding: '0.6em 0.8em',
                  color: 'var(--text)',
                  fontSize: '0.85rem',
                }}
              />
              <button
                type="button"
                className="btn"
                onClick={handleUnshare}
                disabled={unsharing || sharing || !comisionesInput.trim()}
                style={{ fontSize: '0.78rem', padding: '0.55em 0.9em' }}
              >
                {unsharing ? 'quitando…' : `dejar de compartir (${shareSelectedIds.size}) →`}
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={handleShare}
                disabled={sharing || unsharing || !comisionesInput.trim()}
                style={{ fontSize: '0.78rem', padding: '0.55em 0.9em' }}
              >
                {sharing ? 'compartiendo…' : `compartir (${shareSelectedIds.size}) →`}
              </button>
            </div>
          )}
        </div>
      )}

      {clearMode && (
        <div
          className="panel"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '10px 14px',
            marginBottom: 20,
            borderColor: 'var(--danger)',
            flexWrap: 'wrap',
          }}
        >
          <p className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
            elegí los cuestionarios a limpiar · {selectedIds.size} seleccionado{selectedIds.size === 1 ? '' : 's'}
          </p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              type="button"
              className="mono"
              onClick={selectAll}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.78rem' }}
            >
              todos
            </button>
            <button
              type="button"
              className="mono"
              onClick={selectNone}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.78rem' }}
            >
              ninguno
            </button>
            <button
              type="button"
              className="mono"
              onClick={cancelClearMode}
              disabled={clearing}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.78rem' }}
            >
              cancelar
            </button>
            <button
              type="button"
              className="btn danger"
              onClick={handleClearHistory}
              disabled={clearing || selectedIds.size === 0}
              style={{ fontSize: '0.78rem', padding: '0.45em 0.8em' }}
            >
              {clearing ? 'limpiando…' : `limpiar (${selectedIds.size}) →`}
            </button>
          </div>
        </div>
      )}

      {loading && <p className="mono cursor">cargando cuestionarios</p>}

      {!loading && quizzes.length === 0 && (
        <p className="mono" style={{ color: 'var(--text-dim)' }}>
          Todavía no hay cuestionarios guardados.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {quizzes.map((quiz) => {
          const mine = quiz.host === docente.username;
          const canShareComisiones = mine || quiz.shared_with.includes(docente.username);
          const busy = busyId === quiz.id;
          const selected = selectedIds.has(quiz.id);
          const shareSelected = shareSelectedIds.has(quiz.id);
          const selectableForShare = shareMode && canShareComisiones;
          return (
            <div
              key={quiz.id}
              className="panel"
              style={{
                padding: '14px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 16,
                borderColor: (clearMode && selected) || (selectableForShare && shareSelected) ? (clearMode ? 'var(--danger)' : 'var(--accent)') : undefined,
                cursor: clearMode || selectableForShare ? 'pointer' : undefined,
                opacity: shareMode && !canShareComisiones ? 0.5 : 1,
              }}
              onClick={
                clearMode
                  ? () => toggleSelected(quiz.id)
                  : selectableForShare
                    ? () => toggleShareSelected(quiz.id)
                    : undefined
              }
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                {clearMode && (
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleSelected(quiz.id)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ flexShrink: 0, width: 16, height: 16, accentColor: 'var(--danger)' }}
                  />
                )}
                {shareMode && (
                  <input
                    type="checkbox"
                    checked={shareSelected}
                    disabled={!canShareComisiones}
                    onChange={() => toggleShareSelected(quiz.id)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ flexShrink: 0, width: 16, height: 16, accentColor: 'var(--accent)' }}
                  />
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <p style={{ color: 'var(--text)' }}>{quiz.title}</p>
                    {!mine && (
                      <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                        de {quiz.host}
                      </span>
                    )}
                  </div>
                  <p className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: 4 }}>
                    {quiz.question_count} pregunta{quiz.question_count === 1 ? '' : 's'}
                  </p>
                  {mine && quiz.shared_with.length > 0 && (
                    <p className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: 2 }}>
                      compartido con: {quiz.shared_with.join(', ')}
                    </p>
                  )}
                  {canShareComisiones && quiz.shared_with_comisiones.length > 0 && (
                    <p className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: 2 }}>
                      compartido con {quiz.shared_with_comisiones.length === 1 ? 'la comisión' : 'las comisiones'}:{' '}
                      {quiz.shared_with_comisiones.join(', ')}
                    </p>
                  )}
                </div>
              </div>
              {!clearMode && !shareMode && (
                <div style={{ display: 'flex', gap: 14, flexShrink: 0, alignItems: 'center' }}>
                  <Link
                    to={`/docente/cuestionarios/${quiz.id}/leaderboard`}
                    className="mono"
                    style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}
                  >
                    leaderboard →
                  </Link>
                  {mine && (
                    <Link
                      to={`/docente/cuestionarios/${quiz.id}/editar`}
                      className="mono"
                      style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}
                    >
                      editar →
                    </Link>
                  )}
                  <button
                    type="button"
                    className="mono"
                    disabled={busy}
                    onClick={() => handleStart(quiz)}
                    style={{ background: 'none', border: 'none', color: 'var(--accent-strong)', cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    iniciar cuestionario →
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <p className="mono" style={{ color: 'var(--danger)', fontSize: '0.82rem', marginTop: 16 }}>
          <span className="status-dot danger" />
          {error}
        </p>
      )}
    </div>
  );
}
