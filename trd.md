# TripTabTally: Technical Requirements

Read `prd.md` first. This document explains how to build what the PRD describes. Requirement IDs (FR-n) refer to the PRD.

## 1. Stack

| Layer | Choice | Reason |
| --- | --- | --- |
| Framework | Next.js (App Router) with TypeScript, strict mode | Server components allow server-side auth gating (FR-3) and keep client JS small |
| Hosting | Vercel, functions in the Mumbai region (`bom1`) | Low latency for users in India |
| Database and auth | Supabase (Postgres, Auth), project in the Mumbai region | Row-level security, magic link, Google OAuth, free tier is enough |
| Auth client | `@supabase/ssr` | Cookie-based sessions readable on the server |
| Styling | Tailwind CSS with custom design tokens, no component library | Avoids the default shadcn look. Components are written by hand |
| Validation | Zod, shared between client and server | One schema per form and server action |
| Charts | Hand-written SVG components | Full control over look, tiny bundle |
| Testing | Vitest for logic, Playwright for three end-to-end flows | Money logic must be provably correct |
| Fonts | `next/font/google`: Newsreader, IBM Plex Sans, IBM Plex Mono | Self-hosted at build, no layout shift |
| Linting | ESLint, Prettier, `tsc --noEmit` in CI | |

Do not add: shadcn/ui, Lucide, Framer Motion, a toast library, a state management library, or an icon pack. If something is needed that is not listed, write it.

## 2. Project structure

```
src/
  app/
    (public)/
      page.tsx                 landing
      join/[token]/page.tsx
      login/page.tsx
    (app)/
      layout.tsx               checks session on the server, redirects if none
      trips/page.tsx
      trips/new/page.tsx
      trips/[tripId]/
        layout.tsx             checks membership, renders trip header and tabs
        page.tsx               expenses and balances
        expenses/new/page.tsx
        expenses/[expenseId]/page.tsx
        people/page.tsx
        budget/page.tsx
        settle/page.tsx
      profile/page.tsx
    not-found.tsx
    error.tsx
    icon.svg                   custom favicon
    opengraph-image.tsx        small, generated, no stock art
  components/                  hand-written UI primitives
  lib/
    money/
      format.ts                paise to display, Indian grouping
      parse.ts                 input string to paise
      split.ts                 split calculators
      balances.ts              net balances
      settle.ts                settle-up plan
      *.test.ts
    supabase/
      server.ts
      browser.ts
    schemas/                   Zod schemas
    insights.ts                template-based insight sentences
    upi.ts                     UPI link builder
  actions/                     server actions, one file per domain
supabase/
  migrations/
  seed.sql
```

## 3. Data model

All money columns are `bigint` paise. All tables have RLS enabled.

```sql
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  upi_id text check (upi_id ~ '^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$'),
  created_at timestamptz not null default now()
);

create table trips (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 60),
  destination text check (char_length(destination) <= 80),
  start_date date,
  end_date date,
  currency char(3) not null default 'INR',
  budget_paise bigint check (budget_paise > 0),
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  check (end_date is null or start_date is null or end_date >= start_date)
);

create table trip_members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  user_id uuid references profiles(id),            -- null for placeholders
  display_name text not null check (char_length(display_name) between 1 and 60),
  role text not null default 'member' check (role in ('admin','member')),
  left_at timestamptz,
  joined_at timestamptz,
  unique (trip_id, user_id)
);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  amount_paise bigint not null check (amount_paise > 0 and amount_paise <= 1000000000),
  category text not null check (category in ('stay','food','transport','activities','shopping','other')),
  paid_by uuid not null references trip_members(id),
  spent_on date not null,
  note text check (char_length(note) <= 300),
  split_type text not null check (split_type in ('equal','exact','percent','shares')),
  split_input jsonb,                               -- original inputs, used to prefill the edit form
  created_by uuid not null references trip_members(id),
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table expense_splits (
  expense_id uuid not null references expenses(id) on delete cascade,
  member_id uuid not null references trip_members(id),
  share_paise bigint not null check (share_paise >= 0),
  primary key (expense_id, member_id)
);

create table settlements (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  from_member uuid not null references trip_members(id),
  to_member uuid not null references trip_members(id),
  amount_paise bigint not null check (amount_paise > 0),
  paid_on date not null default current_date,
  note text check (char_length(note) <= 200),
  created_by uuid not null references trip_members(id),
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  check (from_member <> to_member)
);

create table category_limits (
  trip_id uuid not null references trips(id) on delete cascade,
  category text not null,
  limit_paise bigint not null check (limit_paise > 0),
  primary key (trip_id, category)
);

create table invites (
  token text primary key,                          -- 22+ chars, url-safe random
  trip_id uuid not null references trips(id) on delete cascade,
  created_by uuid not null references profiles(id),
  expires_at timestamptz not null default (now() + interval '14 days'),
  revoked_at timestamptz
);

create index on expenses (trip_id, spent_on desc) where deleted_at is null;
create index on expense_splits (member_id);
create index on settlements (trip_id) where voided_at is null;
create index on trip_members (user_id);
```

