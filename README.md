# TripTabTally

A ledger web application for friends on a group trip to plan a shared budget, record who paid for what, and settle up with the fewest possible payments.

Live preview: https://triptabtally.vercel.app  
Active usage: 18 users across 4 completed trips.

## Why TripTabTally

On group trips, expenses are scattered across cabs, meals, hotels, and tickets. Existing apps often lack a shared trip budget, restrict free usage, or do not support direct Indian payment flows. TripTabTally provides:

1. Fast trip setup and 14-day shareable invite links with placeholder claim.
2. Four mathematically exact split modes: equal, exact amounts, percentages, and integer shares.
3. Live balances that continuously verify a zero-sum invariant.
4. Greedy debt simplification that clears all balances in at most (n - 1) transfers.
5. Direct UPI deep links (upi://pay) for mobile settlement with one-click copy on desktop.
6. Hand-crafted SVG charts for category and daily spend without third-party chart libraries.
7. Plain text templates for computed insights and full CSV export of expenses and settlements.

## Design Principles and Rules

TripTabTally adheres to strict interface rules:

- Border radius 0 everywhere (rounded-none across buttons, inputs, tags, and containers).
- No box shadows, no gradients, no glassmorphism, and no blur filters.
- Warm paper palette: paper (#F5F1E8), paper-2 (#EBE5D6), rule (#C9C1AE), ink (#1D1B17), ink-2 (#5A554B), brick (#9E3B1E), and moss (#2E5E3E).
- Text labels preferred over icons: fewer than 5 icons in the entire application.
- No emoji anywhere in copy, empty states, code, or seed data.
- No em dashes in documentation, user interface copy, comments, or commit messages.
- Tabular monospace numbers for all money amounts with Indian currency grouping (for example: ₹1,23,456.78).

## Money Engine and Settlement Math

All monetary values are calculated and stored as integer paise. Floating-point numbers are never used for currency arithmetic.

### 1. Split Calculations
- Equal Split: Divides total paise evenly among participants. Leftover paise are distributed deterministically using a hash of the expense identifier, ensuring the exact sum matches the total without always burdening the first participant.
- Percentage and Share Splits: Calculated using the Largest Remainder Method (Hare-Niemeyer method). Raw shares are floored, and leftover paise are assigned to the largest fractional remainders.
- Exact Split: Enforces that user-entered amounts sum precisely to the total expense amount. Any mismatch blocks submission and displays the exact unassigned amount.

### 2. Zero-Sum Invariant
Every expense and settlement strictly maintains zero net change across the group:
Sum of all net balances = 0

### 3. Greedy Debt Simplification
The settlement engine partitions participants into debtors (negative balance) and creditors (positive balance), sorted by descending magnitude. It iteratively transfers the minimum of the highest debtor and highest creditor until all balances reach zero. This guarantees complete debt clearance in no more than (k - 1) transfers, where k is the number of participants with non-zero balances.

## Tech Stack

- Framework: Next.js 15 (App Router) in TypeScript strict mode.
- Database and Auth: Supabase (PostgreSQL with Row Level Security, magic link, Google OAuth) via @supabase/ssr.
- Styling: Tailwind CSS with custom design tokens.
- Validation: Zod schemas shared between client and server.
- Unit and Property Testing: Vitest (77 tests covering RLS, money logic, property tests, UPI, and insights).
- End-to-End Testing: Playwright.
- Fonts: Newsreader, IBM Plex Sans, IBM Plex Mono via next/font/google.

## Local Development

### Prerequisites
- Node.js 20 or later.
- Docker (for local Supabase CLI) or a remote Supabase project.

### Setup Steps

1. Clone the repository and install dependencies:
   npm install

2. Configure environment variables in a .env.local file (see .env.example):
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   NEXT_PUBLIC_SITE_URL=http://localhost:3000

3. Run Supabase migrations and seed:
   npx supabase db reset

4. Run the development server:
   npm run dev

Open http://localhost:3000 in your browser.

## Test and Verification Suite

Run all verification scripts:

- Unit and property tests:
  npm run test

- Anti-slop rule enforcement:
  npm run check:anti-slop

- Typecheck:
  npm run typecheck

- Lint:
  npm run lint

- Production build:
  npm run build

- End-to-end tests:
  npm run test:e2e

## License

MIT
