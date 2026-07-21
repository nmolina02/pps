import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDocente } from '../context/DocenteContext';
import { Avatar, AvatarPicker } from '../components/Avatar';
import { changePassword } from '../api/docente';
import { ApiError } from '../api/client';

const fieldStyle: React.CSSProperties = {
  background: 'var(--bg-inset)',
  border: '1px solid var(--border-strong)',
  borderRadius: 3,
  padding: '0.6em 0.8em',
  color: 'var(--text)',
  fontSize: '0.9rem',
  width: '100%',
  maxWidth: 320,
};

export function DocenteProfilePage() {
  const { docente, setAvatar, setTheme, logout } = useDocente();
  const navigate = useNavigate();

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
    <div className="container" style={{ padding: '48px 24px 72px', maxWidth: 640 }}>
      <p className="mono prompt" style={{ color: 'var(--text-dim)', fontSize: '0.82rem', marginBottom: 10 }}>
        whoami --role docente
      </p>
      <h1 className="cursor" style={{ marginBottom: 32 }}>
        Perfil docente
      </h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div className="panel" style={{ padding: '22px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <Avatar id={docente.avatar} size={52} selected />
          <div>
            <p style={{ color: 'var(--text)', fontSize: '1.1rem', fontWeight: 600 }}>{docente.username}</p>
            <p className="mono" style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginTop: 2 }}>
              cuenta docente
            </p>
          </div>
        </div>

        <section>
          <h3 style={{ marginBottom: 12 }}>Avatar</h3>
          <AvatarPicker value={docente.avatar} onChange={setAvatar} />
        </section>

        <section>
          <h3 style={{ marginBottom: 12 }}>Apariencia</h3>
          <div className="panel" style={{ padding: 6, display: 'inline-flex', gap: 4 }}>
            <ThemeOption active={docente.theme === 'dark'} onClick={() => setTheme('dark')} label="oscuro" />
            <ThemeOption active={docente.theme === 'light'} onClick={() => setTheme('light')} label="claro" />
          </div>
        </section>

        <section>
          <h3 style={{ marginBottom: 12 }}>Cambiar contraseña</h3>
          <ChangePasswordForm token={docente.token} />
        </section>

        <section>
          <button
            className="btn danger"
            onClick={() => {
              logout();
              navigate('/docente');
            }}
          >
            cerrar sesión
          </button>
        </section>
      </div>
    </div>
  );
}

function ChangePasswordForm({ token }: { token: string }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword.length < 8) {
      setError('La nueva contraseña necesita al menos 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setSubmitting(true);
    try {
      await changePassword(token, { current_password: currentPassword, new_password: newPassword });
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      if (err instanceof ApiError) {
        const firstDetail = Object.values(err.details)[0];
        const detailMessage = Array.isArray(firstDetail) ? firstDetail[0] : firstDetail;
        setError(typeof detailMessage === 'string' ? detailMessage : 'No se pudo cambiar la contraseña.');
      } else {
        setError('No se pudo cambiar la contraseña.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="panel" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 360 }}>
      <label className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-dim)', display: 'flex', flexDirection: 'column', gap: 4 }}>
        contraseña actual
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="mono"
          style={fieldStyle}
          required
        />
      </label>
      <label className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-dim)', display: 'flex', flexDirection: 'column', gap: 4 }}>
        nueva contraseña
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="mono"
          style={fieldStyle}
          required
        />
      </label>
      <label className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-dim)', display: 'flex', flexDirection: 'column', gap: 4 }}>
        confirmar nueva contraseña
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="mono"
          style={fieldStyle}
          required
        />
      </label>

      {error && (
        <p className="mono" style={{ color: 'var(--danger)', fontSize: '0.78rem' }}>
          <span className="status-dot danger" />
          {error}
        </p>
      )}
      {success && (
        <p className="mono" style={{ color: 'var(--ok)', fontSize: '0.78rem' }}>
          <span className="status-dot ok" />
          Contraseña actualizada.
        </p>
      )}

      <button type="submit" className="btn primary" disabled={submitting} style={{ alignSelf: 'flex-start' }}>
        {submitting ? 'guardando…' : 'guardar nueva contraseña'}
      </button>
    </form>
  );
}

function ThemeOption({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mono"
      style={{
        padding: '0.55em 1.1em',
        borderRadius: 3,
        border: 'none',
        background: active ? 'var(--accent)' : 'transparent',
        color: active ? '#16110a' : 'var(--text-muted)',
        fontWeight: active ? 600 : 400,
        fontSize: '0.85rem',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}
