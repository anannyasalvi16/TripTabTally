# Starter prompt for Antigravity

Paste everything below the line into the first message. Keep `prd.md` and `trd.md` in the project root so the agent can read them.

---

You are building TripTabTally, a web app for friends on a group trip to set a shared budget, record who paid for what, and settle up at the end.

## Read first

1. Read `prd.md` fully.
2. Read `trd.md` fully.
3. Do not write any code until you have replied with a short plan (under 40 lines) that lists the build phases, the files you will create in phase 1, and any questions where the documents conflict or are unclear. Wait for my reply.

The two documents are the source of truth. If something is missing, ask. Do not invent features, pages or copy that are not in them.

## Stack

Next.js App Router, TypeScript strict, Tailwind with custom tokens, Supabase (Postgres, Auth, RLS) with `@supabase/ssr`, Zod, Vitest, Playwright. Hosted on Vercel. Do not add shadcn/ui, Lucide, Framer Motion, a toast library or an icon pack.

## Non-negotiable rules

These apply to code, comments, copy, commit messages and the README.

**Typography and copy**
- No em dashes. Use a comma, a full stop or a colon instead.
- No emoji.
- No marketing words: seamless, empower, next-generation, effortless, unlock, supercharge, all-in-one.
- Success and error messages must be specific and include real values, for example `Added "Cab to Candolim", ₹1,200 split between 4. Rohan paid.` Never `Success` or `Operation completed successfully`.
- Name UI sections by what the user sees, not by what you built. No "Analytics Grid View" or "User Action Panel".
- Do not put build constraints into micro-copy.

**Visual**
- Border radius 0 everywhere. Set it in the Tailwind theme so it cannot leak back in.
- No box shadows, no gradients, no glass or blur effects.
- Use the paper, ink, brick and moss tokens from `trd.md` section 8. Do not use default shadcn slate, and no purple, blue or emerald accents.
- Separate content with 1px rules, not cards.
- No bento grids, no floating navbar, no floating buttons.
- Hover changes colour only. No lift, scale or shadow.
- Fewer than five icons in the whole app. Text labels instead of icons on buttons, tabs and nav.
- Money amounts use the mono font with tabular figures.

**Behaviour**
- Every control must work. Filters, sorting and tabs change real data and live in the URL. No decorative UI.
- Forms use real `<form>` elements and submit on Enter. Use correct `type` and `inputMode`, and validate with Zod on both client and server.
- Protected routes are gated on the server. No flash of private content, no client-only redirects.
- No `alert()`, `confirm()` or `prompt()`. Handle errors with inline messages and designed error and not-found pages.
- No nested scrollbars and no `overflow: hidden` on text containers. Check every width from 320 to 2560, including a portrait tablet at 820 and an ultrawide at 1920 or more.
- Loading states are small and honest. Fetch on the server so most pages need no loader. No detailed skeletons.
- Custom favicon and specific page titles. No framework default branding.
- No large images. The landing page has no hero art.

**Money**
- Store and calculate money as integer paise. Never use floating point for money.
- All split, balance and settlement logic lives in `src/lib/money`, as pure functions with unit tests. The UI and server actions call these functions and never reimplement them.
- Balances in a trip must always sum to zero. Add a test for it.

## Build phases

Work one phase at a time. At the end of each phase, stop, run the checks, summarise what changed in under 10 lines, and wait for my go-ahead.

**Phase 0, foundation.** Scaffold the project, set up Tailwind tokens (radius 0, no shadows), fonts, base layout, custom favicon, ESLint and a CI script that fails on em dashes, emoji, `alert(`, `rounded-` and `shadow-` in `src`.

**Phase 1, database and auth.** Supabase migrations from `trd.md` section 3, RLS from section 4, `join_trip` and `save_expense` functions, seed data, magic link and Google sign-in, server-side route gating, and the two-user RLS test.

**Phase 2, trips and people.** Create trip, trips list, trip layout with membership check, people page, invite link, join page with placeholder claim.

**Phase 3, money engine.** Parser, formatter with Indian grouping, split functions, balances, settlement planner, and all unit tests listed in `trd.md` section 6, including the property tests. No UI work in this phase.

**Phase 4, expenses.** Add, edit and delete with the live split preview, version conflict handling, URL-based filters and sorting, and the expense list that collapses correctly on narrow screens.

**Phase 5, budget and settle up.** Budget bar, category limits, the two SVG charts, template insights, settle-up plan, manual settlements, UPI link, settled state.

**Phase 6, finish.** CSV export, empty, error and not-found pages, profile and account deletion, responsive pass at every width in `trd.md` section 8, accessibility pass, Playwright flows, README with screenshots.

## Self-review before each handoff

Before you tell me a phase is done, check your own work against this list and report any item that fails:

- Search the diff for em dashes, emoji, `rounded`, `shadow`, `gradient`, `alert(`, `localStorage` used for auth, and `lorem`.
- Confirm every new control changes real data or navigates somewhere real.
- Confirm every new form submits with Enter and shows inline errors.
- Confirm no new file in `components/` imports an icon library.
- Confirm all new money logic is covered by tests.
- List anything you skipped, simplified or guessed.

## How to respond to me

- Be brief. Plain sentences. No celebration, no filler.
- When something in the documents looks wrong or risky, say so and propose a fix before building around it.
- Do not refactor or restyle code from earlier phases unless I ask or a bug requires it.

Start now with the plan described in "Read first". Do not write code yet.
