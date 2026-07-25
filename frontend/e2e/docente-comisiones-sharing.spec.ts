import { expect, test } from '@playwright/test';

const DOCENTE_USERNAME = 'e2e_docente';
const DOCENTE_PASSWORD = 'e2e-clave-segura-123';
const COMISION = 'K3054';
const QUIZ_TITLE = 'Quiz e2e — procesos';
const SHARED_LABEL = new RegExp(`compartido con la comisi.n:\\s*${COMISION}`, 'i');

test.describe('Docente: compartir cuestionario con una comisión', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/docente');
    await page.getByPlaceholder('usuario').fill(DOCENTE_USERNAME);
    await page.getByPlaceholder('contraseña').fill(DOCENTE_PASSWORD);
    await page.getByRole('button', { name: /ingresar/i }).click();
    await expect(page).toHaveURL(/\/docente\/cuestionarios/);
  });

  test('comparte el quiz seedeado con una comisión y lo refleja en el listado', async ({ page }) => {
    const quizRow = page.locator('.panel', { hasText: QUIZ_TITLE }).first();
    await expect(quizRow).toBeVisible();

    await page.getByRole('button', { name: /compartir a alumnos/i }).click();
    await quizRow.locator('input[type="checkbox"]').check();

    // Tipear la comisión en minúsculas a propósito — el frontend la
    // normaliza a mayúsculas antes de mandarla, igual que el backend.
    await page.getByPlaceholder('comisiones separadas por coma').fill(COMISION.toLowerCase());
    await page.getByRole('button', { name: /^compartir \(1\)/ }).click();

    // handleShare limpia la selección apenas el POST resuelve, pero el
    // refresh() que sigue (refetch de /quizzes/) es fire-and-forget — no lo
    // espera. Por eso el chequeo confiable de que TODO terminó (POST +
    // refetch + re-render) es el texto de la fila, no la desaparición del
    // botón, que ocurre antes y da lugar a una carrera si seguís interactuando.
    await expect(quizRow.getByText(SHARED_LABEL)).toBeVisible();

    // El toast de éxito solo se muestra fuera del panel de compartir.
    await page.getByRole('button', { name: /^cancelar$/ }).click();
    await expect(page.getByText(`Compartido con la comisión ${COMISION}.`)).toBeVisible();
  });

  test('deja de compartir una comisión previamente compartida', async ({ page }) => {
    let quizRow = page.locator('.panel', { hasText: QUIZ_TITLE }).first();

    // Aseguramos estado conocido: comparte primero, y esperamos el estado
    // persistido (no solo la desaparición del botón) antes de la próxima acción.
    await page.getByRole('button', { name: /compartir a alumnos/i }).click();
    await quizRow.locator('input[type="checkbox"]').check();
    await page.getByPlaceholder('comisiones separadas por coma').fill(COMISION);
    await page.getByRole('button', { name: /^compartir \(1\)/ }).click();
    await expect(quizRow.getByText(SHARED_LABEL)).toBeVisible();

    // Recargamos antes de la segunda mitad: la sesión del docente persiste
    // en localStorage (ver DocenteContext), así que esto solo fuerza un
    // remount limpio de la SPA y un refetch real del quiz — evita
    // arrastrar cualquier estado de selección/input residual del primer
    // compartir a esta segunda interacción (root cause de un timeout
    // intermitente en CI: el botón quedaba "disabled" indefinidamente).
    await page.reload();
    quizRow = page.locator('.panel', { hasText: QUIZ_TITLE }).first();
    await expect(quizRow.getByText(SHARED_LABEL)).toBeVisible();

    // Ahora la saca.
    await page.getByRole('button', { name: /compartir a alumnos/i }).click();
    await quizRow.locator('input[type="checkbox"]').check();
    await page.getByPlaceholder('comisiones separadas por coma').fill(COMISION);
    const unshareButton = page.getByRole('button', { name: /dejar de compartir \(1\)/ });
    await expect(unshareButton).toBeEnabled();
    await unshareButton.click();
    await expect(quizRow.getByText(SHARED_LABEL)).toHaveCount(0);

    await page.getByRole('button', { name: /^cancelar$/ }).click();
    await expect(page.getByText(`Se dejó de compartir con la comisión ${COMISION}.`)).toBeVisible();
  });
});
