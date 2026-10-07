// Funcionamiento general (escritorio): contenido, práctica, historial y recordatorio.
import fs from 'node:fs';
import { test, expect, open, seed } from './helpers.mjs';

const TECHNIQUES = ['478', 'box', 'coherent', 'diaphragmatic', 'sigh', 'pursed', 'nadi', 'bhramari', 'ujjayi'];

test('la autoverificación interna pasa completa', async ({ page }) => {
  await open(page);
  const r = await page.evaluate(() => window.__respiraSelfTest());
  const failed = r.rows.filter((x) => x.resultado !== 'OK').map((x) => `${x.prueba}: ${x.detalle}`);
  expect(failed).toEqual([]);
  expect(r.passed).toBeGreaterThan(60);
});

test('muestra las 9 técnicas', async ({ page }) => {
  await open(page);
  await expect(page.locator('#techGrid li')).toHaveCount(TECHNIQUES.length);
  for (const id of TECHNIQUES) await expect(page.locator(`#techGrid li[data-id="${id}"] .tech-name`)).toBeVisible();
});

test('cada técnica tiene evidencia y referencias con enlaces https', async ({ page }) => {
  await open(page);
  for (const id of TECHNIQUES) {
    await page.goto(`#/tecnica/${id}`);
    const evidence = page.locator('[aria-labelledby="d-evidence"]');
    await expect(evidence.getByRole('heading', { name: 'Qué dice la evidencia' })).toBeVisible();
    const links = evidence.locator('.ref a');
    expect(await links.count(), `referencias de ${id}`).toBeGreaterThan(0);
    for (const href of await links.evaluateAll((as) => as.map((a) => a.href))) expect(href, id).toMatch(/^https:\/\//);
    await expect(page.locator('#dPattern .phase-item').first()).toBeVisible();
  }
});

test('el aviso de retenciones aparece solo en técnicas con retenciones', async ({ page }) => {
  await open(page);
  const notice = 'Las retenciones deben sentirse cómodas';
  for (const [id, holds] of [['478', true], ['box', true], ['coherent', false], ['sigh', false]]) {
    await page.goto(`#/tecnica/${id}`);
    const prec = page.locator('[aria-labelledby="d-prec"]');
    if (holds) await expect(prec).toContainText(notice);
    else await expect(prec).not.toContainText(notice);
  }
});

test('los filtros reducen la lista', async ({ page }) => {
  await open(page);
  await page.locator('#filters').evaluate((d) => { d.open = true; }); // en escritorio ya viene abierto
  await page.locator('.chip[data-dim="focus"][data-val="airway"]').click();
  await expect(page.locator('#techGrid li:visible')).toHaveCount(1);
  await expect(page.locator('#techGrid li[data-id="pursed"]')).toBeVisible();
  await page.locator('#clearFilters').click();
  await expect(page.locator('#techGrid li:visible')).toHaveCount(TECHNIQUES.length);
});

test('«Calmar la ansiedad» sugiere el suspiro cíclico', async ({ page }) => {
  await open(page);
  await page.locator('[data-need="anxiety"]').click();
  await expect(page.locator('#needResult')).toContainText('Suspiro cíclico');
});

test('una práctica completa se guarda en el historial y suma racha', async ({ page }) => {
  await page.clock.install();
  // 4-7-8 estándar, 2 ciclos = 38 s (se guardan las sesiones de 30 s o más). Sin tonos ni voz.
  await seed(page, { prefs: { tones: false, voice: false, configs: { 478: { mode: 'cycles', cycles: 2, minutes: 1, variant: 'standard' } } } });
  await open(page, '#/practica/478');
  await page.clock.pauseAt(Date.now() + 1_000);
  await page.locator('#btnMain').click();
  await page.clock.runFor(3_000 + 38_000 + 500);
  await expect(page.locator('#summary')).toBeVisible();
  await expect(page.locator('#sumCycles')).toHaveText('2 de 2');
  await page.goto('#/historial');
  await expect(page.locator('#recentList li')).toHaveCount(1);
  await expect(page.locator('#statsGrid .stat').nth(2)).toContainText('1');
});

test('suspiro cíclico: el círculo sube en dos tramos y baja al exhalar', async ({ page }) => {
  await page.clock.install();
  await seed(page, { prefs: { tones: false, voice: false, motion: 'auto', configs: { sigh: { mode: 'cycles', cycles: 1, minutes: 1, variant: 'default' } } } });
  await open(page, '#/practica/sigh');
  await page.clock.pauseAt(Date.now() + 1_000);
  await page.locator('#btnMain').click();
  const scale = () => page.locator('#breathCircle').evaluate((c) => Number((c.style.transform.match(/[\d.]+/) || [0])[0]));
  const phase = () => page.locator('#phaseName').textContent();
  await page.clock.runFor(3_000 + 1_990); // final de la 1.ª inhalación (nivel 0,7)
  const first = await scale();
  expect(await phase()).toBe('Inhala');
  await page.clock.runFor(1_000); // final de la 2.ª inhalación (nivel 1)
  const second = await scale();
  expect(await phase()).toBe('Inhala un poco más');
  await page.clock.runFor(3_000); // mitad de la exhalación
  const mid = await scale();
  expect(await phase()).toBe('Exhala');
  expect(first).toBeGreaterThan(0.78);
  expect(first).toBeLessThan(0.86); // 0,4 + 0,6 × 0,7 = 0,82
  expect(second).toBeGreaterThan(0.97);
  expect(mid).toBeLessThan(second);
});

test('el recordatorio genera un .ics válido y el enlace de Google Calendar', async ({ page }) => {
  await open(page, '#/ajustes');
  await page.locator('#setRemTime').fill('07:30');
  await page.locator('#setRemTime').dispatchEvent('change');
  await page.locator('#setRemDays').selectOption('weekdays');
  const gcal = new URL(await page.locator('#lnkGcal').getAttribute('href'));
  expect(gcal.hostname).toBe('calendar.google.com');
  expect(gcal.searchParams.get('recur')).toBe('RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR');
  expect(gcal.searchParams.get('dates')).toMatch(/T073000\/\d{8}T073500$/);

  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#btnIcs').click()]);
  expect(download.suggestedFilename()).toBe('respira-recordatorio.ics');
  const ics = fs.readFileSync(await download.path(), 'utf8');
  expect(ics).toContain('\r\nRRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR\r\n');
  expect(ics).toMatch(/\r\nDTSTART:\d{8}T073000\r\n/);
  expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  for (const line of ics.split('\r\n')) expect(Buffer.byteLength(line, 'utf8')).toBeLessThanOrEqual(75);
});
