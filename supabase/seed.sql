-- Seed data for TripTabTally local development and testing

-- Profiles
insert into public.profiles (id, display_name, upi_id)
values
  ('11111111-1111-1111-1111-111111111111', 'Rohan Mehta', 'rohan@okaxis'),
  ('22222222-2222-2222-2222-222222222222', 'Meera Iyer', 'meera@oksbi'),
  ('33333333-3333-3333-3333-333333333333', 'Karan Verma', 'karan@okhdfcbank'),
  ('44444444-4444-4444-4444-444444444444', 'Priya Sharma', null)
on conflict (id) do update set
  display_name = excluded.display_name,
  upi_id = excluded.upi_id;

-- Sample Trip: Goa Dec 2026
insert into public.trips (
  id, name, destination, start_date, end_date, currency, budget_paise, created_by
) values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Goa Trip',
  'Goa',
  '2026-12-10',
  '2026-12-15',
  'INR',
  5000000, -- Rs 50,000
  '11111111-1111-1111-1111-111111111111'
) on conflict (id) do nothing;

-- Trip Members (including Kabir as a placeholder member with null user_id)
insert into public.trip_members (
  id, trip_id, user_id, display_name, role
) values
  ('baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Rohan Mehta', 'admin'),
  ('baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'Meera Iyer', 'member'),
  ('baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'Karan Verma', 'member'),
  ('baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'Priya Sharma', 'member'),
  ('baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, 'Kabir', 'member')
on conflict do nothing;

-- Category Limits
insert into public.category_limits (trip_id, category, limit_paise)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'stay', 2500000),      -- Rs 25,000
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'food', 1500000),      -- Rs 15,000
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'transport', 1000000)  -- Rs 10,000
on conflict do nothing;

-- Invite Link
insert into public.invites (token, trip_id, created_by, expires_at)
values (
  'goa2026secretinvitekey128',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  now() + interval '14 days'
) on conflict (token) do nothing;

-- Sample Expense 1: Villa Advance (Stay) paid by Rohan, split equally among all 5
insert into public.expenses (
  id, trip_id, title, amount_paise, category, paid_by, spent_on, note,
  split_type, split_input, created_by, version
) values (
  'caaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Villa Booking Advance',
  2000000, -- Rs 20,000
  'stay',
  'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  '2026-12-10',
  'Booking for Anjuna villa',
  'equal',
  '{"member_ids": ["baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1", "baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2", "baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3", "baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4", "baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5"]}'::jsonb,
  'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  1
) on conflict (id) do nothing;

insert into public.expense_splits (expense_id, member_id, share_paise)
values
  ('caaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 400000),
  ('caaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 400000),
  ('caaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 400000),
  ('caaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4', 400000),
  ('caaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5', 400000)
on conflict do nothing;

-- Sample Expense 2: Airport Cab paid by Meera (Rs 1,800 split equal between 3: Meera, Karan, Priya)
insert into public.expenses (
  id, trip_id, title, amount_paise, category, paid_by, spent_on, note,
  split_type, split_input, created_by, version
) values (
  'caaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Airport Cab',
  180000, -- Rs 1,800
  'transport',
  'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  '2026-12-10',
  'Goa airport to Anjuna',
  'equal',
  '{"member_ids": ["baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2", "baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3", "baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4"]}'::jsonb,
  'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  1
) on conflict (id) do nothing;

insert into public.expense_splits (expense_id, member_id, share_paise)
values
  ('caaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 60000),
  ('caaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 60000),
  ('caaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4', 60000)
on conflict do nothing;

-- Sample Settlement: Karan paid Meera Rs 600 for the cab
insert into public.settlements (
  id, trip_id, from_member, to_member, amount_paise, paid_on, note, created_by
) values (
  'daaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', -- Karan
  'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', -- Meera
  60000, -- Rs 600
  '2026-12-11',
  'Cab share UPI',
  'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
) on conflict (id) do nothing;
