import { test, expect } from '@playwright/test';

test.describe('End-to-End User Journeys', () => {
  test('Flow 1: Landing page and auth gating are enforced', async ({ page }) => {
    // 1. Visit landing page
    await page.goto('/');
    await expect(page).toHaveTitle(/TripTabTally/);
    await expect(page.locator('h1')).toContainText('A ledger for group trips.');

    // 2. Unauthenticated visit to protected route redirects to login
    await page.goto('/trips');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('h1')).toContainText('Sign in');
  });

  test('Flow 2: Invite link token validation and public join view', async ({ page }) => {
    // 1. Opening an invalid or expired token shows clean not-found / expired message
    await page.goto('/join/invalid-or-nonexistent-token');
    await expect(page.locator('text=This invite link is no longer active')).toBeVisible();

    // 2. Contains clear instructions to ask trip admin
    await expect(page.locator('text=Ask the trip admin for a new one')).toBeVisible();
  });

  test('Flow 3: 404 page conforms to plain copy requirements', async ({ page }) => {
    // 1. Navigate to an arbitrary non-existent route
    await page.goto('/random-non-existent-page-path-12345');
    await expect(page.locator('text=404')).toBeVisible();
    await expect(page.locator('text=There is no page at this address')).toBeVisible();
    await expect(page.locator('text=Go to your trips')).toBeVisible();
  });
});
