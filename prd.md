# TripTabTally: Product Requirements

App name: TripTabTally.

## 1. Summary

A web app for a group of friends to plan a trip budget together, record who paid for what during the trip, and see exactly who owes whom at the end. The core promise is that nobody has to maintain a WhatsApp message thread or an Excel sheet to figure out the money.

## 2. Problem

On a group trip, one or two people usually pay for most things (hotel, cab, tickets) and the rest pay for small things in cash or UPI. At the end:

- Nobody remembers who paid for what.
- Splits are rarely equal (one person skipped the boat ride, two people shared a room).
- The group has no shared budget, so overspending is noticed only after the trip.
- Settling up takes many back-and-forth payments instead of the fewest possible.

Existing apps (Splitwise) handle splitting but have no trip budget, limited free usage, and no India-first settle-up flow (UPI).

## 3. Users

**Primary:** college students and early-career people in India, groups of 3 to 12, taking 2 to 10 day trips.

**Roles inside a trip:**

- **Admin:** created the trip. Can edit trip details, budget, members, and any expense.
- **Member:** can add expenses, edit their own, record settlements they are part of.
- **Placeholder member:** a person added by name who has no account yet. Can be claimed later when they join through the invite link.

## 4. Goals and non-goals

### Goals

1. Create a trip and invite friends in under 60 seconds.
2. Add an expense in under 15 seconds on a phone.
3. Show a trustworthy "who owes whom" at any point, not just at the end.
4. Show spending against a shared budget while the trip is happening.
5. Make settling up quick with the minimum number of payments and a UPI link per payment.

### Non-goals (MVP)

- No payment processing. The app never moves money. It only generates a UPI link and lets people mark a payment as done.
- No multi-currency conversion. One currency per trip, default INR.
- No itinerary builder, maps, bookings or flight search.
- No receipt scanning.
- No native mobile app. A responsive web app, installable as a PWA later.
- No AI-generated text. Insights come from plain calculations.

## 5. Core flows

### 5.1 Create a trip

1. Signed-in user taps "New trip".
2. Enters trip name, destination (optional), dates, total budget (optional), and their own display name for this trip.
3. Lands on the trip page with an invite link ready to copy.

### 5.2 Join a trip

1. Friend opens the invite link.
2. If signed out, signs in, then returns to the same invite.
3. Sees the trip name and the list of existing members.
4. Either picks "That's me" next to a placeholder name, or joins as a new member.

### 5.3 Add an expense

1. From the trip page, "Add expense".
2. Fields: title, amount, paid by (default: me), date (default: today), category, split.
3. Split defaults to equal among all members. User can deselect people, or switch to exact amounts, percentages, or shares.
4. Live preview under the form shows each person's share in rupees and confirms the shares add up to the total.
5. Pressing Enter in any field submits the form when it is valid.

### 5.4 Review balances

The trip page always shows each member's net position: paid so far, share of costs, and the net amount they are owed or owe.

### 5.5 Settle up

1. "Settle up" screen lists the minimum set of payments that clears all balances.
2. Each payment row shows payer, receiver, amount, and a "Pay by UPI" link if the receiver has saved a UPI ID.
3. After paying outside the app, either person can tap "Mark as paid", which records a settlement and updates balances.
4. When all balances are zero the trip shows a "Settled" state and can be archived.

## 6. Features by release

### MVP (build this first)

- Email magic link and Google sign-in
- Create, edit, archive trips
- Invite link with placeholder claim
- Expenses with four split types
- Fixed category list
- Trip budget (total) and optional per-category limits
- Balances per member
- Settle-up plan and manual settlement records
- Two charts and a short list of computed insights
- CSV export of all expenses and settlements

### v1.1

- Multiple payers on one expense
- Expense comments
- Edit history on an expense
- Dark theme refinements and PWA install
- Reminder message text to copy and send on WhatsApp (plain text, no integration)

### Later

- Recurring daily costs (for example, a fixed daily guide fee)
- Pre-trip planning checklist with estimated costs per item
- Receipt photo attachments

## 7. Functional requirements

Numbered so they can be referenced in tasks and tests.

**Accounts**

- FR-1. Users sign in with email magic link or Google.
- FR-2. Each user has a profile with a display name and an optional UPI ID.
- FR-3. Protected pages must be gated on the server. A signed-out visitor must never see any trip content, not even for a moment.

**Trips**

