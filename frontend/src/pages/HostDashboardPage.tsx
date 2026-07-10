import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useDocente } from '../context/DocenteContext';
import { finishSession, getHostState, getSessionQuestions, revealQuestion, startQuestion } from '../api/host';
import type { SessionHostState, SessionQuestionProgress } from '../api/types';

const HOST_POLL_INTERVAL_MS = 1000;

export function HostDashboardPage() {
  const { code = '' } = useParams<{ code: string }>();
  const { docente } = useDocente();

  const [state, setState] = useState<SessionHostState | null>(null);
  const [progress, setProgress] = useState<SessionQuestionProgress[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshProgress = useCallback(() => {
    if (!docente) return;
    getSessionQuestions(docente.token, code)
      .then(setProgress)
      .catch(() => undefined);
  }, [docente, code]);

  useEffect(() => {
    refreshProgress();
  }, [refreshProgress]);

  useEffect(() => {
    if (!docente) return;
    let cancelled = false;
    async function poll() {
      try {
        const data = await getHostState(docente!.token, code);
        if (!cancelled) setState(data);
      } catch {
        // se reintenta en el próximo ciclo
      }
    }
    poll();
    const id = setInterval(poll, HOST_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [docente, code]);

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

  if (!state) {
    return (
      <div className="container" style={{ padding: '80px 24px', textAlign: 'center' }}>
        <p className="mono cursor">cargando sala {code}</p>
      </div>
    );
  }

  const nextQuestion = progress.find((p) => p.started_at === null);
  const current = state.current_question;

  async function withBusy(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      refreshProgress();
    } catch {
      setError('La acción falló. Probá de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container" style={{ padding: '32px 24px 96px', maxWidth: 880 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <p className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
            {state.session.topic.name} · {state.participant_count} conectados
          </p>
          <h1 className="mono" style={{ fontSize: '2.4rem', letterSpacing: '0.12em', color: 'var(--accent)' }}>
            {state.session.code}
          </h1>
        </div>
        <span className={`chip ${state.session.status === 'finished' ? 'ok' : 'accent'}`}>{state.session.status}</span>
      </div>

      <ProgressRail progress={progress} currentOrder={current?.order ?? null} />

      {state.session.status === 'finished' ? (
        <div className="panel" style={{ padding: '22px 24px', marginTop: 24 }}>
          <p style={{ color: 'var(--text)' }}>Sesión finalizada.</p>
        </div>
      ) : (
        <div className="panel panel-corners" style={{ padding: '22px 24px', marginTop: 24 }}>
          {current ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <p className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                  pregunta {current.order} · {current.points} pts · {current.answers_received}/{state.participant_count} respondieron
                </p>
                {!current.revealed && (
                  <span className="mono" style={{ color: 'var(--accent)' }}>
                    {current.time_remaining_seconds ?? '—'}s
                  </span>
                )}
              </div>
              <h2 style={{ marginBottom: 16 }}>{current.question.text}</h2>
              <TallyBars tally={current.tally} options={current.question.options} />
            </>
          ) : (
            <p className="mono" style={{ color: 'var(--text-dim)' }}>Todavía no arrancó ninguna pregunta.</p>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            {current && !current.revealed && (
              <button
                className="btn primary"
                disabled={busy}
                onClick={() => withBusy(() => revealQuestion(docente.token, code, current.order))}
              >
                revelar resultado →
              </button>
            )}
            {(!current || current.revealed) && nextQuestion && (
              <button
                className="btn primary"
                disabled={busy}
                onClick={() => withBusy(() => startQuestion(docente.token, code, nextQuestion.order))}
              >
                iniciar pregunta {nextQuestion.order} →
              </button>
            )}
            {(!current || current.revealed) && !nextQuestion && (
              <button
                className="btn"
                style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
                disabled={busy}
                onClick={() => withBusy(() => finishSession(docente.token, code))}
              >
                finalizar sesión
              </button>
            )}
          </div>
          {error && (
            <p className="mono" style={{ color: 'var(--danger)', fontSize: '0.82rem', marginTop: 12 }}>
              <span className="status-dot danger" />
              {error}
            </p>
          )}
        </div>
      )}

      <section style={{ marginTop: 28 }}>
        <h3 style={{ marginBottom: 12 }}>Leaderboard</h3>
        {state.leaderboard.length === 0 ? (
          <p className="mono" style={{ color: 'var(--text-dim)' }}>
            Todavía no hay participantes.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {state.leaderboard.map((row, i) => (
              <div
                key={row.legajo}
                className="panel"
                style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span style={{ color: 'var(--text)' }}>
                  <span className="mono" style={{ color: 'var(--text-dim)', marginRight: 10 }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {row.full_name}
                </span>
                <span className="mono" style={{ color: 'var(--accent-strong)' }}>
                  {row.total_score} pts
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ProgressRail({ progress, currentOrder }: { progress: SessionQuestionProgress[]; currentOrder: number | null }) {
  if (progress.length === 0) return null;
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {progress.map((p) => {
        const done = p.revealed_at !== null;
        const isCurrent = p.order === currentOrder;
        return (
          <div
            key={p.order}
            className="mono"
            title={p.question.text}
            style={{
              flex: 1,
              textAlign: 'center',
              padding: '6px 0',
              fontSize: '0.72rem',
              borderRadius: 3,
              border: `1px solid ${done ? 'var(--ok)' : isCurrent ? 'var(--accent)' : 'var(--border)'}`,
              background: done ? 'var(--ok-soft)' : isCurrent ? 'var(--accent-soft)' : 'transparent',
              color: done ? 'var(--ok)' : isCurrent ? 'var(--accent-strong)' : 'var(--text-dim)',
            }}
          >
            {p.order}
          </div>
        );
      })}
    </div>
  );
}

function TallyBars({
  tally,
  options,
}: {
  tally: { id?: number; text: string; votes: number }[];
  options: { id: number; text: string; is_correct: boolean }[];
}) {
  const maxVotes = Math.max(1, ...tally.map((r) => r.votes));
  const correctIds = new Set(options.filter((o) => o.is_correct).map((o) => o.id));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {tally.map((row, i) => {
        const isCorrect = row.id !== undefined && correctIds.has(row.id);
        return (
          <div key={row.id ?? i} className="panel" style={{ padding: '10px 14px', position: 'relative', overflow: 'hidden' }}>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                width: `${(row.votes / maxVotes) * 100}%`,
                background: isCorrect ? 'var(--ok-soft)' : 'var(--bg-inset)',
                transition: 'width .3s ease',
              }}
            />
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between' }}>
              <span className="mono" style={{ color: isCorrect ? 'var(--ok)' : 'var(--text-muted)' }}>
                {isCorrect ? '✓ ' : ''}
                {row.text}
              </span>
              <span className="mono" style={{ color: 'var(--text-dim)' }}>
                {row.votes}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
