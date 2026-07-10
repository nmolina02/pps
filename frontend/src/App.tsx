import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { TopicsPage } from './pages/TopicsPage';
import { CasesPage } from './pages/CasesPage';
import { CaseDetailPage } from './pages/CaseDetailPage';
import { ProfilePage } from './pages/ProfilePage';
import { JoinPage } from './pages/JoinPage';
import { PlayPage } from './pages/PlayPage';
import { DocenteLoginPage } from './pages/DocenteLoginPage';
import { CreateSessionPage } from './pages/CreateSessionPage';
import { HostDashboardPage } from './pages/HostDashboardPage';
import { DocenteProfilePage } from './pages/DocenteProfilePage';
import { CaseManagePage } from './pages/CaseManagePage';
import { CaseFormPage } from './pages/CaseFormPage';
import { ProfileProvider, useProfile } from './context/ProfileContext';
import { DocenteProvider, useDocente } from './context/DocenteContext';

/** Único punto que escribe el tema activo en el DOM: si hay un docente
 * logueado su tema gana (es la sesión "activa" en ese navegador),
 * si no se usa el del alumno identificado, y si no hay ninguno, oscuro. */
function ThemeSync() {
  const { profile } = useProfile();
  const { docente } = useDocente();

  useEffect(() => {
    const theme = docente?.theme ?? profile?.theme ?? 'dark';
    document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark';
  }, [docente?.theme, profile?.theme]);

  return null;
}

function App() {
  return (
    <ProfileProvider>
      <DocenteProvider>
        <ThemeSync />
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<TopicsPage />} />
              <Route path="/topics/:topicSlug" element={<CasesPage />} />
              <Route path="/cases/:caseSlug" element={<CaseDetailPage />} />
              <Route path="/perfil" element={<ProfilePage />} />
              <Route path="/jugar" element={<JoinPage />} />
              <Route path="/jugar/:code" element={<PlayPage />} />
              <Route path="/docente" element={<DocenteLoginPage />} />
              <Route path="/docente/perfil" element={<DocenteProfilePage />} />
              <Route path="/docente/nueva" element={<CreateSessionPage />} />
              <Route path="/docente/sala/:code" element={<HostDashboardPage />} />
              <Route path="/docente/casos" element={<CaseManagePage />} />
              <Route path="/docente/casos/nuevo" element={<CaseFormPage />} />
              <Route path="/docente/casos/:caseSlug/editar" element={<CaseFormPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </DocenteProvider>
    </ProfileProvider>
  );
}

export default App;