- FR-4. A trip has a name (required, 2 to 60 characters), optional destination, optional start and end dates (end not before start), a currency (INR default), and an optional total budget.
- FR-5. Only an admin can edit trip details, change the budget, remove members, or archive the trip.
- FR-6. A trip supports 2 to 20 members.
- FR-7. Invite links can be revoked and regenerated by an admin. A link expires after 14 days by default.

**Members**

- FR-8. An admin or member can add a placeholder member by name.
- FR-9. When a person joins by invite they may claim exactly one unclaimed placeholder, and all of that placeholder's past expenses and shares transfer to them.
- FR-10. A member who has any expense or share attached cannot be deleted. They can be marked as "left", which keeps history but removes them from new splits by default.

**Expenses**

- FR-11. An expense has a title (required, up to 80 characters), amount (required, positive, up to 2 decimal places), payer (a member), date, category, split definition, and an optional note.
- FR-12. Amounts are stored as integer paise. No floating point arithmetic anywhere in money logic.
- FR-13. Split types: equal, exact amounts, percentages, shares. Exact amounts must sum to the total. Percentages must sum to 100. Shares must be positive whole numbers.
- FR-14. When an amount cannot divide evenly, leftover paise are distributed one at a time so the total always matches exactly (see section 9).
- FR-15. The creator of an expense or an admin can edit or delete it. Deletion is soft, and the expense disappears from totals immediately.
- FR-16. Editing uses an optimistic version check. If someone else changed the expense in the meantime, the user is told and shown the latest values.
- FR-17. Expenses can be filtered by category, payer, member involved, and date, and sorted by date or amount. Filters must change the data shown, and the active filters must be visible in the URL.

**Budget**

- FR-18. Trip total budget is optional. Category limits are optional and independent of the total.
- FR-19. The trip page shows spent, remaining, and percent used against the total budget. If no budget is set it shows spent only.
- FR-20. A category crossing its limit is flagged on the budget screen in plain text.

**Balances and settlement**

- FR-21. Net balance for a member = paid for expenses, minus their shares, plus settlements they made, minus settlements they received.
- FR-22. The settle-up plan produces transfers that clear all balances, using no more than (number of members with a non-zero balance minus 1) transfers.
- FR-23. A settlement record has payer, receiver, amount, date, and optional note. Either party or an admin can create or void one.
- FR-24. A "Pay by UPI" link is shown only if the receiver has a UPI ID. It opens the user's UPI app with amount and note prefilled.

**Insights and export**

- FR-25. Insights are generated from fixed templates and real numbers. Examples are in section 11.
- FR-26. Any member can export all trip expenses and settlements as CSV.

## 8. Screens

Each screen has a plain, specific name. Do not label UI blocks with their implementation names.

| Screen | Purpose |
| --- | --- |
| Home | List of the user's trips, active first, archived collapsed at the bottom. |
| New trip | Single form. |
| Trip | The working page. Top: name, dates, budget bar. Then balances, then expense list. |
| Add / edit expense | Form with live split preview. Opens as its own page on mobile and as a side panel on wide screens. |
| People | Members, invite link, placeholders, UPI IDs the person has shared. |
| Budget | Total and per-category limits against actual spend, with two charts. |
| Settle up | The payment plan and the history of recorded settlements. |
| Join | What an invited person sees before joining. |
| Profile | Display name, UPI ID, sign out. |
| Not found and Error | Custom pages that explain what happened and link back to the trips list. |

### Trip page layout

- Narrow screens: single column. Budget bar, balances table, expense list. Navigation is a plain text tab row at the top (Expenses, People, Budget, Settle up), not a floating bar.
- Tablet: two columns. Left holds balances and budget summary, right holds the expense list.
- Desktop and ultrawide: content is capped at a readable width and centred. The add-expense form opens in a right panel beside the list. Nothing stretches to fill a 2560px screen.

## 9. Money rules

All amounts in integer paise internally. Display in Indian grouping (for example, ₹1,24,500.50). Hide ".00" when the value is whole in lists, always show two decimals in forms and totals.

**Equal split.** `base = floor(total / n)`, `remainder = total mod n`. Every person gets `base`. The first `remainder` people in a stable order each get one extra paisa. The stable order is rotated by a number derived from the expense ID, so the same person is not always the one who pays the extra paisa.

**Percentage split.** Convert each percentage to a raw share, floor it, then hand out leftover paise to the largest fractional remainders (largest remainder method).

