import { defineConfig, devices } from '@playwright/test';

const BACKEND_PORT = 8811;
const FRONTEND_PORT = 5811;
export const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;
export const FRONTEND_URL = `http://127.0.0.1:${FRONTEND_PORT}`;

// En CI no hay venv (backend-ci.yml instala las deps directo con pip en el
// intérprete del runner, igual que ahí) — localmente en Windows sí se usa el
// venv del repo. Elegimos el ejecutable de Python según eso.
const pythonCmd = process.env.CI ? 'python' : '.\\venv\\Scripts\\python.exe';

// e2e corre contra una base sqlite descartable propia (no la de desarrollo
// ni la de `manage.py test`), sembrada por `seed_e2e_data` — así los specs
// no dependen de qué haya cargado el docente en su entorno local.
const backendEnv = {
  DATABASE_URL: 'sqlite:///db.e2e.sqlite3',
  DEBUG: 'True',
  SECRET_KEY: 'e2e-only-secret-key',
  ALLOWED_HOSTS: '127.0.0.1,localhost',
  CORS_ALLOWED_ORIGINS: FRONTEND_URL,
};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: FRONTEND_URL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command:
        `${pythonCmd} manage.py migrate --noinput && ` +
        `${pythonCmd} manage.py seed_e2e_data && ` +
        `${pythonCmd} manage.py runserver ${BACKEND_PORT} --noreload`,
      cwd: '../backend',
      url: `${BACKEND_URL}/api/v1/topics/`,
      env: backendEnv,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      // --host 127.0.0.1 explícito: Vite por default resuelve "localhost" a
      // ::1 (IPv6) en esta máquina, y el healthcheck de Playwright pega
      // contra 127.0.0.1 — sin esto el webServer nunca se considera "listo".
      command: `npm run dev -- --port ${FRONTEND_PORT} --strictPort --host 127.0.0.1`,
      cwd: '.',
      url: FRONTEND_URL,
      env: { VITE_API_BASE_URL: `${BACKEND_URL}/api/v1` },
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
