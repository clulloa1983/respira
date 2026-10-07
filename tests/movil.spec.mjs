// Uso en el teléfono (360 × 780, táctil): navegación inferior, tarjetas, detalle, Inicio y práctica nocturna.
import { test, expect, open, seed, box } from './helpers.mjs';

test('ninguna vista se desborda a lo ancho', async ({ page }) => {
  await open(page);
  for (const hash of ['#/', '#/tecnica/nadi', '#/practica/nadi', '#/historial', '#/ajustes']) {
    await page.goto(hash);
    const { sw, vw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: innerWidth }));
    expect(sw, hash).toBeLessThanOrEqual(vw);
  }
});

test('la barra de navegación está abajo y cada opción centrada en su columna', async ({ page }) => {
  for (const [hash, nav] of [['#/', 'home'], ['#/historial', 'history'], ['#/ajustes', 'settings']]) {
    await open(page, hash);
    const bar = await box(page.locator('.app-header nav'));
    expect(bar.bottom).toBe(page.viewportSize().height);
    expect(bar.width).toBe(page.viewportSize().width);
    const cells = await page.locator('.nav-list li').evaluateAll((lis) => lis.map((li) => {
      const c = li.getBoundingClientRect();
      const a = li.querySelector('a').getBoundingClientRect();
      return { width: c.width, offset: (a.left + a.right) / 2 - (c.left + c.right) / 2, fills: Math.abs(a.width - c.width) < 1, height: a.height };
    }));
    for (const c of cells) {
      expect(Math.abs(c.offset), `${nav}: desvío del centro`).toBeLessThanOrEqual(1);
      expect(c.fills, `${nav}: la opción llena su columna`).toBe(true);
      expect(c.height, `${nav}: alto táctil`).toBeGreaterThanOrEqual(48);
    }
    expect(Math.max(...cells.map((c) => c.width)) - Math.min(...cells.map((c) => c.width))).toBeLessThanOrEqual(1);
    await expect(page.locator('.nav-list a[aria-current="page"]')).toHaveAttribute('data-nav', nav);
  }
});

test('la navegación inferior no tapa el pie de página y se oculta al practicar', async ({ page }) => {
  await open(page);
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  const foot = await box(page.locator('.app-footer p'));
  const bar = await box(page.locator('.app-header nav'));
  expect(foot.bottom).toBeLessThanOrEqual(bar.top);
  await page.goto('#/practica/478');
  await expect(page.locator('.app-header nav')).toBeHidden();
});

test('las tarjetas de técnicas son compactas', async ({ page }) => {
  await open(page);
  const heights = await page.locator('#techGrid li').evaluateAll((lis) => lis.map((li) => li.getBoundingClientRect().height));
  expect(heights).toHaveLength(9);
  for (const h of heights) expect(h).toBeLessThan(200);
});

test('la barra «Comenzar» del detalle aparece, se oculta junto a la configuración y empieza la práctica', async ({ page }) => {
  await open(page, '#/tecnica/478');
  const bar = page.locator('#startBar');
  await expect(bar).toBeVisible();
  await expect(bar).not.toHaveClass(/is-idle/);
  await expect(page.locator('#startBarInfo')).toContainText('4 ciclos');
  expect((await box(bar)).bottom).toBeLessThanOrEqual((await box(page.locator('.app-header nav'))).top);

  await page.locator('#cfgBegin').scrollIntoViewIfNeeded();
  await expect(bar).toHaveClass(/is-idle/);
  await page.evaluate(() => scrollTo(0, 0));
  await expect(bar).not.toHaveClass(/is-idle/);

  await page.locator('#startBarBtn').click();
  await expect(page).toHaveURL(/#\/practica\/478$/);
  await expect(page.locator('#practiceTitle')).toHaveText('Técnica 4-7-8');
});

test('Inicio: sin historial muestra la presentación; con historial, «Repetir» y la racha arriba', async ({ page, browser }) => {
  await open(page);
  await expect(page.locator('#view-home .lede')).toBeVisible();
  await expect(page.locator('#lastPractice')).toBeHidden();

  const ctx = await browser.newContext({ viewport: page.viewportSize(), isMobile: true, hasTouch: true });
  const p2 = await ctx.newPage();
  await seed(p2, { prefs: { lastTechnique: 'sigh' }, daysAgo: [1, 2, 3] });
  await open(p2);
  await expect(p2.locator('#view-home .lede')).toBeHidden();
  await expect(p2.locator('#lastPractice')).toContainText('Repetir: Suspiro cíclico');
  await expect(p2.locator('#streakCard')).toContainText('3');
  const navTop = (await box(p2.locator('.app-header nav'))).top;
  expect((await box(p2.locator('#streakCard'))).bottom).toBeLessThanOrEqual(navTop);
  await ctx.close();
});

test('el acceso directo #/repetir abre la última técnica, o el inicio si no hay', async ({ page, browser }) => {
  await open(page, '#/repetir');
  await expect(page).toHaveURL(/#\/$/);

  const ctx = await browser.newContext({ viewport: page.viewportSize(), isMobile: true, hasTouch: true });
  const p2 = await ctx.newPage();
  await seed(p2, { prefs: { lastTechnique: 'nadi' } });
  await open(p2, '#/repetir');
  await expect(p2).toHaveURL(/#\/practica\/nadi$/);
  await expect(p2.locator('#practiceTitle')).toHaveText('Respiración alterna');
  await ctx.close();
});

test('práctica nocturna: fondo negro aun con tema claro, y se restaura al salir', async ({ page }) => {
  await seed(page, { prefs: { dimMode: 'on', theme: 'light' } });
  await open(page, '#/practica/478');
  const practice = page.locator('#view-practice');
  await expect(practice).toHaveClass(/is-dim/);
  await expect(practice).toHaveCSS('background-color', 'rgb(0, 0, 0)');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#000000');
  await page.goto('#/');
  await expect(practice).not.toHaveClass(/is-dim/);
  await expect(page.locator('meta[name="theme-color"]')).not.toHaveAttribute('content', '#000000');
});

test('práctica nocturna «Nunca» no atenúa', async ({ page }) => {
  await seed(page, { prefs: { dimMode: 'off' } });
  await open(page, '#/practica/478');
  await expect(page.locator('#view-practice')).not.toHaveClass(/is-dim/);
});

test('la práctica nocturna se elige en Ajustes y se guarda', async ({ page }) => {
  await open(page, '#/ajustes');
  await page.locator('label.seg-opt', { hasText: 'Siempre' }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('respira:v1')).prefs.dimMode);
  expect(saved).toBe('on');
});
