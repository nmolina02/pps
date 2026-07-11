import { Link, Outlet, useLocation } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext';
import { useDocente } from '../context/DocenteContext';
import { Avatar } from './Avatar';

export function Layout() {
  const location = useLocation();
  const { profile } = useProfile();
  const { docente } = useDocente();
  const onProfile = location.pathname === '/perfil';
  const onDocenteProfile = location.pathname === '/docente/perfil';
  const onCuestionarios =
    location.pathname.startsWith('/docente/cuestionarios') || location.pathname.startsWith('/docente/sala');
  const onCasosDocente = location.pathname.startsWith('/docente/casos');

  return (
    <>
      <header
        style={{
          borderBottom: '1px solid var(--border)',
          background: 'color-mix(in srgb, var(--bg) 85%, transparent)',
          backdropFilter: 'blur(6px)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div
          className="container"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 62 }}
        >
          <Link to="/" style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span className="mono" style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '1.05rem' }}>
              cafe
            </span>
            <span className="mono" style={{ color: 'var(--text-dim)', fontSize: '0.82rem' }}>
              --portal-so
            </span>
          </Link>
          <nav style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
            <NavLink
              to="/"
              label="casos"
              active={location.pathname === '/' || location.pathname.startsWith('/topics') || location.pathname.startsWith('/cases')}
            />

            {docente ? (
              <>
                <NavLink to="/docente/cuestionarios" label="cuestionarios" active={onCuestionarios} />
                <NavLink to="/docente/casos" label="gestionar casos" active={onCasosDocente} />
                <Link to="/docente/perfil" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Avatar id={docente.avatar} size={28} selected={onDocenteProfile} />
                  <span
                    className="mono"
                    style={{ fontSize: '0.82rem', color: onDocenteProfile ? 'var(--accent-strong)' : 'var(--text-muted)' }}
                  >
                    {onDocenteProfile ? '› ' : ''}
                    {docente.username}
                  </span>
                </Link>
              </>
            ) : (
              <>
                <NavLink to="/jugar" label="jugar" active={location.pathname.startsWith('/jugar')} />
                {!profile && (
                  <NavLink to="/docente" label="docente" active={location.pathname.startsWith('/docente')} />
                )}
                <Link to="/perfil" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {profile ? (
                    <>
                      <Avatar id={profile.avatar} size={28} selected={onProfile} />
                      <span
                        className="mono"
                        style={{ fontSize: '0.82rem', color: onProfile ? 'var(--accent-strong)' : 'var(--text-muted)' }}
                      >
                        {onProfile ? '› ' : ''}
                        {profile.legajo}
                      </span>
                    </>
                  ) : (
                    <span
                      className="mono"
                      style={{ fontSize: '0.85rem', color: onProfile ? 'var(--accent-strong)' : 'var(--text-muted)' }}
                    >
                      {onProfile ? '› ' : ''}alumno
                    </span>
                  )}
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>
      <footer style={{ borderTop: '1px solid var(--border)', padding: '18px 0' }}>
        <div className="container mono" style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
          UTN FRBA · Cátedra de Sistemas Operativos · metodología CAFE
        </div>
      </footer>
    </>
  );
}

function NavLink({ to, label, active }: { to: string; label: string; active: boolean }) {
  return (
    <Link
      to={to}
      className="mono"
      style={{
        fontSize: '0.85rem',
        color: active ? 'var(--accent-strong)' : 'var(--text-muted)',
      }}
    >
      {active ? '› ' : ''}
      {label}
    </Link>
  );
}