### Integrity rules enforced in the database

- A trigger on `expense_splits` insert and update checks that `sum(share_paise)` for an expense equals `expenses.amount_paise` (deferred constraint trigger, checked at commit).
- A trigger bumps `expenses.version` and `updated_at` on update.
- A trigger blocks deleting a `trip_members` row that is referenced by any expense, split or settlement.
- Each trip must keep at least one admin. Enforced in the server action and double-checked by a trigger.

## 4. Row-level security

Helper functions (security definer, stable):

```sql
create function is_trip_member(t uuid) returns boolean
  language sql security definer stable as $$
    select exists (select 1 from trip_members where trip_id = t and user_id = auth.uid());
  $$;

create function is_trip_admin(t uuid) returns boolean
  language sql security definer stable as $$
    select exists (select 1 from trip_members where trip_id = t and user_id = auth.uid() and role = 'admin');
  $$;
```

Policies, summarised:

| Table | Select | Insert | Update | Delete |
| --- | --- | --- | --- | --- |
| profiles | self, and members who share a trip (for display name and UPI ID) | self | self | none |
| trips | members | any signed-in user (creator becomes admin through the create function) | admins | none (archive instead) |
| trip_members | members of the same trip | members (placeholders), join function (real users) | admins, or self for own display name | none |
| expenses | members | members | creator or admin | none (soft delete only) |
| expense_splits | members | with parent expense | with parent expense | with parent expense |
| settlements | members | members where the user is `from_member`, `to_member`, or admin | creator or admin (void only) | none |
| category_limits | members | admins | admins | admins |
| invites | admins | admins | admins | none |

Joining is done through a `join_trip(token, claim_member_id)` security-definer function. It validates the token, checks expiry and revocation, and either claims the placeholder (updating `user_id`) or inserts a new member. No client has direct insert rights on `trip_members.user_id`.

Server actions always use the signed-in user's session. The service role key is never used in request handling and is never exposed to the browser.

## 5. Auth and route protection

- `middleware.ts` refreshes the Supabase session cookie and redirects unauthenticated requests for `(app)` routes to `/login?next=...`.
- `(app)/layout.tsx` also reads the user on the server and redirects if missing. Middleware is a convenience, the layout check is the real gate.
- `trips/[tripId]/layout.tsx` loads the member row for the current user. If none, it calls `notFound()`. This avoids confirming that a trip exists.
- No protected data is fetched in client components on mount. Data comes from server components or server actions, so there is no flash of private content (FR-3).
- Login supports email magic link and Google. After login, the `next` parameter is validated against an allowlist of internal paths to prevent open redirects.

## 6. Money logic

Lives in `src/lib/money`. Pure functions, no I/O, fully unit tested. The rest of the app must call these and never re-implement them.

```ts
type Paise = number; // integer, safe up to 2^53, our cap is far below that

splitEqual(total: Paise, memberIds: string[], seed: string): Record<string, Paise>
splitExact(total: Paise, amounts: Record<string, Paise>): Result<Record<string, Paise>>
splitPercent(total: Paise, pct: Record<string, number>): Result<Record<string, Paise>>
splitShares(total: Paise, shares: Record<string, number>): Result<Record<string, Paise>>

computeBalances(members, expenses, splits, settlements): Record<string, Paise>
planSettlement(balances: Record<string, Paise>): Array<{ from: string; to: string; amount: Paise }>
```

### Rules

- `parse.ts` accepts strings like `1200`, `1,200`, `1200.5`, `₹1,200.50`. It rejects more than 2 decimals, negative numbers, letters, and empty input. It returns an integer number of paise using string handling, not `parseFloat * 100`.
- `splitEqual`: `base = Math.floor(total / n)`, `rem = total % n`. Members are sorted by ID, rotated by `hash(seed) % n`, and the first `rem` get `base + 1`. Result always sums to `total`.
- `splitPercent` and `splitShares`: floor each raw share, then distribute leftover paise to the largest fractional remainders, ties broken by sorted member ID.
- `computeBalances`: for each member, `paid - owed + settlementsPaid - settlementsReceived`. Ignore soft-deleted expenses and voided settlements.
- `planSettlement`: split into creditors (positive) and debtors (negative), sort each descending by absolute amount, repeatedly match the top of each list, transfer `min(a, b)`, remove anyone who reaches zero. Throws if balances do not sum to zero.

### Tests required (Vitest)

