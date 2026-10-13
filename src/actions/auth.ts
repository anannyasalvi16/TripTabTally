'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { sanitizeNextUrl } from '@/lib/security';

const emailSchema = z.string().email('Please enter a valid email address.');

export type AuthActionResult = {
  ok: boolean;
  message?: string;
  url?: string;
};

export async function signInWithOtp(
  prevState: AuthActionResult | null,
  formData: FormData
): Promise<AuthActionResult> {
  const email = formData.get('email');
  const rawNext = formData.get('next');

  if (typeof email !== 'string') {
    return { ok: false, message: 'Email address is required.' };
  }

  const parseResult = emailSchema.safeParse(email.trim());
  if (!parseResult.success) {
    return { ok: false, message: parseResult.error.errors[0]?.message || 'Invalid email.' };
  }

  const validEmail = parseResult.data;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const safeNext = sanitizeNextUrl(typeof rawNext === 'string' ? rawNext : null);
  const emailRedirectTo = `${siteUrl}/auth/callback?next=${encodeURIComponent(safeNext)}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: validEmail,
    options: {
      emailRedirectTo,
    },
  });

  if (error) {
    const isRateLimit =
      error.status === 429 ||
      error.message.toLowerCase().includes('rate limit');

    if (isRateLimit) {
      return {
        ok: false,
        message:
          'Supabase email rate limit reached (free default SMTP allows 3 emails per hour). Please wait a few minutes, or use Continue with Google below for instant sign-in.',
      };
    }

    return { ok: false, message: error.message };
  }

  return {
    ok: true,
    message: `Magic link sent to ${validEmail}. Check your inbox.`,
  };
}

export async function signInWithGoogle(nextPath?: string): Promise<AuthActionResult> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const safeNext = sanitizeNextUrl(nextPath);
  const redirectTo = `${siteUrl}/auth/callback?next=${encodeURIComponent(safeNext)}`;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
    },
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  if (data?.url) {
    return { ok: true, url: data.url };
  }

  return { ok: false, message: 'Could not initialize Google sign-in.' };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
