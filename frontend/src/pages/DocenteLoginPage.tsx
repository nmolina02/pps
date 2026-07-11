import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useDocente } from '../context/DocenteContext';
import { ApiError } from '../api/client';

export function DocenteLoginPage() {
  const { docente, login } = useDocente();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  if (docente) {
    return <Navigate to="/docente/cuestionarios" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus('loading');
    try {
      await login(username, password);
      navigate('/docente/cuestionarios');
    } catch (err) {
      setStatus('error');
      setErrorMessage(
        err instanceof ApiError && err.status === 400
          ? 'Usuario o contraseña incorrectos.'
          : 'No se pudo iniciar sesión.',
      );
    }
  }

  return (
    <div className="container" style={{ padding: '48px 24px 72px', maxWidth: 420 }}>
      <p className="mono prompt" style={{ color: 'var(--text-dim)', fontSize: '0.82rem', marginBottom: 10 }}>
        auth --role docente
      </p>
      <h1 className="cursor" style={{ marginBottom: 32 }}>
        Panel docente
      </h1>
      <form onSubmit={handleSubmit} className="panel panel-corners" style={{ padding: '26px 24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="usuario"
            className="mono"
            style={inputStyle}
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="contraseña"
            className="mono"
            style={inputStyle}
          />
          <button type="submit" className="btn primary" disabled={status === 'loading'}>
            {status === 'loading' ? 'ingresando…' : 'ingresar →'}
          </button>
        </div>
        {status === 'error' && (
          <p className="mono" style={{ color: 'var(--danger)', fontSize: '0.82rem', marginTop: 14 }}>
            <span className="status-dot danger" />
            {errorMessage}
          </p>
        )}
      </form>
    </div>
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