- Equal split of ₹100 among 3 sums to exactly 10000 paise, with the extra paisa not always on the same person across different seeds.
- Equal split where `total < n` (for example 2 paise among 5 people).
- Percent split such as 33.33, 33.33, 33.34 and 33.333 style inputs.
- Shares split with weights 1, 2, 3 on an amount that does not divide evenly.
- Exact split mismatch returns an error with the difference.
- Balances sum to zero for 1,000 randomly generated trips (property test, fixed seed).
- Plan length is at most (non-zero balances minus 1) for those random trips.
- Applying the plan as settlements brings every balance to zero.
- Parser accepts and rejects the cases listed above.
- Formatter outputs Indian grouping: `12345678` paise gives `₹1,23,456.78`.

## 7. Server actions

One file per domain in `src/actions`. Every action:

1. Parses input with a Zod schema.
2. Gets the user from the server session.
3. Performs the write through the user-scoped Supabase client so RLS applies.
4. Returns a typed result: `{ ok: true, data }` or `{ ok: false, fieldErrors?, message }`.
5. Calls `revalidatePath` for affected routes.

Messages in `message` are written in the voice described in PRD section 11 and include real values.

`updateExpense` takes the `version` the client last saw. The update uses `where id = $1 and version = $2`. Zero rows updated means a conflict, and the action returns the current expense so the UI can show what changed (FR-16).

Expense create and update write the expense row and its `expense_splits` in a single database function (`save_expense(...)`) so they are atomic and the sum constraint is checked once at commit.

## 8. Frontend rules

### Design tokens (Tailwind theme)

```
paper        #F5F1E8     background
paper-2      #EBE5D6     row hover, input background
rule         #C9C1AE     1px lines
ink          #1D1B17     primary text
ink-2        #5A554B     secondary text
brick        #9E3B1E     primary action, owes, over limit
brick-dark   #7C2D15     hover for brick
moss         #2E5E3E     owed to you, settled
```

Dark values are defined on the same variable names under `prefers-color-scheme: dark`:

```
paper #17150F   paper-2 #221F17   rule #3C3729   ink #ECE6D6   ink-2 #A39C89   brick #D2694A   moss #7DB08B
```

Contrast of text on background must meet WCAG AA in both themes. Check with a script in CI.

Tailwind config:

- `borderRadius`: set every value to `0`, including `DEFAULT`.
- `boxShadow`: set to `none` only. Remove all other shadow utilities.
- No gradient utilities in the theme.
- Spacing on a 4px scale. Container max width around 72rem, with a narrower 40rem reading width for forms.

### Components to hand-write

`Button`, `LinkButton`, `Field` (label, input, hint, error), `MoneyInput`, `Select`, `RadioGroup`, `Table`, `Tabs` (plain links with an active underline), `Panel` (side panel for wide screens), `Notice` (inline message area), `EmptyState`, `Amount` (formats and colours money), `BarChart`, `HBarChart`.

Rules for them:

- `Button` variants: primary (brick fill), secondary (1px ink border), text. No icon slots.
- `MoneyInput`: `type="text"`, `inputMode="decimal"`, `autoComplete="off"`, strips invalid characters as the user types, formats on blur, and passes paise to the form.
- `Amount` uses the mono font with `font-variant-numeric: tabular-nums`.
- `Notice` renders in a fixed region at the top of the content column, uses `aria-live="polite"`, and clears itself on the next navigation or after the user dismisses it. It is not a floating toast.
- Hover styles: colour or background-colour change only, 120 ms.
- Focus styles: `outline: 2px solid var(--brick); outline-offset: 2px`. Never remove outlines without a replacement.
- No `transform` or `box-shadow` on hover or focus.

### Responsive behaviour

Test at these widths: 320, 360, 480, 640, 768, 820 (portrait tablet), 1024, 1280, 1536, 1920, 2560.

- Under 768: single column. Expense table rows collapse to two lines (title and amount on the first, payer, category and date on the second) separated by rules. Not cards.
- 768 to 1279: two columns. Balances and budget summary on the left, expenses on the right.
- 1280 and above: same two columns, with the add or edit expense form opening in a side panel next to the list. Content is capped and centred. Nothing grows beyond the max width.
- Landscape phones (short viewport height): the sticky header is not sticky.
- Use `min-h-dvh` instead of `100vh`. Avoid `overflow: hidden` on any container that holds text. The page is the only vertical scroller. Tables get `overflow-x: auto` only on their own wrapper.

### Loading and empty states

- Fetch on the server so pages arrive complete.
- Use `Suspense` only around the charts, with a placeholder of the exact final height containing one line of text ("Loading spend by day"). No shimmer skeletons.
- Every list has a written empty state (PRD section 11).
- `error.tsx` and `not-found.tsx` are designed pages with a link back. Server action failures show a `Notice`. No `alert()`, `confirm()` or `prompt()`. Destructive actions use an inline confirm step in the page.

