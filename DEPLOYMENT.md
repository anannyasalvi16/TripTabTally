# TripTabTally Deployment Guide

This document describes the step-by-step procedure to deploy TripTabTally to production using Supabase and Vercel.

## 1. Prerequisites

Before beginning deployment, ensure you have:

- A GitHub account with access to the [TripTabTally repository](https://github.com/anannyasalvi16/TripTabTally).
- A [Supabase](https://supabase.com) account.
- A [Vercel](https://vercel.com) account.
- Node.js 20 or higher installed locally (for local verification).

## 2. Supabase Production Project Setup

### Step 2.1: Create New Project
1. Log in to your Supabase Dashboard.
2. Click **New project**.
3. Choose an organization.
4. Set the project name to `TripTabTally`.
5. Generate and securely save a strong database password.
6. Select the **Mumbai (ap-south-1)** region. This matches the Vercel `bom1` region to minimize network latency between serverless functions and PostgreSQL.
7. Click **Create new project** and wait for provisioning to complete.

### Step 2.2: Execute Database Migrations
Run the schema and policy migrations in order using the Supabase SQL Editor:

1. Open the **SQL Editor** from the left navigation.
2. Click **New query**.
3. Copy the full content of `supabase/migrations/20261010000000_initial_schema.sql` into the editor and click **Run**.
4. Confirm all 8 tables are created: `profiles`, `trips`, `trip_members`, `expenses`, `expense_splits`, `settlements`, `category_limits`, `invites`.
5. Open a second new query.
6. Copy the full content of `supabase/migrations/20261010000001_functions_and_rls.sql` into the editor and click **Run**.
7. Confirm that Row Level Security is enabled on all 8 tables and that the security definer functions (`create_trip`, `join_trip`, `save_expense`) are registered.

### Step 2.3: Configure Authentication
1. Go to **Authentication** > **Providers** > **Email**.
2. Ensure Email provider is **Enabled**.
3. Disable "Confirm email" if using passwordless magic links directly, or customize the email template.
4. Go to **Authentication** > **URL Configuration**.
5. Set **Site URL** to your planned Vercel production domain (for example, `https://triptabtally.vercel.app`).
6. Add the following to **Redirect URLs**:
   - `http://localhost:3000/auth/callback` (for local development)
   - `https://*.vercel.app/auth/callback` (for preview deployments)
   - `https://triptabtally.vercel.app/auth/callback` (for production)
7. **Custom SMTP (Recommended to eliminate rate limits)**:
   - Supabase default built-in SMTP enforces a strict limit of 3 emails per hour.
   - To remove this limit, go to **Project Settings** > **Authentication** > **SMTP Settings**.
   - Enable Custom SMTP using Resend (`smtp.resend.com`, port 465, username `resend`, password `<your-resend-api-key>`).
8. If enabling Google OAuth:
   - In Google Cloud Console, create OAuth 2.0 Client credentials with authorized redirect URI: `https://<your-supabase-project-id>.supabase.co/auth/v1/callback`.
   - In Supabase Dashboard, enable Google provider and paste Client ID and Client Secret.

### Step 2.4: Collect Project API Credentials
1. Go to **Project Settings** > **API**.
2. Note down:
   - **Project URL**: `https://<project-ref>.supabase.co`
   - **anon (public)** key: `eyJh...`
3. Important: The `service_role` secret key is never used by this application and must never be added to Vercel environment variables.

## 3. Vercel Deployment Setup

### Step 3.1: Import Project
1. Log in to [Vercel](https://vercel.com).
2. Click **Add New** > **Project**.
3. Select your GitHub repository: `anannyasalvi16/TripTabTally`.
4. Keep framework preset as **Next.js**.
5. Root directory should remain `./`.

### Step 3.2: Configure Region
The project includes a `vercel.json` file configuring the Mumbai serverless region:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["bom1"],
  "framework": "nextjs"
}
```

This guarantees server actions execute in `bom1`, co-located with Supabase in `ap-south-1`.

### Step 3.3: Set Environment Variables
Add the following three variables under **Environment Variables**:

| Variable Name | Environment | Value Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview, Development | Your Supabase project URL (`https://<project-ref>.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production, Preview, Development | Your Supabase anonymous public key |
| `NEXT_PUBLIC_SITE_URL` | Production | Your primary production URL (`https://triptabtally.vercel.app`) |

Click **Deploy**.

## 4. Post-Deployment Verification Checklist

Once Vercel completes the build and deployment:

1. **Security Headers**:
   Verify in terminal using `curl -I https://<your-domain>`:
   - `Content-Security-Policy` header is present.
   - `X-Content-Type-Options: nosniff` is present.
   - `Referrer-Policy: strict-origin-when-cross-origin` is present.
   - `X-Frame-Options: DENY` is present.

2. **Authentication Flow**:
   - Navigate to `/login`.
   - Submit your email address to receive a magic link.
   - Click the link in your email inbox and verify automatic redirection to `/trips`.

3. **Trip Ledger Operations**:
   - Create a test trip with a sample budget.
   - Add expenses testing each split method (equal, exact, percentage, shares).
   - Check that balances sum to zero.
   - Navigate to Settle Up and verify greedy payment recommendations.
   - Test UPI deep link on mobile or copy button on desktop.

4. **Invite Flow**:
   - Generate an invite link on the People page.
   - Open the link in a private/incognito window.
   - Verify invite loads trip name and destination without leaking expenses.
   - Join or claim placeholder.

5. **Data Export**:
   - Navigate to export endpoint `/api/trips/<tripId>/export` and confirm CSV download containing expenses and settlements.

6. **Performance Monitoring**:
   - Vercel Speed Insights is integrated via `@vercel/speed-insights/next` in the root layout.
   - Real-world Core Web Vitals (FCP, LCP, CLS) populate automatically in the Vercel project dashboard under the Speed Insights tab.

