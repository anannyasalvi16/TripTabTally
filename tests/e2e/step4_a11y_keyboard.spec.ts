import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createAuthCookie } from './auth-helper';

test.describe('Step 4: Performance, Accessibility & Keyboard Navigation', () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([createAuthCookie()]);
  });

  const tripId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  const pagesToAudit = [
    { name: 'Trips list', path: '/trips' },
    { name: 'Trip ledger', path: `/trips/${tripId}` },
    { name: 'Add expense', path: `/trips/${tripId}/expenses/new` },
    { name: 'People', path: `/trips/${tripId}/people` },
    { name: 'Budget', path: `/trips/${tripId}/budget` },
    { name: 'Settle up', path: `/trips/${tripId}/settle` },
    { name: 'Profile', path: '/profile' },
  ];

  for (const p of pagesToAudit) {
    test(`Axe WCAG AA check on ${p.name} (light mode)`, async ({ page }) => {
      await page.goto(p.path, { waitUntil: 'networkidle' });

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(results.violations).toEqual([]);
    });

    test(`Axe WCAG AA check on ${p.name} (dark mode)`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.goto(p.path, { waitUntil: 'networkidle' });

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(results.violations).toEqual([]);
    });
  }

  test('Keyboard-only navigation works through trip ledger and controls', async ({ page }) => {
    await page.goto(`/trips/${tripId}`, { waitUntil: 'networkidle' });

    // Initial focus on body
    await page.keyboard.press('Tab');

    // Tab through at least 6 interactive elements
    const focusedElements: string[] = [];
    for (let i = 0; i < 8; i++) {
      const elInfo = await page.evaluate(() => {
        const active = document.activeElement;
        if (!active || active === document.body) return null;
        return {
          tag: active.tagName.toLowerCase(),
          text: (active.textContent || '').trim().slice(0, 30),
          outline: window.getComputedStyle(active).outlineStyle,
        };
      });
      if (elInfo) {
        focusedElements.push(`${elInfo.tag}: ${elInfo.text}`);
      }
      await page.keyboard.press('Tab');
    }

    // Verify focus traversed interactive elements
    expect(focusedElements.length).toBeGreaterThanOrEqual(5);
  });

  test('Keyboard-only form completion on add expense', async ({ page }) => {
    await page.goto(`/trips/${tripId}/expenses/new`, { waitUntil: 'networkidle' });

    // Tab into title input
    await page.locator('#title').waitFor({ state: 'visible' });
    await page.locator('#title').focus();
    await page.keyboard.type('Bus tickets');

    // Tab into amount
    await page.keyboard.press('Tab');
    await page.keyboard.type('450');

    // Tab to category
    await page.keyboard.press('Tab');

    // Verify amount and title are updated via keyboard
    const titleVal = await page.locator('#title').inputValue();
    expect(titleVal).toBe('Bus tickets');
    const amountVal = await page.locator('#amountRupees').inputValue();
    expect(amountVal).toContain('450');
  });
});
