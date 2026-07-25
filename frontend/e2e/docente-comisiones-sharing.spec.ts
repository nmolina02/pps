import { expect, test } from '@playwright/test';

const DOCENTE_USERNAME = 'e2e_docente';
const DOCENTE_PASSWORD = 'e2e-clave-segura-123';
const COMISION = 'K3054';
const QUIZ_TITLE = 'Quiz e2e — procesos';

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

    // handleShare limpia la selección al terminar — esperamos a que el
    // botón desaparezca como señal de que el POST se resolvió.
    await expect(page.getByRole('button', { name: /^compartir \(1\)/ })).toHaveCount(0);

    // El toast de éxito solo se muestra fuera del panel de compartir.
    await page.getByRole('button', { name: /^cancelar$/ }).click();
    await expect(page.getByText(`Compartido con la comisión ${COMISION}.`)).toBeVisible();
    await expect(quizRow.getByText(new RegExp(`compartido con la comisi.n:\\s*${COMISION}`, 'i'))).toBeVisible();
  });

  test('deja de compartir una comisión previamente compartida', async ({ page }) => {
    const quizRow = page.locator('.panel', { hasText: QUIZ_TITLE }).first();

    // Aseguramos estado conocido: comparte primero.
    await page.getByRole('button', { name: /compartir a alumnos/i }).click();
    await quizRow.locator('input[type="checkbox"]').check();
    await page.getByPlaceholder('comisiones separadas por coma').fill(COMISION);
    await page.getByRole('button', { name: /^compartir \(1\)/ }).click();
    await expect(page.getByRole('button', { name: /^compartir \(1\)/ })).toHaveCount(0);

    // Ahora la saca (seguimos en modo compartir, la selección se resetea sola tras cada acción).
    await quizRow.locator('input[type="checkbox"]').check();
    await page.getByPlaceholder('comisiones separadas por coma').fill(COMISION);
    await page.getByRole('button', { name: /dejar de compartir \(1\)/ }).click();
    await expect(page.getByRole('button', { name: /dejar de compartir \(1\)/ })).toHaveCount(0);

    await page.getByRole('button', { name: /^cancelar$/ }).click();
    await expect(page.getByText(`Se dejó de compartir con la comisión ${COMISION}.`)).toBeVisible();
    await expect(quizRow.getByText(/compartido con la comisi.n/i)).toHaveCount(0);
  });
});
