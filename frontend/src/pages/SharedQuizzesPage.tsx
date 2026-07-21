import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext';
import { listSharedQuizzes } from '../api/students';
import type { SharedQuizListItem } from '../api/types';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Cuestionarios que el docente compartió con la comisión del alumno, para
 * repasar antes del examen — jugados o no (ver SharedQuizReviewPage). */
export function SharedQuizzesPage() {
  const { profile } = useProfile();
  const [quizzes, setQuizzes] = useState<SharedQuizListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    listSharedQuizzes(profile.legajo)
      .then(setQuizzes)
      .catch(() => setError('No se pudieron cargar los cuestionarios compartidos.'));
  }, [profile?.legajo]);

  if (!profile) {
    return (
      <div className="container" style={{ padding: '48px 24px 72px', maxWidth: 640 }}>
        <p className="mono prompt" style={{ color: 'var(--text-dim)', fontSize: '0.82rem', marginBottom: 10 }}>
          review --shared
        </p>
        <h1 className="cursor" style={{ marginBottom: 32 }}>
          Cuestionarios compartidos
        </h1>
        <div className="panel" style={{ padding: '22px 24px' }}>
          <p style={{ color: 'var(--text)', marginBottom: 14 }}>
            Primero identificate con tu legajo para poder ver tus cuestionarios.
          </p>
          <Link to="/perfil" className="btn primary" style={{ display: 'inline-block' }}>
            ir a mi perfil →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '48px 24px 72px', maxWidth: 640 }}>
      <p className="mono prompt" style={{ color: 'var(--text-dim)', fontSize: '0.82rem', marginBottom: 10 }}>
        review --shared
      </p>
      <h1 className="cursor" style={{ marginBottom: 12 }}>
        Cuestionarios compartidos
      </h1>
      <p style={{ maxWidth: 560, marginBottom: 32 }}>
        Cuestionarios que tu docente compartió con tu comisión para repasar. Si ya lo jugaste, vas a ver
        qué marcaste en su momento; si no, solo las respuestas correctas.
      </p>

      {error && (
        <p className="mono" style={{ color: 'var(--danger)', fontSize: '0.82rem', marginBottom: 16 }}>
          <span className="status-dot danger" />
          {error}
        </p>
      )}

      {!quizzes && !error && <p className="mono cursor">cargando</p>}

      {quizzes && quizzes.length === 0 && (
        <p className="mono" style={{ color: 'var(--text-dim)' }}>
          Todavía no hay cuestionarios compartidos con tu comisión.
        </p>
      )}

      {quizzes && quizzes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {quizzes.map((quiz) => (
            <Link key={quiz.id} to={`/mis-cuestionarios/${quiz.id}`}>
              <div
                className="panel"
                style={{
                  padding: '14px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 16,
                  transition: 'border-color .15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <span className={`status-dot ${quiz.played ? 'ok' : 'warn'}`} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ color: 'var(--text)' }}>{quiz.title}</p>
                    <p className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: 2 }}>
                      {quiz.host} · {quiz.question_count} pregunta{quiz.question_count === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {quiz.played ? (
                    <>
                      <p className="mono" style={{ color: 'var(--ok)', fontSize: '0.85rem' }}>
                        {quiz.total_score} pts
                      </p>
                      <p className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                        jugado {quiz.played_at ? formatDate(quiz.played_at) : ''}
                      </p>
                    </>
                  ) : (
                    <p className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                      no jugado
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
