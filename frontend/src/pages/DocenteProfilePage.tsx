import { Link } from 'react-router-dom';
import { useDocente } from '../context/DocenteContext';
import { Avatar, AvatarPicker } from '../components/Avatar';

export function DocenteProfilePage() {
  const { docente, setAvatar, setTheme } = useDocente();

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
      </div>
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