**Shares split.** Same as percentage, using share weights.

**Exact split.** Entered amounts are used as is and must sum to the total. If they do not, the form shows the difference ("₹40 still unassigned") and does not submit.

**Settle-up plan.** Compute each member's net balance. Repeatedly match the person owed the most with the person who owes the most, transfer the smaller of the two amounts, and continue until all are zero. This is a greedy approach. It is not guaranteed to produce the theoretical minimum transfers in every case, but it never exceeds (non-zero members minus 1) and is easy for users to follow.

**Invariant.** The sum of all net balances in a trip must always equal zero. This is checked in tests and in a database consistency query.

## 10. Design direction

The product should feel like a well-kept paper ledger: calm, legible, factual. It should look designed by a person who cares about numbers.

### Look

- **Background:** warm off-white paper, not pure white. Text is near-black ink with a warm tint.
- **Accent:** one brick red used for primary actions, links, and amounts a person owes. A muted green is used only for amounts a person is owed and for the settled state. No purple, no neon, no gradients.
- **Structure:** 1px ruled lines to separate rows and sections. No cards. No shadows. No glassmorphism.
- **Corners:** square. Border radius is 0 everywhere, including buttons, inputs, tags and images.
- **Typography:** a serif for page titles and trip names, a clean sans for interface text, a monospace with tabular figures for every money amount so columns align. Left-align numbers in forms, right-align them in tables.
- **Dark theme:** warm near-black with cream text, following the system setting. Not slate gray.

### Interaction

- **Hover:** subtle. Rows tint slightly, links underline. No lift, no scale, no shadow change. Transitions are 100 to 150 ms, on colour only.
- **Focus:** visible 2px outline in the accent colour with offset, on every interactive element.
- **Icons:** text first. Use an icon only where text cannot do the job. The app should have fewer than five icons in total, and none next to nav items, tabs, or ordinary buttons.
- **Emoji:** none anywhere in the interface, copy, or empty states. Category labels are text.
- **Motion:** none beyond colour transitions and a short fade for panels. Respect `prefers-reduced-motion`.
- **Loading:** most data renders on the server, so there is nothing to load. Where something is genuinely slow (charts), reserve the exact space and show a short text line, not an elaborate skeleton.
- **Forms:** real form elements. Enter submits. Correct input types and `inputmode` (decimal for amounts, tel for phone). Errors appear inline next to the field and are announced to screen readers. Never use `alert()`.
- **Feedback:** after a save, show a specific message with real values (examples in section 11), not a generic success line. Keep it in a fixed place, not floating over content.

### Layout

- Designed and tested at 360, 480, 768, 1024, 1280, 1536, and 1920+ wide, including landscape phones and portrait tablets.
- No nested scroll areas. The page scrolls, tables inside it scroll horizontally only if truly needed, and long text wraps instead of being clipped.
- No floating navigation, no floating action button.
- No bento grids. The layout is a plain ledger: sections stacked, columns only where the data is actually tabular or where a tablet screen has the width to spare.

### Charts

Two charts only, hand-drawn in SVG with direct labels and no legend:

1. Spend by category, horizontal bars sorted by amount, with limit marks where a limit exists.
2. Spend per day, vertical bars, with a line for the planned daily average if a budget and dates exist.

Chart colours come from the same palette: ink for bars, brick for anything over limit.

### Branding

- Custom favicon and app icon: a simple mark, not the framework default.
- Page titles are specific ("Goa, Dec 2026 | TripTabTally").
- Footer on the public pages only: how settlement is calculated, export data, contact address, version. No copyright filler and no dead links. Inside the app there is no footer.

## 11. Copy and voice

Plain, short, specific. Written the way a friend who keeps the accounts would write. Indian English spellings and rupee symbol. No marketing language, no exclamation marks, no em dashes.

### Examples

| Situation | Text |
| --- | --- |
| Expense saved | Added "Cab to Candolim", ₹1,200 split between 4. Rohan paid. |
| Expense deleted | Removed "Cab to Candolim". Totals updated. Undo |
| Split does not add up | ₹40 is not assigned to anyone yet. |
| Percentages wrong | Percentages add up to 96. They need to add up to 100. |
| Balance line, owed | Meera gets back ₹2,340 |
| Balance line, owes | Karan owes ₹1,180 |
| All even | Everyone is even |
| Budget insight | Food is ₹3,200 over its limit of ₹8,000. |
| Pace insight | You are spending ₹2,350 a day against ₹2,000 planned. |
| Settled | All settled. 5 payments recorded. |
| Empty trip | No expenses yet. The first one is usually the hotel or the cab. |
| Empty home | You have no trips. Start one and send the link to your group. |
| Invite revoked | This invite link is no longer active. Ask the trip admin for a new one. |
| Network error on save | Could not save. Your entries are still here. Try again. |
| 404 | There is no page at this address. Go to your trips. |

