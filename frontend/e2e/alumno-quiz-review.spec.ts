import { expect, test } from '@playwright/test';
import { BACKEND_URL } from '../playwright.config';

const DOCENTE_USERNAME = 'e2e_docente';
const DOCENTE_PASSWORD = 'e2e-clave-segura-123';
const STUDENT_LEGAJO = 'E2E001';
const COMISION = 'K3054';
const QUIZ_TITLE = 'Quiz e2e — procesos';

test.describe('Alumno: repasar un cuestionario compartido con su comisión', () => {
  test.beforeAll(async ({ request }) => {
    // Se asegura el estado por API en vez de depender de que el spec de
    // "docente comparte" haya corrido antes — cada archivo de e2e queda
    // autocontenido y no le importa el orden de ejecución.
    const tokenResponse = await request.post(`${BACKEND_URL}/api/v1/auth/token/`, {
      data: { username: DOCENTE_USERNAME, password: DOCENTE_PASSWORD },
    });
    expect(tokenResponse.ok()).toBeTruthy();
    const { token } = await tokenResponse.json();

    const quizzesResponse = await request.get(`${BACKEND_URL}/api/v1/docente/quizzes/`, {
      headers: { Authorization: `Token ${token}` },
    });
    const quizzes: { id: number; title: string }[] = await quizzesResponse.json();
    const quiz = quizzes.find((q) => q.title === QUIZ_TITLE);
    expect(quiz, `seed_e2e_data debería haber creado "${QUIZ_TITLE}"`).toBeTruthy();

    const shareResponse = await request.post(`${BACKEND_URL}/api/v1/docente/quizzes/compartir-alumnos/`, {
      headers: { Authorization: `Token ${token}` },
      data: { quiz_ids: [quiz!.id], comisiones: [COMISION] },
    });
    expect(shareResponse.ok()).toBeTruthy();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/perfil');
    await page.getByPlaceholder('legajo').fill(STUDENT_LEGAJO);
    await page.getByRole('button', { name: /entrar/i }).click();
    await expect(page.getByText(`@${STUDENT_LEGAJO}`)).toBeVisible();
  });

  test('ve el cuestionario compartido en su lista de repaso', async ({ page }) => {
    await page.goto('/mis-cuestionarios');
    const row = page.locator('.panel', { hasText: QUIZ_TITLE }).first();
    await expect(row).toBeVisible();
  });

  test('un cuestionario no jugado muestra solo la opción correcta marcada', async ({ page }) => {
    await page.goto('/mis-cuestionarios');
    await page.locator('.panel', { hasText: QUIZ_TITLE }).first().click();

    await expect(page).toHaveURL(/\/mis-cuestionarios\/\d+/);
    await expect(page.getByText('todavía no lo jugaste')).toBeVisible();

    const correctOption = page.getByText('Terminó y el padre no hizo wait()').locator('..');
    await expect(correctOption.getByText('✓ correcta')).toBeVisible();

    const wrongOption = page.getByText('Sigue corriendo en background').locator('..');
    await expect(wrongOption.getByText('✓ correcta')).toHaveCount(0);
    await expect(wrongOption.getByText('marcaste esto')).toHaveCount(0);
  });
});
