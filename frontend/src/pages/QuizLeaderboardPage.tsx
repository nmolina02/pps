import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useDocente } from '../context/DocenteContext';
import { getQuizLeaderboard } from '../api/docente';
import type { QuizLeaderboardRow } from '../api/types';

export function QuizLeaderboardPage() {
  const { quizId = '' } = useParams<{ quizId: string }>();
  const { docente } = useDocente();
  const [rows, setRows] = useState<QuizLeaderboardRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!docente) return;
    getQuizLeaderboard(docente.token, Number(quizId))
      .then(setRows)
      .catch(() => setError('No se pudo cargar el leaderboard.'));
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

  return (
    <div className="container" style={{ padding: '40px 24px 96px', maxWidth: 760 }}>
      <p className="mono prompt" style={{ color: 'var(--text-dim)', fontSize: '0.82rem', marginBottom: 10 }}>
        quizzes --leaderboard
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <h1>Leaderboard</h1>
        <Link to="/docente/cuestionarios" className="mono" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          ← volver
        </Link>
      </div>

      {error && (
        <p className="mono" style={{ color: 'var(--danger)', fontSize: '0.82rem', marginBottom: 16 }}>
          <span className="status-dot danger" />
          {error}
        </p>
      )}

      {!rows && !error && <p className="mono cursor">cargando leaderboard</p>}

      {rows && rows.length === 0 && (
        <p className="mono" style={{ color: 'var(--text-dim)' }}>
          Todavía no hay puntaje acumulado para este cuestionario — o se limpió el historial. Se
          va a poder consultar de nuevo apenas se juegue una sesión con puntajes.
        </p>
      )}

      {rows && rows.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rows.map((row, i) => (
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
                <span className="mono" style={{ color: 'var(--text-dim)', marginLeft: 10, fontSize: '0.78rem' }}>
                  {row.sessions_played} sesión{row.sessions_played === 1 ? '' : 'es'}
                </span>
              </span>
              <span className="mono" style={{ color: 'var(--accent-strong)' }}>
                {row.total_score} pts
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
