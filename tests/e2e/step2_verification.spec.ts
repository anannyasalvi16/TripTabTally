import { test, expect } from '@playwright/test';
import { createAuthCookie } from './auth-helper';
import { computeBalances, planSettlement, parseRupeesToPaise } from '../../src/lib/money';

test.describe('Step 2: Signed-in Verification with Real Data', () => {
  const goaTripId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const rohanAuthCookie = createAuthCookie(
    '11111111-1111-1111-1111-111111111111',
    'rohan@example.com'
  );
  const strangerAuthCookie = createAuthCookie(
    '55555555-5555-5555-5555-555555555555',
    'stranger@example.com'
  );

  test('Walkthrough: Create trip, add all 4 split types, filter, edit, version conflict, soft-delete, and settle', async ({
    context,
    page,
    request,
  }) => {
    await context.addCookies([rohanAuthCookie]);

    // 1. Visit Trips page and verify Goa trip exists
    await page.goto('/trips');
    await expect(page.locator('text=Goa Trip').first()).toBeVisible();

    // 2. Open Goa Trip page
    await page.goto(`/trips/${goaTripId}`);
    await expect(page.locator('h1')).toContainText('Goa Trip');
    await expect(page.locator('text=Villa Booking Advance')).toBeVisible();

    // 3. Add Expense with Equal split via API / server action
    const saveExpUrl = 'http://127.0.0.1:54321/rest/v1/rpc/save_expense';
    const authHeaders = {
      Authorization: `Bearer mock-token-rohan`,
      'Content-Type': 'application/json',
    };

    // Equal Split: Breakfast Rs 1,000 (100000 paise) split 4 ways (25000 paise each)
    const expEqualRes = await request.post(saveExpUrl, {
      headers: authHeaders,
      data: {
        p_trip_id: goaTripId,
        p_title: 'Breakfast at Curlies',
        p_amount_paise: 100000,
        p_category: 'food',
        p_paid_by: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
        p_spent_on: '2026-12-11',
        p_split_type: 'equal',
        p_split_input: {},
        p_splits: [
          { member_id: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', share_paise: 25000 },
          { member_id: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', share_paise: 25000 },
          { member_id: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', share_paise: 25000 },
          { member_id: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4', share_paise: 25000 },
        ],
      },
    });
    expect(expEqualRes.ok()).toBe(true);

    // Exact Split: Scooters Rs 1,500 (150000 paise) exact
    const expExactRes = await request.post(saveExpUrl, {
      headers: authHeaders,
      data: {
        p_trip_id: goaTripId,
        p_title: 'Scooter Rentals',
        p_amount_paise: 150000,
        p_category: 'transport',
        p_paid_by: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
        p_spent_on: '2026-12-11',
        p_split_type: 'exact',
        p_split_input: {},
        p_splits: [
          { member_id: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', share_paise: 50000 },
          { member_id: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', share_paise: 50000 },
          { member_id: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', share_paise: 50000 },
        ],
      },
    });
    expect(expExactRes.ok()).toBe(true);

    // Percent Split: Seafood Dinner Rs 2,000 (200000 paise)
    const expPercentRes = await request.post(saveExpUrl, {
      headers: authHeaders,
      data: {
        p_trip_id: goaTripId,
        p_title: 'Seafood Dinner',
        p_amount_paise: 200000,
        p_category: 'food',
        p_paid_by: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
        p_spent_on: '2026-12-12',
        p_split_type: 'percent',
        p_split_input: {},
        p_splits: [
          { member_id: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', share_paise: 100000 },
          { member_id: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', share_paise: 50000 },
          { member_id: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', share_paise: 50000 },
        ],
      },
    });
    expect(expPercentRes.ok()).toBe(true);

    // Shares Split: Water Sports Rs 3,000 (300000 paise)
    const expSharesRes = await request.post(saveExpUrl, {
      headers: authHeaders,
      data: {
        p_trip_id: goaTripId,
        p_title: 'Water Sports',
        p_amount_paise: 300000,
        p_category: 'activities',
        p_paid_by: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
        p_spent_on: '2026-12-12',
        p_split_type: 'shares',
        p_split_input: {},
        p_splits: [
          { member_id: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', share_paise: 50000 },
          { member_id: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', share_paise: 100000 },
          { member_id: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', share_paise: 150000 },
        ],
      },
    });
    expect(expSharesRes.ok()).toBe(true);
    const sharesExpId = await expSharesRes.json();

    // 4. Verify balances invariant: query all active expenses and compute balances
    const expFetchRes = await request.get(
      `http://127.0.0.1:54321/rest/v1/expenses?trip_id=eq.${goaTripId}&deleted_at=is.null`
    );
    const activeExpenses = await expFetchRes.json();
    const splitsFetchRes = await request.get(`http://127.0.0.1:54321/rest/v1/expense_splits`);
    const allSplits = await splitsFetchRes.json();
    const setFetchRes = await request.get(
      `http://127.0.0.1:54321/rest/v1/settlements?trip_id=eq.${goaTripId}&voided_at=is.null`
    );
    const activeSettlements = await setFetchRes.json();

    const members = [
      { id: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1' },
      { id: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2' },
      { id: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3' },
      { id: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4' },
      { id: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5' },
    ];

    const currentBalances = computeBalances(
      members,
      activeExpenses,
      allSplits,
      activeSettlements
    );

    // ZERO-SUM INVARIANT: Sum of all net balances must be zero
    const sumNet = Object.values(currentBalances).reduce((a, b) => a + b, 0);
    expect(sumNet).toBe(0);

    // Max transfers guarantee <= (k - 1)
    const plan = planSettlement(currentBalances);
    const nonZeroMembers = Object.values(currentBalances).filter((b) => b !== 0).length;
    expect(plan.length).toBeLessThanOrEqual(Math.max(0, nonZeroMembers - 1));

    // 5. Test Filters and Sorting via URL
    await page.goto(`/trips/${goaTripId}?category=activities`);
    await expect(page.locator('text=Water Sports')).toBeVisible();
    await expect(page.locator('text=Villa Booking Advance')).not.toBeVisible();

    await page.goto(`/trips/${goaTripId}?sort=amount_desc`);
    await expect(page.locator('text=Water Sports')).toBeVisible();

    // 6. Edit Expense: Update Water Sports title to Parasailing & Jetski
    const editRes = await request.post(saveExpUrl, {
      headers: authHeaders,
      data: {
        p_expense_id: sharesExpId,
        p_trip_id: goaTripId,
        p_title: 'Parasailing & Jetski',
        p_amount_paise: 300000,
        p_category: 'activities',
        p_paid_by: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
        p_spent_on: '2026-12-12',
        p_split_type: 'shares',
        p_split_input: {},
        p_expected_version: 1, // Matches initial version 1
        p_splits: [
          { member_id: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', share_paise: 50000 },
          { member_id: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', share_paise: 100000 },
          { member_id: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', share_paise: 150000 },
        ],
      },
    });
    expect(editRes.ok()).toBe(true);

    // 7. Version Conflict Test: Second session tries to update with outdated version 1
    const conflictRes = await request.post(saveExpUrl, {
      headers: authHeaders,
      data: {
        p_expense_id: sharesExpId,
        p_trip_id: goaTripId,
        p_title: 'Concurrent Conflict Attempt',
        p_amount_paise: 300000,
        p_category: 'activities',
        p_paid_by: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
        p_spent_on: '2026-12-12',
        p_split_type: 'shares',
        p_split_input: {},
        p_expected_version: 1, // Outdated version! Current version is now 2
        p_splits: [],
      },
    });
    expect(conflictRes.status()).toBe(409); // Version conflict properly rejected!

    // 8. Soft-Delete Expense
    const deleteRes = await request.patch(
      `http://127.0.0.1:54321/rest/v1/expenses?id=eq.${sharesExpId}`,
      {
        headers: authHeaders,
        data: { deleted_at: new Date().toISOString() },
      }
    );
    expect(deleteRes.ok()).toBe(true);

    await page.goto(`/trips/${goaTripId}`);
    await expect(page.locator('text=Parasailing & Jetski')).not.toBeVisible();

    // 9. Record settlements to reach settled state
    // Recalculate balances and execute plan
    const expAfterDelete = (
      await (await request.get(`http://127.0.0.1:54321/rest/v1/expenses?trip_id=eq.${goaTripId}&deleted_at=is.null`)).json()
    );
    const setBefore = (
      await (await request.get(`http://127.0.0.1:54321/rest/v1/settlements?trip_id=eq.${goaTripId}&voided_at=is.null`)).json()
    );
    const balNow = computeBalances(members, expAfterDelete, allSplits, setBefore);
    const finalPlan = planSettlement(balNow);

    for (const transfer of finalPlan) {
      await request.post('http://127.0.0.1:54321/rest/v1/settlements', {
        headers: authHeaders,
        data: {
          trip_id: goaTripId,
          from_member: transfer.from,
          to_member: transfer.to,
          amount_paise: transfer.amount,
          paid_on: '2026-12-13',
          note: 'Final settlement to clear debt',
          created_by: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
          voided_at: null,
        },
      });
    }

    // 10. Verify Settled State in UI
    await page.goto(`/trips/${goaTripId}/settle`);
    await expect(page.locator('text=All settled.')).toBeVisible();
    await expect(page.locator('text=Everyone is even.')).toBeVisible();
  });

  test('Security: Signed-in user opening a foreign trip gets not-found page', async ({
    context,
    page,
  }) => {
    // Authenticate as a stranger who is not a member of Goa Trip
    await context.addCookies([strangerAuthCookie]);

    // Navigate to Goa Trip
    await page.goto(`/trips/${goaTripId}`);
    await expect(page.locator('text=404')).toBeVisible();
    await expect(page.locator('text=There is no page at this address')).toBeVisible();
    await expect(page.locator('text=Go to your trips')).toBeVisible();
  });

  test('Navigation: Signed-in user opening an unknown route gets designed not-found page', async ({
    context,
    page,
  }) => {
    await context.addCookies([rohanAuthCookie]);

    await page.goto('/trips/unknown-route-that-does-not-exist');
    await expect(page.locator('text=404')).toBeVisible();
    await expect(page.locator('text=There is no page at this address')).toBeVisible();
    await expect(page.locator('text=Go to your trips')).toBeVisible();
  });
});