### Words to avoid

"Seamless", "empower", "next-generation", "effortless", "supercharge", "unlock", "revolutionise", "all-in-one", "journey" (as a metaphor), "delightful". Also avoid naming UI blocks after what they are technically (for example "Dashboard Grid", "Analytics Panel", "Action Bar").

Do not write micro-copy that reveals build constraints, such as "Maximum of 20 members as per requirements". Say "A trip can have up to 20 people" if the limit needs saying at all.

## 12. Edge cases

- Expense paid by someone who is not part of the split (paid for others only). Allowed.
- Expense where the only person in the split is the payer. Allowed, no effect on balances.
- Member leaves after having expenses. Marked as left, history kept, excluded from default splits.
- Placeholder claimed by someone who also already has a different member row in the same trip. Blocked with a clear message.
- Two people edit the same expense at once. Version check on save.
- Amount of 0, negative, text, or more than 2 decimals. Rejected inline.
- Very large amounts. Capped at ₹1,00,00,000 per expense.
- Dates outside the trip dates. Allowed with a gentle note, since pre-trip bookings are common.
- Trip with no budget set. Budget UI shows spent only and a link to set a budget.
- Settlement recorded for more than owed. Blocked, with the remaining amount shown.
- Deleting an expense that is part of a recorded settlement. Allowed, balances and plan recalculate, and recorded settlements remain as they were.
- Signed-in user opens a trip they are not a member of. Shown the not-found page, not an error that confirms the trip exists.
- Offline or flaky network during add. Form values kept and a retry offered.

## 13. Success metrics

Early targets for a college launch:

- 15 to 25 real users across at least 4 real trips.
- Median time from opening the form to saved expense under 20 seconds.
- Settle-up plan never produces a mismatch against a hand check (verified in tests and on two real trips).
- At least 70 percent of trips reach a "Settled" state.
- Lighthouse performance 90 or above on the trip page on a mid-range phone profile.

Track these with a small private analytics table or Vercel Analytics. No third-party trackers.

## 14. Milestones

1. **Foundation:** project scaffold, design tokens, auth, database schema with row-level security.
2. **Trips and people:** create trip, invite, join, placeholder claim.
3. **Expenses:** add, edit, delete, four split types, filters.
4. **Money engine:** balances, settle-up plan, settlement records, full unit tests.
5. **Budget and insights:** budget bar, category limits, two charts, insight sentences.
6. **Finish:** CSV export, error and empty states, favicon, responsive pass at every breakpoint, accessibility pass, README with screenshots and a short walkthrough of how settlement works.
7. **Real use:** run it on one actual trip with friends, fix what breaks, then put the user count in the README.

## 15. Acceptance checklist (anti-slop)

Before calling it done, every item must be true:

- [ ] No em dashes anywhere: UI copy, code comments, README, commit messages.
- [ ] Border radius is 0 across the app.
- [ ] No box shadows, no glass effects, no gradients.
- [ ] Hover states change colour only.
- [ ] No emoji anywhere. Fewer than five icons in total.
- [ ] Palette is the paper, ink, brick and green set, not default shadcn slate with a neon accent.
- [ ] No bento layout, no floating navbar, no floating action button.
- [ ] Every filter, sort, tab and toggle changes real data.
- [ ] Every form submits on Enter and validates types on both client and server.
- [ ] Protected pages are gated on the server with no flash of private content.
- [ ] No double scrollbars at any width from 320 to 2560.
- [ ] Loading states are honest and small. No elaborate skeletons for simple data.
- [ ] No browser `alert()`. Errors and not-found states are designed.
- [ ] Custom favicon, specific page titles, no framework default branding.
- [ ] Copy has no buzzwords, no generic "Success" messages, no leaked build constraints.
- [ ] Settlement logic has unit tests, including rounding and the zero-sum invariant.
- [ ] README includes screenshots, tech stack, live link, and the real user count.
