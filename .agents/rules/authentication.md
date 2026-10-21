# Rule: Authentication Architecture (TripTabTally)

## Principles
1. **Always Use Email & Password Auth**:
   - Authentication must always be handled via `supabase.auth.signInWithPassword` (login) and `supabase.auth.signUp` (registration).
   - Never implement or re-introduce Magic Links, OTP email flows, or Google OAuth unless explicitly requested by the user.

2. **Security & Session Handling**:
   - Authentication Server Actions must use `@supabase/ssr` cookies stored via `src/lib/supabase/server.ts`.
   - Passwords must be validated with a minimum length of 6 characters.
   - User emails must be trimmed and converted to lowercase before submission.
   - Protect against timing and enumeration attacks with friendly, unified error messages ("Invalid email or password").

3. **Anti-Slop Design Requirements**:
   - Authentication forms must follow the ledger aesthetic: 0px border radius, no drop shadows, no emojis, clean serif headings (`font-serif`), and warm paper background (`bg-paper`, `bg-paper-2`, `border-rule`).
