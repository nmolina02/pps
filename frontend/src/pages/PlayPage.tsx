import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext';
import { getStudentSessionState, joinSession, submitAnswer } from '../api/sessions';
import type { SessionStudentState } from '../api/types';
import { ApiError } from '../api/client';

const POLL_INTERVAL_MS = 2000;

export function PlayPage() {
  const { code = '' } = useParams<{ code: string }>();
  const { profile } = useProfile();

  const [participantId, setParticipantId] = useState<number | null>(null);
  const [state, setState] = useState<SessionStudentState | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [sessionGone, setSessionGone] = useState(false);

  const [selectedOptions, setSelectedOptions] = useState<number[]>([]);
  const [freeText, setFreeText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [displaySeconds, setDisplaySeconds] = useState<number | null>(null);
  const lastOrderRef = useRef<number | null>(null);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    joinSession(code, profile.legajo)
      .then((p) => {
        if (!cancelled) setParticipantId(p.id);
      })
      .catch((err) => {
        if (!cancelled) {
          setFatalError(
            err instanceof ApiError && err.status === 404
              ? 'No existe ninguna sesión activa con ese código.'
              : 'No se pudo unir a la sesión.',
          );
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, profile?.legajo]);

  useEffect(() => {
    if (participantId === null) return;
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval>;

    async function poll() {
      try {
        const data = await getStudentSessionState(code, participantId as number);
        if (cancelled) return;
        setState(data);
        const order = data.current_question?.order ?? null;
        if (order !== lastOrderRef.current) {
          lastOrderRef.current = order;
          setSelectedOptions([]);
          setFreeText('');
          setJustSubmitted(false);
          setSubmitError(null);
        }
        setDisplaySeconds(data.current_question?.time_remaining_seconds ?? null);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          // el docente canceló la sesión: ya no tiene sentido seguir pollendo
          setSessionGone(true);
          clearInterval(intervalId);
        }
        // otros errores: se reintenta en el próximo ciclo de polling
      }
    }

    poll();
    intervalId = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [code, participantId]);

  useEffect(() => {
    const id = setInterval(() => {
      setDisplaySeconds((s) => (s !== null && s > 0 ? s - 1 : s));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  if (!profile) {
    return (
      <Centered>
        <p style={{ marginBottom: 14 }}>Primero identificate con tu legajo para poder jugar.</p>
        <Link to="/perfil" className="btn primary">
          ir a mi perfil →
        </Link>
      </Centered>
    );
  }

  if (fatalError) {
    return (
      <Centered>
        <p className="mono" style={{ color: 'var(--danger)' }}>
          <span className="status-dot danger" />
          {fatalError}
        </p>
      </Centered>
    );
  }

  if (sessionGone) {
    return (
      <Centered>
        <p className="mono" style={{ color: 'var(--danger)', marginBottom: 18 }}>
          <span className="status-dot danger" />
          El docente canceló la sesión.
        </p>
        <Link to="/jugar" className="btn primary">
          salir →
        </Link>
      </Centered>
    );
  }

  if (!state) {
    return (
      <Centered>
        <p className="mono cursor">conectando con la sesión {code}</p>
      </Centered>
    );
  }

  if (state.session.status === 'finished') {
    return (
      <Centered>
        <span className="chip ok" style={{ marginBottom: 14 }}>
          sesión finalizada
        </span>
        <h2 style={{ marginBottom: 10 }}>Gracias por participar</h2>
        <p style={{ marginBottom: 18 }}>Tu docente puede compartir los resultados en clase.</p>
        <Link to="/jugar" className="btn primary">
          salir →
        </Link>
      </Centered>
    );
  }

  const q = state.current_question;

  if (!q) {
    return (
      <Centered>
        <p className="mono" style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginBottom: 8 }}>
          sala {state.session.code}
          {state.session.quiz_title ? ` · ${state.session.quiz_title}` : ''}
        </p>
        <p className="mono cursor" style={{ fontSize: '1.1rem' }}>
          esperando a que el docente inicie la primera pregunta
        </p>
      </Centered>
    );
  }

  async function handleSubmit() {
    if (participantId === null || !q) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitAnswer(code, q.order, {
        participant_id: participantId,
        option_ids: selectedOptions.length ? selectedOptions : undefined,
        free_text: freeText.trim() || undefined,
      });
      setJustSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'No se pudo enviar la respuesta.');
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    q.question.question_type === 'fill_blank' ? freeText.trim().length > 0 : selectedOptions.length > 0;

  return (
    <div className="container" style={{ padding: '40px 24px 72px', maxWidth: 640 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <p className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
          pregunta {String(q.order).padStart(2, '0')} · {q.question.question_type === 'survey' ? 'encuesta' : `${q.points} pts`}
        </p>
        {!q.revealed && (
          <span className="mono" style={{ fontSize: '1.3rem', color: displaySeconds !== null && displaySeconds <= 5 ? 'var(--danger)' : 'var(--accent)' }}>
            {displaySeconds ?? '—'}s
          </span>
        )}
      </div>

      <h2 style={{ marginBottom: 20, whiteSpace: 'pre-wrap' }}>{q.question.text}</h2>

      {!q.revealed && !q.has_answered && !justSubmitted && q.accepts_answers && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {q.question.question_type === 'fill_blank' ? (
            <input
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder="tu respuesta"
              className="mono"
              style={{
                background: 'var(--bg-inset)',
                border: '1px solid var(--border-strong)',
                borderRadius: 3,
                padding: '0.75em 1em',
                color: 'var(--text)',
                fontSize: '1rem',
              }}
            />
          ) : q.question.options.some((opt) => opt.image) ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {q.question.options.map((opt) => {
                const isMulti = q.question.question_type === 'multiple_choice';
                const checked = selectedOptions.includes(opt.id);
                return (
                  <label
                    key={opt.id}
                    className="panel"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden',
                      padding: 0,
                      cursor: 'pointer',
                      borderColor: checked ? 'var(--accent)' : 'var(--border)',
                      boxShadow: checked ? '0 0 0 2px var(--accent)' : 'none',
                      background: checked ? 'var(--accent-soft)' : 'var(--bg-panel)',
                    }}
                  >
                    <input
                      type={isMulti ? 'checkbox' : 'radio'}
                      name="answer"
                      checked={checked}
                      onChange={() => {
                        setSelectedOptions((prev) =>
                          isMulti
                            ? checked
                              ? prev.filter((id) => id !== opt.id)
                              : [...prev, opt.id]
                            : [opt.id],
                        );
                      }}
                      style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
                    />
                    <div style={{ position: 'relative', width: '100%', height: 150, background: 'var(--bg-inset)' }}>
                      {opt.image ? (
                        <img src={opt.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span className="mono" style={{ color: 'var(--text-dim)', fontSize: '0.78rem' }}>sin imagen</span>
                        </div>
                      )}
                      {checked && (
                        <span
                          className="mono"
                          style={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            width: 26,
                            height: 26,
                            borderRadius: '50%',
                            background: 'var(--accent)',
                            color: '#16110a',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                          }}
                        >
                          ✓
                        </span>
                      )}
                    </div>
                    {opt.text && (
                      <span style={{ color: 'var(--text)', padding: '10px 12px' }}>{opt.text}</span>
                    )}
                  </label>
                );
              })}
            </div>
          ) : (
            q.question.options.map((opt) => {
              const isMulti = q.question.question_type === 'multiple_choice';
              const checked = selectedOptions.includes(opt.id);
              return (
                <label
                  key={opt.id}
                  className="panel"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '14px 16px',
                    cursor: 'pointer',
                    borderColor: checked ? 'var(--accent)' : 'var(--border)',
                    background: checked ? 'var(--accent-soft)' : 'var(--bg-panel)',
                  }}
                >
                  <input
                    type={isMulti ? 'checkbox' : 'radio'}
                    name="answer"
                    checked={checked}
                    onChange={() => {
                      setSelectedOptions((prev) =>
                        isMulti
                          ? checked
                            ? prev.filter((id) => id !== opt.id)
                            : [...prev, opt.id]
                          : [opt.id],
                      );
                    }}
                  />
                  <span style={{ color: 'var(--text)' }}>{opt.text}</span>
                </label>
              );
            })
          )}

          <button
            className="btn primary"
            style={{ marginTop: 8, alignSelf: 'flex-start' }}
            disabled={!canSubmit || submitting}
            onClick={handleSubmit}
          >
            {submitting ? 'enviando…' : 'responder →'}
          </button>
          {submitError && (
            <p className="mono" style={{ color: 'var(--danger)', fontSize: '0.82rem' }}>
              <span className="status-dot danger" />
              {submitError}
            </p>
          )}
        </div>
      )}

      {!q.revealed && !q.has_answered && !justSubmitted && !q.accepts_answers && (
        <StatusMessage tone="danger" text="Se acabó el tiempo para esta pregunta." />
      )}

      {!q.revealed && (q.has_answered || justSubmitted) && (
        <StatusMessage tone="warn" text="Respuesta enviada · esperando a que se revele el resultado" />
      )}

      {q.revealed && (
        <div>
          {q.your_result && q.question.question_type !== 'survey' && (
            <StatusMessage
              tone={q.your_result.is_correct ? 'ok' : 'warn'}
              text={
                q.your_result.is_correct
                  ? `¡Correcto! +${q.your_result.score} pts`
                  : `Tu respuesta sumó +${q.your_result.score} pts`
              }
            />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
            {(q.tally ?? []).map((row, i) => {
              const isCorrect = row.id !== undefined && q.correct_option_ids?.includes(row.id);
              const maxVotes = Math.max(1, ...(q.tally ?? []).map((r) => r.votes));
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
                  <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="mono" style={{ color: isCorrect ? 'var(--ok)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      {row.image && (
                        <img src={row.image} alt="" style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 3 }} />
                      )}
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
          {q.justification && (
            <p style={{ marginTop: 16, color: 'var(--text-muted)', fontSize: '0.92rem', whiteSpace: 'pre-wrap' }}>{q.justification}</p>
          )}
          <p className="mono cursor" style={{ marginTop: 20, color: 'var(--text-dim)' }}>
            esperando la próxima pregunta
          </p>
        </div>
      )}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="container"
      style={{ padding: '80px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}
    >
      {children}
    </div>
  );
}

function StatusMessage({ tone, text }: { tone: 'ok' | 'warn' | 'danger'; text: string }) {
  const colorVar = tone === 'ok' ? 'var(--ok)' : tone === 'warn' ? 'var(--accent)' : 'var(--danger)';
  return (
    <p className="mono" style={{ color: colorVar }}>
      <span className={`status-dot ${tone}`} />
      {text}
    </p>
  );
}
