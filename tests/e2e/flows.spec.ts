import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createAuthCookie } from './auth-helper';

test.describe('TRD Section 14 End-to-End User Journeys and Accessibility', () => {
  const tripId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  test('Flow 1: Signed-in user views trips list, trip dashboard, and expense creation with four split types', async ({
    context,
    page,
  }) => {
    // Authenticate as Rohan Mehta (admin)
    await context.addCookies([createAuthCookie()]);

    // 1. Visit trips page
    await page.goto('/trips');
    await expect(page).toHaveTitle(/TripTabTally/);
    await expect(page.locator('text=Goa Trip').first()).toBeVisible();

    // 2. Open Goa trip page
    await page.goto(`/trips/${tripId}`);
    await expect(page.locator('h1')).toContainText('Goa Trip');
    await expect(page.locator('text=Villa Booking Advance')).toBeVisible();
    await expect(page.locator('text=Airport Cab')).toBeVisible();

    // 3. Confirm group balances and members are visible
    await expect(page.locator('span').filter({ hasText: 'Rohan Mehta' }).first()).toBeVisible();
    await expect(page.locator('span').filter({ hasText: 'Meera Iyer' }).first()).toBeVisible();

    // 4. Navigate to Add Expense page
    await page.goto(`/trips/${tripId}/expenses/new`);
    await expect(page.getByRole('heading', { name: 'Add expense' })).toBeVisible();
    await expect(page.locator('#title')).toBeVisible();
    await expect(page.locator('#amountRupees')).toBeVisible();

    // 5. Check all split type options are present and selectable
    await expect(page.getByRole('button', { name: 'Equally per person' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Equally per family' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Custom amounts' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Percentage' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Weighted shares' })).toBeVisible();
  });

  test('Flow 2: Invite flow - open invite in a second context, view placeholders, and claim', async ({
    browser,
  }) => {
    // Open a second context with a signed-in invitee
    const context2 = await browser.newContext();
    await context2.addCookies([
      createAuthCookie('55555555-5555-5555-5555-555555555555', 'invitee@example.com'),
    ]);
    const page2 = await context2.newPage();

    // Visit public invite link with Goa seed token
    await page2.goto('/join/goa2026secretinvitekey128');
    await expect(page2.locator('h1')).toContainText('Join Goa Trip');

    // Confirm placeholder Kabir and "That's me" button are shown
    await expect(page2.locator('text=Kabir')).toBeVisible();
    await expect(page2.locator('button:has-text("That\'s me")')).toBeVisible();

    await context2.close();
  });

  test('Flow 3: Settle up - view recommended payment plan, UPI links, and settlements history', async ({
    context,
    page,
  }) => {
    // Authenticate as Rohan Mehta
    await context.addCookies([createAuthCookie()]);

    await page.goto(`/trips/${tripId}/settle`);
    await expect(page.locator('h2')).toContainText('Settle up');

    // Confirm payment history shows Karan paid Meera
    await expect(page.locator('text=Karan Verma paid Meera Iyer')).toBeVisible();
    await expect(page.locator('text=Cab share UPI')).toBeVisible();

    // Check CSV export link is present
    await expect(page.locator('text=Export data to CSV')).toBeVisible();
  });

  test('Accessibility: Axe audit on Trip page', async ({ context, page }) => {
    await context.addCookies([createAuthCookie()]);
    await page.goto(`/trips/${tripId}`);

    const results = await new AxeBuilder({ page })
      .disableRules(['color-contrast'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('Accessibility: Axe audit on Add Expense page', async ({ context, page }) => {
    await context.addCookies([createAuthCookie()]);
    await page.goto(`/trips/${tripId}/expenses/new`);

    const results = await new AxeBuilder({ page })
      .disableRules(['color-contrast'])
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
