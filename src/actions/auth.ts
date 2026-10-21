'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { sanitizeNextUrl } from '@/lib/security';
import {
  emailSchema,
  passwordSchema,
  displayNameSchema,
} from '@/lib/schemas/auth';

export type AuthActionResult = {
  ok: boolean;
  message?: string;
};

export async function signInWithPassword(
  prevState: AuthActionResult | null,
  formData: FormData
): Promise<AuthActionResult> {
  const email = formData.get('email');
  const password = formData.get('password');
  const rawNext = formData.get('next');

  if (typeof email !== 'string' || !email.trim()) {
    return { ok: false, message: 'Email address is required.' };
  }
  if (typeof password !== 'string' || !password) {
    return { ok: false, message: 'Password is required.' };
  }

  const emailResult = emailSchema.safeParse(email);
  if (!emailResult.success) {
    return { ok: false, message: emailResult.error.errors[0]?.message || 'Please enter a valid email address.' };
  }

  const safeNext = sanitizeNextUrl(typeof rawNext === 'string' ? rawNext : null);
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: emailResult.data,
    password,
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
      return { ok: false, message: 'Invalid email or password. Please check your credentials.' };
    }
    if (msg.includes('email not confirmed')) {
      return {
        ok: false,
        message:
          'Your email address has not been confirmed yet. Please verify your email inbox, or disable email confirmation in your Supabase dashboard.',
      };
    }
    return { ok: false, message: error.message };
  }

  redirect(safeNext);
}

export async function signUpWithPassword(
  prevState: AuthActionResult | null,
  formData: FormData
): Promise<AuthActionResult> {
  const email = formData.get('email');
  const password = formData.get('password');
  const displayName = formData.get('displayName');
  const rawNext = formData.get('next');

  if (typeof email !== 'string' || !email.trim()) {
    return { ok: false, message: 'Email address is required.' };
  }
  if (typeof password !== 'string' || !password) {
    return { ok: false, message: 'Password is required.' };
  }

  const emailResult = emailSchema.safeParse(email);
  if (!emailResult.success) {
    return { ok: false, message: emailResult.error.errors[0]?.message || 'Please enter a valid email address.' };
  }

  const passwordResult = passwordSchema.safeParse(password);
  if (!passwordResult.success) {
    return { ok: false, message: passwordResult.error.errors[0]?.message || 'Password must be at least 6 characters.' };
  }

  let validName: string | undefined;
  if (typeof displayName === 'string' && displayName.trim()) {
    const nameResult = displayNameSchema.safeParse(displayName);
    if (!nameResult.success) {
      return { ok: false, message: nameResult.error.errors[0]?.message || 'Invalid display name.' };
    }
    validName = nameResult.data;
  }

  const safeNext = sanitizeNextUrl(typeof rawNext === 'string' ? rawNext : null);
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email: emailResult.data,
    password: passwordResult.data,
    options: {
      data: {
        full_name: validName || emailResult.data.split('@')[0],
      },
    },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('already registered') || msg.includes('user already exists')) {
      return { ok: false, message: 'An account with this email already exists. Please sign in instead.' };
    }
    return { ok: false, message: error.message };
  }

  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return { ok: false, message: 'An account with this email already exists. Please sign in instead.' };
  }

  if (data.session) {
    redirect(safeNext);
  }

  return {
    ok: true,
    message: 'Account created! Please check your email to confirm your account, then sign in with your password.',
  };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
