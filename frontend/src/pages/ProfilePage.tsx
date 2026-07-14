import { useState, type FormEvent } from 'react';
import { useProfile } from '../context/ProfileContext';
import { Avatar, AvatarPicker } from '../components/Avatar';
import { ApiError } from '../api/client';

export function ProfilePage() {
  const { profile } = useProfile();
  return (
    <div className="container" style={{ padding: '48px 24px 72px', maxWidth: 640 }}>
      <p className="mono prompt" style={{ color: 'var(--text-dim)', fontSize: '0.82rem', marginBottom: 10 }}>
        whoami
      </p>
      <h1 className="cursor" style={{ marginBottom: 32 }}>
        Perfil
      </h1>
      {profile ? <IdentifiedProfile /> : <IdentifyForm />}
    </div>
  );
}

function IdentifyForm() {
  const { identify } = useProfile();
  const [legajo, setLegajo] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!legajo.trim()) return;
    setStatus('loading');
    try {
      await identify(legajo.trim());
      setStatus('idle');
    } catch (err) {
      setStatus('error');
      setErrorMessage(
        err instanceof ApiError && err.status === 404
          ? 'Ese legajo no está registrado. Pedile al docente que cargue tu perfil.'
          : 'No se pudo verificar el legajo. Probá de nuevo.',
      );
    }
  }

  return (
    <div className="panel panel-corners" style={{ padding: '26px 24px' }}>
      <p style={{ color: 'var(--text)', marginBottom: 20 }}>Ingresá tu legajo para identificarte.</p>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 10 }}>
        <input
          value={legajo}
          onChange={(e) => setLegajo(e.target.value)}
          placeholder="legajo"
          className="mono"
          style={{
            flex: 1,
            background: 'var(--bg-inset)',
            border: '1px solid var(--border-strong)',
            borderRadius: 3,
            padding: '0.65em 0.9em',
            color: 'var(--text)',
            fontSize: '0.9rem',
          }}
        />
        <button type="submit" className="btn primary" disabled={status === 'loading'}>
          {status === 'loading' ? 'verificando…' : 'entrar →'}
        </button>
      </form>
      {status === 'error' && (
        <p className="mono" style={{ color: 'var(--danger)', fontSize: '0.82rem', marginTop: 14 }}>
          <span className="status-dot danger" />
          {errorMessage}
        </p>
      )}
    </div>
  );
}

function IdentifiedProfile() {
  const { profile, setAvatar, setTheme, forget } = useProfile();
  if (!profile) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="panel" style={{ padding: '22px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <Avatar id={profile.avatar} size={52} selected />
        <div>
          <p style={{ color: 'var(--text)', fontSize: '1.1rem', fontWeight: 600 }}>{profile.fullName}</p>
          <p className="mono" style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginTop: 2 }}>
            @{profile.legajo}
          </p>
        </div>
      </div>

      <section>
        <h3 style={{ marginBottom: 12 }}>Avatar</h3>
        <AvatarPicker value={profile.avatar} onChange={setAvatar} />
      </section>

      <section>
        <h3 style={{ marginBottom: 12 }}>Apariencia</h3>
        <div className="panel" style={{ padding: 6, display: 'inline-flex', gap: 4 }}>
          <ThemeOption active={profile.theme === 'dark'} onClick={() => setTheme('dark')} label="oscuro" />
          <ThemeOption active={profile.theme === 'light'} onClick={() => setTheme('light')} label="claro" />
        </div>
      </section>

      <section>
        <button className="btn danger" onClick={forget}>
          cerrar sesión
        </button>
      </section>
    </div>
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
