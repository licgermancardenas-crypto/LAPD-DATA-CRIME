import { test, expect } from '@playwright/test';

const ROUTES = ['/login', '/dashboard', '/osiris', '/insights', '/geo', '/compare', '/glossary'];

for (const route of ROUTES) {
  test(`${route} loads with no console errors`, async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    const response = await page.goto(route);
    expect(response.ok()).toBeTruthy();
    await page.waitForLoadState('networkidle');

    expect(consoleErrors, `console errors on ${route}:\n${consoleErrors.join('\n')}`).toEqual([]);
  });
}
