import { Link, Outlet, useLocation } from 'react-router-dom';

export function Layout() {
  const location = useLocation();

  return (
    <>
      <header
        style={{
          borderBottom: '1px solid var(--border)',
          background: 'rgba(11, 14, 17, 0.85)',
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
          <nav style={{ display: 'flex', gap: 22 }}>
            <NavLink to="/" label="casos" active={location.pathname === '/' || location.pathname.startsWith('/topics')} />
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