### Forms

- Use `<form action={serverAction}>` with `useActionState`, so Enter submits and the form works before hydration.
- Inputs have proper `type`, `inputMode`, `maxLength`, `min`, `max`, `step` and `required` attributes. Validate with Zod on the server and mirror the key checks on the client.
- Errors are rendered next to the field with `aria-describedby`, and focus moves to the first invalid field.
- The expense form's split preview is computed on the client with the same `lib/money` functions the server uses.
- The submit button disables only while the request is in flight, and the label changes to describe the action ("Saving expense").

### Filters, sorting, tabs

- Filters and sorting are URL search params (`?category=food&payer=...&sort=amount_desc`). The server component reads them and queries accordingly. Nothing decorative: if a control exists it changes the query (FR-17).
- Tabs are links to routes, not client-side state.

### Charts

- `HBarChart` and `BarChart` are SVG components taking plain data arrays.
- Direct labels on bars, axis lines minimal, no legend, no animation.
- Colours from tokens only. `role="img"` with an `aria-label` that states the main takeaway, and a visually hidden table with the same data.

### Icons and emoji

- No icon library. The only SVGs allowed are the favicon and logo mark, a sort direction mark in table headers, and a close mark for the side panel. Everything else uses text.
- No emoji in source files, copy, or seed data.

## 9. Insights

`lib/insights.ts` returns up to four sentences from these templates, only when the numbers justify them:

1. Over-limit category: `{Category} is {amount} over its limit of {limit}.`
2. Largest category: `{Category} is {pct}% of what you have spent so far.`
3. Pace (needs budget and dates): `You are spending {perDay} a day against {plannedPerDay} planned.`
4. Biggest payer: `{Name} has paid {amount}, which is {pct}% of all spending.`

No language model is involved. Each template has a unit test.

## 10. UPI link

`lib/upi.ts` builds:

```
upi://pay?pa={upiId}&pn={receiverName}&am={amount with 2 decimals}&cu=INR&tn={note}
```

All values are URL-encoded. The note is `{Trip name} settle up`, trimmed to 50 characters. The link is shown as a normal text link ("Pay by UPI"). On desktop, show the UPI ID with a copy action instead, since `upi://` links do not open there. The app does not verify that a payment happened. Marking as paid is a manual confirmation.

## 11. Performance and assets

- No hero image. The landing page is text and a single plain screenshot.
- Any image is compressed, sized correctly, and served through `next/image`.
- Only the three font families listed, `display: swap`, subsets limited to Latin.
- Target: first load JS under 120 KB gzipped on the trip page, Lighthouse performance 90 or above.
- Server components by default. Add `"use client"` only for the expense form, the money input, and the side panel.

## 12. Security and privacy

- RLS on every table. Test it with two users in a Playwright or SQL test: user B cannot read or write user A's trip.
- Rate limit invite joining and magic link requests (Supabase built-in limits plus a small check in `join_trip`).
- Invite tokens are random, at least 128 bits, and never logged.
- UPI IDs are visible only to members of shared trips.
- Escape all user text on render. No `dangerouslySetInnerHTML`.
- Add a data deletion route in Profile that removes the account and anonymises that person's name on trips where they have history.
- Headers: `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` set in `next.config`.

## 13. Environment and deployment

Environment variables:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_SITE_URL
```

The service role key is used only in local seed scripts and never set in Vercel runtime variables.

Deployment steps:

1. Create the Supabase project in the Mumbai region. Run migrations from `supabase/migrations`.
2. Configure Google OAuth and the magic link redirect URLs for local, preview and production.
3. Connect the GitHub repo to Vercel. Set the function region to `bom1`.
4. Add environment variables for Preview and Production.
5. Use a separate Supabase project (or schema) for previews so test data never mixes with real trips.

CI (GitHub Actions): install, `tsc --noEmit`, lint, Vitest, a script that fails the build if it finds an em dash, an emoji, `alert(`, `rounded-`, or `shadow-` in `src`, then Playwright on pull requests.

## 14. End-to-end tests (Playwright)

1. **Sign in, create trip, add three expenses with different split types, see correct balances.**
2. **Invite flow:** open invite in a second browser context, claim a placeholder, confirm that history moved to the new member.
3. **Settle up:** generate the plan, mark every payment as paid, confirm every balance reads zero and the trip shows the settled state.

Add one accessibility check with axe on the trip page and the add-expense page.

## 15. Definition of done

- All FR items in the PRD are implemented or explicitly deferred in the README.
- Unit tests pass, including the money property tests.
- Two-user RLS test passes.
- The anti-slop checklist in PRD section 15 is fully ticked, with a screenshot of the trip page at 360, 820 and 1920 widths attached to the README.
- The app has been used for at least one real trip by real people.
