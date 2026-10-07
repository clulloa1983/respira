// Pruebas de Respira con Playwright. Usan el Microsoft Edge instalado (channel: 'msedge'),
// así no hay que descargar navegadores: el Chrome de algunos equipos no permite la caché
// de la PWA en modo sin interfaz, y Edge comparte el motor de Chrome para Android.
import { defineConfig } from '@playwright/test';

const PORT = Number(process.env.PORT || 4173);
const baseURL = `http://127.0.0.1:${PORT}/respira/`;

export default defineConfig({
  testDir: 'tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    channel: 'msedge',
    locale: 'es-CL',
    timezoneId: 'America/Santiago',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'escritorio',
      testMatch: /(app|pwa)\.spec\.mjs/,
      use: { viewport: { width: 1280, height: 900 } },
    },
    {
      name: 'telefono',
      testMatch: /movil\.spec\.mjs/,
      // Como el Xiaomi de pruebas: 360 px de ancho, táctil y con densidad 2x.
      use: { viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    },
  ],
  webServer: {
    command: 'node tests/server.mjs',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    env: { PORT: String(PORT) },
  },
});
