import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext';
import { joinSession } from '../api/sessions';
import { ApiError } from '../api/client';

export function JoinPage() {
  const { profile } = useProfile();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!profile || !code.trim()) return;
    setStatus('loading');
    try {
      await joinSession(code.trim().toUpperCase(), profile.legajo);
      navigate(`/jugar/${code.trim().toUpperCase()}`);
    } catch (err) {
      setStatus('error');
      setErrorMessage(
        err instanceof ApiError && err.status === 404
          ? 'No existe ninguna sesión activa con ese código.'
          : 'No se pudo unir a la sesión. Probá de nuevo.',
      );
    }
  }

  return (
    <div className="container" style={{ padding: '48px 24px 72px', maxWidth: 520 }}>
      <p className="mono prompt" style={{ color: 'var(--text-dim)', fontSize: '0.82rem', marginBottom: 10 }}>
        connect --session
      </p>
      <h1 className="cursor" style={{ marginBottom: 32 }}>
        Unirse a un cuestionario
      </h1>

      {!profile ? (
        <div className="panel" style={{ padding: '22px 24px' }}>
          <p style={{ color: 'var(--text)', marginBottom: 14 }}>
            Primero identificate con tu legajo para poder jugar.
          </p>
          <Link to="/perfil" className="btn primary" style={{ display: 'inline-block' }}>
            ir a mi perfil →
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="panel panel-corners" style={{ padding: '26px 24px' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: 16 }}>
            Jugando como <strong style={{ color: 'var(--text)' }}>{profile.fullName}</strong>
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="código de sesión"
              autoCapitalize="characters"
              className="mono"
              style={{
                flex: 1,
                background: 'var(--bg-inset)',
                border: '1px solid var(--border-strong)',
                borderRadius: 3,
                padding: '0.65em 0.9em',
                color: 'var(--text)',
                fontSize: '1rem',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            />
            <button type="submit" className="btn primary" disabled={status === 'loading'}>
              {status === 'loading' ? 'entrando…' : 'jugar →'}
            </button>
          </div>
          {status === 'error' && (
            <p className="mono" style={{ color: 'var(--danger)', fontSize: '0.82rem', marginTop: 14 }}>
              <span className="status-dot danger" />
              {errorMessage}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
