// PWA: instalación, caché del service worker y uso sin conexión.
import { test, expect, open } from './helpers.mjs';

test('el manifest es instalable y trae los accesos directos', async ({ page, request }) => {
  await open(page);
  const manifest = await (await request.get('manifest.webmanifest')).json();
  expect(manifest.start_url).toBe('./');
  expect(manifest.shortcuts.map((s) => s.url)).toEqual(['./#/repetir', './#/practica/sigh', './#/practica/478']);
  for (const icon of [...manifest.icons, ...manifest.shortcuts.flatMap((s) => s.icons)]) {
    const res = await request.get(icon.src);
    expect(res.status(), icon.src).toBe(200);
  }
  const cdp = await page.context().newCDPSession(page);
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
  // Playwright usa sesiones de incógnito, donde Chrome nunca ofrece instalar: ese aviso no depende de la app.
  expect(installabilityErrors.filter((e) => e.errorId !== 'in-incognito')).toEqual([]);
});

test('el service worker guarda la app y funciona sin conexión', async ({ page, context }) => {
  await open(page);
  const cached = await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
    const keys = await caches.keys();
    const cache = await caches.open(keys.find((k) => k.startsWith('respira-')));
    return { keys, urls: (await cache.keys()).map((r) => new URL(r.url).pathname) };
  });
  expect(cached.keys).toEqual(['respira-v2']);
  expect(cached.urls).toEqual(expect.arrayContaining(['/respira/', '/respira/index.html', '/respira/data/techniques.json', '/respira/data/locales/es.json']));
  expect(cached.urls).toHaveLength(13);

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#techGrid li')).toHaveCount(9);
  await page.goto('#/tecnica/box');
  await expect(page.locator('#detail-title')).toHaveText('Respiración cuadrada');
  await page.goto('?utm_source=prueba#/practica/coherent');
  await expect(page.locator('#practiceTitle')).toHaveText('Respiración coherente');
  await expect(page.locator('#loadError')).toBeHidden();
  await context.setOffline(false);
});

test('con conexión se sirve siempre lo publicado (red primero)', async ({ page, context }) => {
  await open(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // ya controlada por el service worker
  // Simula una publicación nueva del contenido: el service worker debe pedirla a la red.
  // context.route también intercepta lo que pide el service worker (solo en Chromium).
  await context.route('**/data/locales/es.json', async (route) => {
    const res = await route.fetch();
    const body = (await res.text()).replace('"name": "Respiración cuadrada"', '"name": "Respiración cuadrada (nueva)"');
    await route.fulfill({ response: res, body });
  });
  await page.goto('#/tecnica/box');
  await page.reload();
  await expect(page.locator('#detail-title')).toHaveText('Respiración cuadrada (nueva)');
});
