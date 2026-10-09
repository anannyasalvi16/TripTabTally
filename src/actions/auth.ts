'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

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
  const next = formData.get('next');

  if (typeof email !== 'string') {
    return { ok: false, message: 'Email address is required.' };
  }

  const parseResult = emailSchema.safeParse(email.trim());
  if (!parseResult.success) {
    return { ok: false, message: parseResult.error.errors[0]?.message || 'Invalid email.' };
  }

  const validEmail = parseResult.data;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const nextParam = typeof next === 'string' && next ? encodeURIComponent(next) : '%2Ftrips';
  const emailRedirectTo = `${siteUrl}/auth/callback?next=${nextParam}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: validEmail,
    options: {
      emailRedirectTo,
    },
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  return {
    ok: true,
    message: `Magic link sent to ${validEmail}. Check your inbox.`,
  };
}

export async function signInWithGoogle(nextPath?: string): Promise<AuthActionResult> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const nextParam = nextPath ? encodeURIComponent(nextPath) : '%2Ftrips';
  const redirectTo = `${siteUrl}/auth/callback?next=${nextParam}`;

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
