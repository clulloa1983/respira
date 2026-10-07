// Utilidades comunes de las pruebas.
import { test as base, expect } from '@playwright/test';

/* Cualquier excepción no capturada en la página hace fallar la prueba. */
export const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await use(page);
    expect(errors, 'excepciones no capturadas en la página').toEqual([]);
  },
});
export { expect };

/* Abre una ruta de la app y espera a que el contenido (JSON) esté cargado. */
export async function open(page, hash = '#/') {
  await page.goto(hash);
  await expect(page.locator('#techGrid li').first()).toBeAttached();
}

/* Guarda datos en el almacenamiento local antes de que cargue la app (una sola vez por prueba). */
export async function seed(page, { prefs = {}, daysAgo = [] } = {}) {
  await page.addInitScript(({ prefs, daysAgo }) => {
    if (sessionStorage.getItem('respira:seeded')) return;
    sessionStorage.setItem('respira:seeded', '1');
    const t = new Date();
    const sessions = daysAgo.map((n, i) => ({
      id: `semilla-${i}`,
      techniqueId: prefs.lastTechnique || 'sigh',
      variant: 'default',
      startedAt: new Date(t.getFullYear(), t.getMonth(), t.getDate() - n, 9).toISOString(),
      durationSec: 300,
      cyclesCompleted: 30,
      completed: true,
    }));
    localStorage.setItem('respira:v1', JSON.stringify({ version: 1, prefs, sessions }));
  }, { prefs, daysAgo });
}

/* Rectángulo de un elemento en píxeles CSS. */
export const box = (locator) => locator.evaluate((el) => {
  const r = el.getBoundingClientRect();
  return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
});
